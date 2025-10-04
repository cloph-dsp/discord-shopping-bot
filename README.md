# Discord Shopping List Bot

A Discord bot that creates interactive shopping lists using emoji reactions for a two-step checking system.

## Features

- 🛒 **Interactive Shopping Lists**: Create shopping lists with emoji reactions
- ✅ **Two-Step Checking**: First click marks item as "in cart", second click removes from list
- 📝 **Slash Commands**: Modern Discord slash command interface
- 🏪 **Channel Management**: Set specific channels for shopping lists
- 👥 **Multi-User**: Multiple users can interact with the same shopping list

## Emoji System

- 1️⃣2️⃣3️⃣ **Number Emojis**: Click to check/uncheck specific items (becomes ~~strikethrough~~)
- 🧹 **Clear Completed**: Remove all checked items at once (appears when items are checked)
- ➕ **Add Item**: Quickly add new items via reaction
- ✏️ **Edit**: Edit an existing item

## Commands

- `/shop create <title> [items]` - Create a new shopping list
- `/shop add <item> [quantity]` - Add item(s) to current shopping list (separate multiple with `;`)
- `/shop list` - Display current shopping list
- `/shop clear` - Clear the current shopping list
- `/shop channel <channel>` - Set the shopping list channel

## Installation

1. Clone this repository
2. Run `npm install`
3. Create a `.env` file with your Discord bot token:
   ```
   DISCORD_TOKEN=your_bot_token_here
   DISCORD_CLIENT_ID=your_client_id_here
   ```
4. Run `npm run deploy` to register slash commands
5. Run `npm start` to start the bot

## Discord Bot Setup (How to Add the Bot to Your Server)

1. **Create a Discord Application & Bot**
   - Go to the [Discord Developer Portal](https://discord.com/developers/applications)
   - Click **New Application** and give it a name
   - Go to the **Bot** tab and click **Add Bot**
   - Under **Privileged Gateway Intents**, enable **Message Content Intent**
   - Copy the **Bot Token** and add it to your `.env` file as `DISCORD_TOKEN`
   - Copy the **Client ID** and add it to your `.env` file as `DISCORD_CLIENT_ID`

2. **Invite the Bot to Your Server**
   - Go to the **OAuth2 > URL Generator** tab
   - Under **Scopes**, select `bot` and `applications.commands`
   - Under **Bot Permissions**, select:
     - `Send Messages`
     - `Read Message History`
     - `Add Reactions`
     - `Manage Messages` (for removing reactions)
   - Copy the generated URL and open it in your browser
   - Select your server and authorize the bot

3. **Run the Bot**
   - Make sure your `.env` file is set up with your token and client ID
   - Run `npm run deploy` to register slash commands
   - Run `npm start` to start the bot

4. **First Steps in Discord**
   - Use `/shop channel #your-channel` to set the shopping list channel
   - Use `/shop create` to create your first list!

## Usage

1. Set a shopping channel: `/shop channel #shopping`
2. Create a shopping list: `/shop create "Weekly Groceries" milk;bread;eggs`
3. Add multiple items at once: `/shop add "butter;cheese;yogurt"`
4. Users can click emojis to interact with items:
   - 1️⃣2️⃣3️⃣ to check/uncheck specific items (becomes ~~strikethrough~~)
   - 🧹 to clear all checked items at once
   - ➕ to add new items quickly
   - ✏️ to edit existing items

## How It Works

The bot uses Discord's reaction system to create a simple, intuitive shopping experience:

1. **Fresh Item**: `1️⃣ ⬜ Milk (2 liters)`
2. **Checked**: `1️⃣ ✅ ~~Milk (2 liters)~~` (strikethrough)
3. **Clear All**: Click 🧹 to remove all checked items at once

This creates a natural workflow: check items as you shop, then clear all completed items when done!