# Discord Shopping List Bot

A Discord bot for shared shopping lists. Each list is a public message with buttons: tap an item button to check it off, add or edit items through modals, and clear completed items. Data is stored in SQLite.

## Features

- `/shop` slash commands with autocomplete for list titles
- One toggle button per item (the first 20 items), checked state updated in place
- Modals for adding multiple items and editing an item
- Multiple named lists; each channel tracks its own active list
- Embed colour and footer reflect progress
- Persistent SQLite storage
- No privileged gateway intents required

## Commands

| Command | Description |
|---|---|
| `/shop create <title> [items]` | Create a list. `items` is semicolon-separated (e.g. `milk;bread;eggs`). The list becomes active in the current channel and is posted as a public message. |
| `/shop add <item> [quantity]` | Add one or more items to the channel's active list. Separate multiple items with `;`. A `quantity` above 1 is stored as `item (N)`. |
| `/shop list [title]` | Display a list, with autocomplete. The list becomes active in the current channel. Without `title`, displays the channel's active list. |
| `/shop clear` | Remove all items from the active list, checked and unchecked. |
| `/shop lists` | Show all lists with their completion counts and mark the one active in this channel. |
| `/shop help` | Show the in-Discord usage embed. |
| `/test` | Developer utility. Posts a test embed and adds emoji reactions; only this command needs Add Reactions. |

`/shop` command replies are ephemeral (only the invoker sees them); `/test` posts publicly. The list itself is a normal public message, and any member who can see the channel can press its buttons.

## Buttons

| Button | Behaviour |
|---|---|
| `⬜ N. item` | Unchecked item. Click to check it (button turns green, `✅ N. item`). |
| `✅ N. item` | Checked item. Click again to uncheck it. |
| `➕ Add` | Opens a modal with a paragraph field; separate items with `;`. |
| `✏️ Edit` | Opens a modal asking for an item number and the new text. |
| `🧹 Clear Done` | Deletes all checked items. Only shown while at least one item is checked. |
| `🔄 Refresh` | Re-renders the list message from the database. |

Item buttons are limited to 20 (four rows of five), leaving the fifth row for the controls. Items beyond 20 are shown in the embed description, numbered 21 onward, with `⬜`/`✅` and strikethrough when checked; they have no buttons.

Embed colour indicates progress: grey for an empty list, blurple when nothing is checked, yellow when some items are checked, green when all are checked. The footer shows completion progress (`N/M items` plus a state message), except on an empty list, where it points at the buttons.

## Requirements

- Node.js 20 or newer
- A Discord bot with the `bot` and `applications.commands` scopes
- Permissions: Send Messages, Read Message History, Use Application Commands
- Gateway intents: Guilds and GuildMessages only; Message Content is not used

## Quick start

```bash
npm install
cp .env.example .env    # set DISCORD_TOKEN and DISCORD_CLIENT_ID
npm run deploy          # register slash commands
npm start
```

See [SETUP.md](SETUP.md) for Discord application setup, environment variables and running as a service. See [EXAMPLE.md](EXAMPLE.md) for text mockups of the list message, buttons and modals.

## Storage

Data lives in `data/storage.db` (SQLite via `better-sqlite3`) and is created on first start. The `data/` directory is gitignored. List titles are unique within each guild. Each channel keeps one active list in `active_lists`; switching lists replaces that mapping instead of leaving two candidates. Pre-guild databases are upgraded on first start, and their lists are assigned to the guild automatically when the bot is in exactly one guild. `npm run migrate` imports legacy `data/lists.json` / `data/settings.json` data into SQLite.

## Tests

`npm test` runs the storage, UI-limit and migration tests with a throwaway database. `node demo.js` also uses a throwaway database and never writes to `data/storage.db`.

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
    ├── storage.js               # SQLite persistence
    ├── embeds.js                # list and help embeds
    ├── buttons.js               # button row builders
    ├── messageCache.js          # short-lived message cache
    ├── modalTitles.js           # modal title truncation
    ├── migrate-json-to-sqlite.js
    └── test-reactions.js        # helpers for /test
```

## License

MIT
