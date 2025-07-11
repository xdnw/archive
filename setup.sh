#!/usr/bin/env bash
set -euo pipefail

read -p "Enter your Discord Application ID: " APP_ID
read -sp "Enter your Bot Token: " BOT_TOKEN
echo

HEADERS=(
  -H "Authorization: Bot $BOT_TOKEN"
  -H "Content-Type: application/json"
  -H "User-Agent: MyBot (https://github.com/you/repo, v0.1)"
)

# register /ping
curl "${HEADERS[@]}" \
  -X POST "https://discord.com/api/v10/applications/$APP_ID/commands" \
  -d '{"name":"ping","description":"Replies with PONG!"}'
echo "✅ /ping command registered successfully!"

# register /archive with integer "limit" arg (1–100)
curl "${HEADERS[@]}" \
  -X POST "https://discord.com/api/v10/applications/$APP_ID/commands" \
  -d '{
    "name":"archive",
    "description":"Archive the last N messages as markdown",
    "options":[
      {
        "name":"limit",
        "description":"Max number of messages to include (1–100)",
        "type":4,
        "required":false,
        "min_value":1,
        "max_value":1000
      }
    ]
  }'
echo "✅ /archive command registered successfully!"