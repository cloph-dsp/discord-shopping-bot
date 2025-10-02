# Discord Shopping List Bot Setup Guide

## Prerequisites
- Node.js 16.x or higher
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

### Emoji Interactions
Once you have a shopping list, use these emoji reactions:

1. **🛒 Add to Cart**: Click to mark item as picked up (becomes ~~strikethrough~~)
2. **✅ Purchase**: Click to confirm purchase and remove from list (only works on items already in cart)
3. **🗑️ Delete**: Remove item without purchasing
4. **✏️ Edit**: Modify an existing item

### Workflow
1. Create a shopping list: `/shop create "Weekly Groceries" milk;bread;eggs`
2. As you shop, click 🛒 to add items to your cart
3. When you've purchased items, click ✅ to remove them from the list
4. Use 🗑️ to remove items you don't need anymore
5. Use ✏️ to edit item names or quantities

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
│   └── shop.js          # Main shopping commands
├── events/
│   ├── ready.js         # Bot ready event
│   └── messageReactionAdd.js  # Reaction handling
└── utils/
    ├── storage.js       # In-memory data storage
    └── embeds.js        # Discord embed formatting
```

### Adding Features
- Storage is currently in-memory (resets on restart)
- For persistence, consider adding MongoDB, SQLite, or JSON file storage
- Embeds can be customized in `src/utils/embeds.js`
- Commands can be extended in `src/commands/shop.js`

## License
MIT License - Feel free to modify and distribute!