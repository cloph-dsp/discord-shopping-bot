# Troubleshooting "Application did not respond"

## Quick Fixes

### 1. Check if the bot is actually running
```bash
sudo systemctl status discord-shopping-bot
journalctl -u discord-shopping-bot -f
```

Look for:
- ✅ `Ready! Logged in as Shopping list#2206`
- ✅ `Bot is in 1 guilds`
- ❌ Any connection errors or crashes

### 2. Check for "[INTERACTION] Received" logs
When you run a command, you should immediately see:
```
[INTERACTION] Received: shop from YourUsername#1234
[COMMAND] Executing: shop
```

**If you DON'T see these logs:**
- Bot isn't receiving interactions from Discord
- Possible causes:
  - Websocket disconnected (restart bot)
  - Commands not registered (run `npm run deploy`)
  - Bot permissions issue

### 3. Re-register slash commands
```bash
cd /home/kastru/discord-shopping-bot
npm run deploy
sudo systemctl restart discord-shopping-bot
```

### 4. Check bot permissions
The bot needs these permissions in Discord:
- ✅ `applications.commands` scope
- ✅ Send Messages
- ✅ Read Message History
- ✅ Add Reactions
- ✅ Manage Messages

### 5. Verify .env file
```bash
cat .env
```

Should have:
```
DISCORD_TOKEN=your_token_here
DISCORD_CLIENT_ID=your_client_id_here
```

## Common Issues

### "Unknown interaction" (10062)
- **Cause**: Bot took >3 seconds to respond
- **Fix**: Latest code defers replies immediately - restart bot

### Bot shows online but doesn't respond
- **Cause**: Websocket disconnected but process still running
- **Fix**: Restart the bot service

### Commands not appearing in Discord
- **Cause**: Commands not registered
- **Fix**: Run `npm run deploy`

## Diagnostic Commands

```bash
# Watch logs in real-time
journalctl -u discord-shopping-bot -f

# Check last 100 lines
journalctl -u discord-shopping-bot -n 100

# Restart bot
sudo systemctl restart discord-shopping-bot

# Check if process is running
ps aux | grep "node.*index.js"
```
