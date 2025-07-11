# Discord Archive Bot

A Cloudflare Worker–based Discord bot that provides `/ping` and `/archive` slash commands.  
– `/ping` replies with “PONG!”  
– `/archive` fetches the last _N_ messages from a channel, zips them (including attachments), and uploads the archive to a designated channel.

## Features

- Slash commands registered via `setup.sh` / `setup.ps1`.
- Signature verification using [`discord-interactions`](https://www.npmjs.com/package/discord-interactions).
- Paginated message fetching and Markdown transcript generation.
- ZIP creation with [`fflate`](https://www.npmjs.com/package/fflate) (includes attachments).
- Deploys as a [Cloudflare Worker](https://developers.cloudflare.com/workers/) with Wrangler.

## Prerequisites

- A Discord application & bot: https://discord.com/developers/applications/
- A Cloudflare account with [Wrangler](https://developers.cloudflare.com/workers/cli-wrangler/) installed.
- Node.js & npm/yarn.

## Installation
- <https://docs.npmjs.com/downloading-and-installing-node-js-and-npm#using-a-node-version-manager-to-install-nodejs-and-npm>

```bash
git clone <your-repo-url>
cd archive
npm install
wrangler login
```

## Configuration

1. Create a Discord bot and note down:
   - **Application ID**
   - **Bot Token**
   - **Public Key**

2. In `wrangler.jsonc`, bind the following environment variables:

   ```jsonc
   {
     // ...
     "env": {
       "PUBLIC_KEY": "",
       "ARCHIVE_ROLE_ID": "",
       "BOT_TOKEN": "",
       "APPLICATION_ID": "",
       "ARCHIVE_CHANNEL": ""
     }
   }
   ```

   Alternatively use `wrangler secret put <KEY>` to set the variables.

3. Register the slash commands:

   macOS/Linux  
   ```bash
   ./setup.sh
   ```

   Windows PowerShell  
   ```powershell
   .\setup.ps1
   ```

## Development

Run a local Worker and test commands via Cloudflare’s dev URL:

```bash
wrangler deploy
```

## Testing

Unit tests are powered by Vitest and Cloudflare pool Workers:

```bash
npm run dev
```

See index.spec.ts.

## Deployment

Publish your Worker to Cloudflare:

```bash
npm run deploy
```

## Usage

1. Invite your bot to a server:

   ```
   https://discord.com/api/oauth2/authorize?client_id=<APPLICATION_ID>&scope=bot%20applications.commands&permissions=8
   ```

2. In any channel:
   - `/ping` → PONG!
   - `/archive limit:<number>` → Generates a zip of the last _limit_ messages and posts it in the configured archive channel.

## Project Structure

- [src/index.ts] – Worker entrypoint & command handlers.  
- [package.json] – Scripts & dependencies.  
- [wrangler.jsonc] – Cloudflare Worker config.  
- [setup.sh] / [setup.ps1] – Command registration scripts.  

## License

This project is licensed under the GNU AFFERO GENERAL PUBLIC LICENSE. See LICENSE.
