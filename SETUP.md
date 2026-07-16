# Discord Shopping List Bot Setup Guide

## Prerequisites
- Node.js 20.x or higher (required by `better-sqlite3` 12.x)
- A Discord application and bot token
- Basic knowledge of Discord bot setup

## Quick Start

### 1. Discord Application Setup
1. Go to https://discord.com/developers/applications
2. Create a new application
3. Go to "Bot" section and create a bot
4. Copy the bot token
5. Copy the application ID from "General Information"

### 2. Bot Permissions
Your bot needs these permissions:
- Send Messages
- Use Slash Commands
- Add Reactions
- Read Message History
- Manage Messages (to remove reactions)

### 3. Installation
```bash
# Clone or download the bot files
cd discord-shopping-bot

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

### 4. Configuration
Edit `.env` file with your bot credentials:
```
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
```

### 5. Deploy Commands
```bash
# Register slash commands with Discord
npm run deploy
```

### 6. Start the Bot
```bash
# Start the bot
npm start

# For development with auto-restart
npm run dev
```

### 7. Invite Bot to Your Server
Create an invite link with these scopes:
- `bot`
- `applications.commands`

URL template:
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=2147537984&scope=bot%20applications.commands
```

## Usage

### Basic Commands
- `/shop help` - Show help and instructions
- `/shop create "My List" milk;bread;eggs` - Create a shopping list
- `/shop add "Orange juice" 2` - Add item with quantity
- `/shop list` - Show current shopping list
- `/shop clear` - Clear the shopping list
- `/shop channel #shopping` - Set shopping channel

### Button Interactions
Lists are interactive — each item has a check button. Other action buttons sit under the list:

1. **Item buttons**: Click to toggle checked / unchecked (embeds show ⬜ unchecked, ✅ checked)
2. **➕ Add Items**: Opens a modal to add new items (separate multiple with `;`)
3. **✏️ Edit Item**: Opens a modal to edit an item by its number
4. **🧹 Clear Done**: Removes all checked items at once
5. **🔄 Refresh**: Re-renders the list message

### Workflow
1. Create a shopping list: `/shop create "Weekly Groceries" milk;bread;eggs`
2. As you shop, click item buttons to mark items done (they flip to ✅)
3. When you're finished, click 🧹 to clear all checked items
4. Use ➕ to add items you forgot; ✏️ to fix typos in item names

## Features

### Two-Step Shopping Process
- **Step 1**: Add items to cart (🛒) - items become ~~strikethrough~~
- **Step 2**: Confirm purchase (✅) - items are removed from the list
- This prevents accidental removal and lets you track what's in your cart

### Multi-User Support
- Multiple people can interact with the same shopping list
- Actions are logged with usernames
- Perfect for family or team shopping

### Channel Management
- Set dedicated shopping channels
- Prevents spam in other channels
- Organize different lists in different channels

## Troubleshooting

### Bot Not Responding
- Check bot is online and has proper permissions
- Verify token in `.env` file
- Check console for error messages

### Slash Commands Not Showing
- Run `npm run deploy` to register commands
- Wait a few minutes for Discord to update
- Check bot has `applications.commands` scope

### Reactions Not Working
- Ensure bot has "Add Reactions" and "Manage Messages" permissions
- Check the bot can see the channel where the shopping list is posted

## Development

### File Structure
```
src/
├── commands/
│   ├── shop.js          # Main shopping commands (create/add/list/clear/lists/help)
│   └── test.js          # Developer reaction-test utility
├── events/
│   ├── ready.js         # Bot ready event (REST warmup + keep-alive)
│   └── interactionCreate.js  # Button + modal handler
└── utils/
    ├── storage.js       # SQLite persistence (better-sqlite3)
    ├── embeds.js        # Discord embed formatting
    ├── buttons.js       # Button row builders
    ├── messageCache.js  # Short-lived message cache
    └── test-reactions.js # Reaction helpers for test command
```

### Adding Features
- Storage is persistent via SQLite at `data/storage.db`
- Embeds can be customized in `src/utils/embeds.js`
- Commands can be extended in `src/commands/shop.js`
- Button handlers live in `src/events/interactionCreate.js`

## License
MIT License - Feel free to modify and distribute!