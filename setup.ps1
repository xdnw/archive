# ensure TLS1.2
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# 1) Make sure your bot has been invited with both "bot" and "applications.commands" scopes:
#    https://discord.com/api/oauth2/authorize?client_id=<YOUR_APP_ID>&scope=bot%20applications.commands&permissions=0

$appId = Read-Host "Enter your Discord Application ID"
$secureToken = Read-Host "Enter your Bot Token (input hidden)" -AsSecureString
$botToken = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
)

$body = @{
  name        = "ping"
  description = "Replies with PONG!"
} | ConvertTo-Json

$headers = @{
  Authorization  = "Bot $botToken"
  "Content-Type" = "application/json"
  "User-Agent"   = "MyBot (https://github.com/you/repo, v0.1)"
}

# To register a global command (can take ~1 hour to propagate):
Invoke-RestMethod `
  -Method       Post `
  -Uri          "https://discord.com/api/v10/applications/$appId/commands" `
  -Headers      $headers `
  -Body         $body `
  -ContentType  "application/json"

# ───────────────────────────────────────────────────────────────────────────
# register /archive with an optional integer argument "limit"
$bodyArchive = @{
  name        = "archive"
  description = "Archive the last N messages as markdown"
  options     = @(
    @{
      name        = "limit"
      description = "Max number of messages to include (1–100)"
      type        = 4      # 4 = INTEGER
      required    = $false
      min_value   = 1
      max_value   = 1000
    }
  )
} | ConvertTo-Json

Invoke-RestMethod `
  -Method       Post `
  -Uri          "https://discord.com/api/v10/applications/$appId/commands" `
  -Headers      $headers `
  -Body         $bodyArchive `
  -ContentType  "application/json"

Write-Host "✅ /archive command registered successfully!" -ForegroundColor Green

# ── OR ──
# To register instantly in a single guild (replace $guildId with your test server ID):
# Invoke-RestMethod `
#   -Method       Post `
#   -Uri          "https://discord.com/api/v10/applications/$appId/guilds/$guildId/commands" `
#   -Headers      $headers `
#   -Body         $body `
#   -ContentType  "application/json"

Write-Host "✅ /ping command registered successfully!" -ForegroundColor Green