import { verifyKey } from "discord-interactions";
import { zipSync, strToU8 } from "fflate";

export default {
  async fetch(request: Request, env: { PUBLIC_KEY: string, ARCHIVE_ROLE_ID: string, BOT_TOKEN: string, APPLICATION_ID: string, ARCHIVE_CHANNEL: string }, ctx: ExecutionContext): Promise<Response> {
    // 1) Log public key
    console.log("PUBLIC_KEY:", env.PUBLIC_KEY);

    // 2) Verify HTTP method
    console.log("Incoming method:", request.method);
    const method = request.method.toUpperCase();
    if (method !== "POST") {
      const resp = new Response("Method not allowed", { status: 405 });
      console.log("→ 405 Method not allowed, responding with:", resp.status);
      return resp;
    }

    // 3) Read & log raw body
    const bodyText = await request.text();
    console.log("Received body:", bodyText);

    // 4) Parse & log interaction
    let interaction: any;
    try {
      interaction = JSON.parse(bodyText);
      console.log("Parsed interaction:", interaction);
    } catch (e) {
      console.log("→ 400 Invalid JSON");
      const resp = new Response("Invalid JSON", { status: 400 });
      console.log("Responding with:", resp.status);
      return resp;
    }

    // 5) Log raw signature headers
    const sig = request.headers.get("x-signature-ed25519");
    const ts = request.headers.get("x-signature-timestamp");
    console.log("X-Signature-Ed25519:", sig);
    console.log("X-Signature-Timestamp:", ts);

    // 6) Verify signature
    const bodyData = new TextEncoder().encode(bodyText);
    const isValid = Boolean(
      sig &&
      ts &&
      await verifyKey(bodyData, sig, ts, env.PUBLIC_KEY)
    );
    console.log("Signature valid:", isValid);
    if (!isValid) {
      const resp = new Response("invalid request signature", { status: 401 });
      console.log("→ 401 Invalid signature, responding with:", resp.status);
      return resp;
    }

    // 7) ACK PING (type 1)
    if (interaction.type === 1) {
      const responseBody = JSON.stringify({ type: 1 });
      console.log("→ Responding to PING with:", responseBody);
      const resp = new Response(responseBody, {
        headers: { "Content-Type": "application/json" },
      });
      console.log("Outgoing response:", resp.status, responseBody);
      return resp;
    }

    // 8) /ping slash command
    if (interaction.type === 2 && interaction.data.name === "ping") {
      return await ping();
    }
    if (interaction.type === 2 && interaction.data.name === "archive") {
      console.log("→ Handling /archive command");
      return archive(interaction, {
        ARCHIVE_ROLE_ID: env.ARCHIVE_ROLE_ID,
        BOT_TOKEN: env.BOT_TOKEN,
        APPLICATION_ID: env.APPLICATION_ID,
        ARCHIVE_CHANNEL: env.ARCHIVE_CHANNEL,
      }, ctx);
    }

    // 9) Fallback
    const resp = new Response("", { status: 204 });
    console.log("→ 204 No Content fallback, responding with:", resp.status);
    return resp;
  }
};

async function ping() {
  return new Response("PONG!", {
    headers: { "Content-Type": "text/plain" },
  });
}

async function archive(interaction: any,
  env: { ARCHIVE_ROLE_ID: string, BOT_TOKEN: string, APPLICATION_ID: string, ARCHIVE_CHANNEL: string }, ctx: ExecutionContext) {
  // 1) check that the member has the right role
  const member = interaction.member as { roles?: string[]; user: { id: string } };
  const roles = Array.isArray(member.roles) ? member.roles : [];
  const required = env.ARCHIVE_ROLE_ID;
  if (!required || !roles.includes(required)) {
    const body = JSON.stringify({
      type: 4,
      data: {
        content: "🚫 You don’t have permission to archive this channel. Missing role: `can-archive` id: 1393088668981395608",
        flags: 1 << 6  // ephemeral
      }
    });
    return new Response(body, { headers: { "Content-Type": "application/json" } });
  }

  // 2) stub: fetch messages & build HTML
  const channelId = interaction.channel_id!;
  const limitOption = interaction.data.options?.find((o: any) => o.name === "limit")?.value;
  const limit = typeof limitOption === "number" ? limitOption : undefined;

  // 1) Immediately ACK with an ephemeral reply pointing to the archive channel
  const ack = new Response(
    JSON.stringify({
      type: 4,
      data: {
        content: `✅ Archive is being uploaded to <#${env.ARCHIVE_CHANNEL}>`,
        flags: 1 << 6, // ephemeral
      },
    }),
    { headers: { "Content-Type": "application/json" } }
  );

  // 2) In background: generate ZIP and post it to the archive channel
  ctx.waitUntil(
    (async () => {
      try {
        const zip = await generateArchiveZip(channelId, env.BOT_TOKEN, limit);

        const infoRes = await fetch(
          `https://discord.com/api/v10/channels/${channelId}`,
          { headers: { Authorization: `Bot ${env.BOT_TOKEN}` } }
        );
        const info: any = await infoRes.json();
        const channelName = info.name ?? channelId;

        const form = new FormData();
        form.append(
          "file",
          new Blob([zip.slice()], { type: "application/zip" }),
          `archive_${channelId}.zip`
        );
        form.append(
          "payload_json",
          JSON.stringify({
            content: `Archive of **#${channelName}** (ID: ${channelId})`,
          })
        );

        console.log("[Archive] Uploading to archive channel:", env.ARCHIVE_CHANNEL);
        await fetch(
          `https://discord.com/api/v10/channels/${env.ARCHIVE_CHANNEL}/messages`,
          {
            method: "POST",
            headers: { Authorization: `Bot ${env.BOT_TOKEN}` },
            body: form,
          }
        );

        // ephemeral follow-up to original channel
        await fetch(
          `https://discord.com/api/v10/webhooks/${env.APPLICATION_ID}/${interaction.token}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content: `📦 Archive for **#${channelName}** is now available in <#${env.ARCHIVE_CHANNEL}>.`,
              flags: 1 << 6
            })
          }
        );
      } catch (e: any) {
        console.error("[Archive] upload to archive-channel failed:", e);
        await fetch(
          `https://discord.com/api/v10/webhooks/${env.APPLICATION_ID}/${interaction.token}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content: `⚠️ Error archiving channel: ${e.message}`,
              flags: 1 << 6
            })
          }
        );
      }
    })()
  );

  return ack;
}

async function generateArchiveZip(
  channelId: string,
  botToken: string,
  limit?: number
): Promise<Uint8Array> {
  const headers = { Authorization: `Bot ${botToken}` };

  const all: any[] = [];
  let before: string | undefined;
  const maxFetch = limit && limit > 0 ? limit : Infinity;

  console.log(`[Archive] paginate start: channel=${channelId} limit=${limit}`);
  while (true) {
    if (limit && all.length >= limit) break;
    const fetchCount = limit
      ? Math.min(100, maxFetch - all.length)
      : 100;
    const params = new URLSearchParams({
      limit: fetchCount.toString(),
      ...(before && { before }),
    });
    const url = `https://discord.com/api/v10/channels/${channelId}/messages?${params}`;
    console.log(`[Archive] fetching messages: ${url}`);
    const res = await fetch(
      url,
      { headers }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "<unable to read body>");
      console.error(`[Archive] Discord API error ${res.status} ${res.statusText} at ${url}:`, text);
      throw new Error(`Discord API error ${res.status}`);
    }
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < fetchCount) break;
    before = batch[batch.length - 1].id;
  }

  // markdown transcript
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const msgs = limit ? all.slice(0, limit) : all;
  let md = "# Channel Archive: " + channelId + "\n\n" +
    msgs
      .reverse()
      .map(m => {
        const time = new Date(m.timestamp).toLocaleString();
        const user = escape(`${m.author.username}#${m.author.discriminator}`);
        const text = escape(m.content || "");
        return `**${user}** [${time}]: ${text}`;
      })
      .join("\n");

  // collect attachments
  const files: { name: string; data: Uint8Array }[] = [];
  for (const m of msgs) {
    if (Array.isArray(m.attachments)) {
      for (const a of m.attachments) {
        const fileRes = await fetch(a.url);
        const buf = new Uint8Array(await fileRes.arrayBuffer());
        files.push({ name: a.filename, data: buf });
        // update md to point at local file
        md = md.replace(a.url, `attachments/${a.filename}`);
      }
    }
  }

  // zip up transcript.md + attachments/*
  const entries: Record<string, Uint8Array> = {
    "transcript.md": strToU8(md),
  };
  for (const f of files) {
    entries[`attachments/${f.name}`] = f.data;
  }
  return zipSync(entries);
}