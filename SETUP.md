# Setup Guide

## Prerequisites

- Node.js 20 or newer (`better-sqlite3` 12.x requires it)
- A Discord account with access to the [Developer Portal](https://discord.com/developers/applications)

## 1. Create the Discord application

1. Open the Developer Portal and click **New Application**.
2. Copy the **Application ID** from *General Information* — this is `DISCORD_CLIENT_ID`.
3. Open the **Bot** tab, create/reset the bot token and copy it — this is `DISCORD_TOKEN`.
4. Leave all **Privileged Gateway Intents** disabled. The bot connects with `Guilds` and `GuildMessages` only; it does not read message content.

## 2. Invite the bot

Use the OAuth2 URL Generator with:

- Scopes: `bot`, `applications.commands`
- Bot permissions: **Send Messages**, **Read Message History**, **Use Application Commands**

URL template:

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=67584&scope=bot%20applications.commands
```

`67584` is Send Messages + Read Message History; command use is granted by the `applications.commands` scope. Add Reactions and Manage Messages are not needed for normal operation (only the developer `/test` command adds reactions).

## 3. Install

```bash
cd discord-shopping-bot
npm install
cp .env.example .env
```

## 4. Configure `.env`

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DISCORD_TOKEN` | yes | — | Bot token from the Developer Portal |
| `DISCORD_CLIENT_ID` | yes | — | Application ID |
| `REST_REQUEST_TIMEOUT_MS` | no | `15000` | REST request timeout. Values below `3000` fall back to the default. |
| `REST_KEEPALIVE_INTERVAL_MS` | no | `45000` | Interval for the REST keep-alive ping. Values below `15000` fall back to the default. |

## 5. Register slash commands

```bash
npm run deploy
```

This registers global application commands. Discord can take a few minutes to show them in clients.

## 6. Run

```bash
npm start        # production
npm run dev      # nodemon auto-restart
```

Production on this host runs under the systemd unit `discord-shopping`:

```bash
sudo systemctl restart discord-shopping
journalctl -u discord-shopping -f
```

## 7. Migrate legacy JSON data (optional)

Older versions stored data in `data/lists.json` and `data/settings.json`. To import it into `data/storage.db`:

```bash
npm run migrate
```

The script imports both files if present and renames them to `*.migrated`. Existing list and item rows are skipped; settings rows are replaced.

## Usage

### Commands

| Command | Description |
|---|---|
| `/shop create <title> [items]` | Create a list. `items` is semicolon-separated. The list is posted publicly in the current channel and becomes its active list. Titles must be unique within a guild. |
| `/shop add <item> [quantity]` | Add items to the channel's active list. Multiple items use `;`. A quantity above 1 is stored per item and shown as `×N`. |
| `/shop list [title]` | Display a list (autocomplete). Makes it the active list in the current channel. Without a title, uses the channel's active list. |
| `/shop clear` | Remove all items (checked and unchecked) from the active list. |
| `/shop sort` | Sort the active list by item name. |
| `/shop delete <title>` | Delete a list after an explicit confirmation button. |
| `/shop lists` | Show all lists with completion counts; marks the one active in this channel. |
| `/shop help` | Show the usage embed. |
| `/test` | Developer utility; posts a test embed and adds emoji reactions. Needs Add Reactions to succeed. |

`/shop` command replies are ephemeral. The list message itself is public. `/test` posts its test embed publicly.

### Buttons and modals

- Click an item button to toggle it. The button flips between `⬜` (grey) and `✅` (green), and the embed is edited in place.
- **➕ Add** opens a modal; enter items separated by `;`.
- **✏️ Edit** opens a modal asking for the global item number (1–N) and the new text.
- **🗑️ Remove** opens a modal asking for the global item number to delete.
- **🧹 Clear Done** deletes checked items and only appears while something is checked.
- **🔄 Refresh** re-renders the list from the database.
- **◀ Previous / ▶ Next** appear when the list has more than 15 items; the middle button shows `page/total`.

The embed opens with a ten-block progress bar and shows the current page of up to 15 items, numbered globally. Item numbers on later pages remain valid for `✏️ Edit` and `🗑️ Remove`. `/shop sort` resets the view to page 1.

### Active list behaviour

- Creating a list, or displaying it with `/shop list`, binds it to the current channel and makes it active there.
- `/shop add` and `/shop clear` act on the active list of the current channel. If the channel has no active list, the bot asks you to run `/shop list` there first.

## Troubleshooting

### Slash commands are not visible

- Run `npm run deploy` and wait a few minutes; global command propagation is not instant.
- Confirm the bot was invited with the `applications.commands` scope.
- Restart the Discord client.

### Bot does not respond

- Check the process is running and the token is correct: `journalctl -u discord-shopping -n 100`.
- Confirm the bot can view the channel and has Send Messages and Read Message History.

### "No active list in this channel"

Run `/shop list "List name"` in that channel to bind and display the list there.

### Buttons report the list no longer exists

The list message or its database row was deleted. Re-post it with `/shop list "List name"`.

### Button presses seem to do nothing

Every item has a button on some page. Use ◀ / ▶ to reach it; the numbers are global, and ✏️ Edit or 🗑️ Remove accept numbers from any page.

### `/test` fails

That developer utility adds emoji reactions to its own message and therefore needs Add Reactions, which the normal list workflows do not use.

## Project layout

```
src/
├── index.js                     # client setup, command/event loading, shutdown handling
├── deploy-commands.js           # registers application commands
├── commands/
│   ├── shop.js                  # /shop create|add|list|clear|lists|help
│   └── test.js                  # developer /test command
├── events/
│   ├── ready.js                 # ready log, REST warm-up and keep-alive
│   └── interactionCreate.js     # command, button, modal and autocomplete handling
└── utils/
    ├── storage.js               # SQLite persistence (data/storage.db)
    ├── embeds.js                # list and help embeds
    ├── buttons.js               # button row builders
    ├── messageCache.js          # short-lived message cache
    ├── modalTitles.js           # modal title truncation
    ├── migrate-json-to-sqlite.js
    └── test-reactions.js        # helpers for /test
```

## License

MIT
