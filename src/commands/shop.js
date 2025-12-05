const { SlashCommandBuilder } = require('discord.js');
const storage = require('../utils/storage');
const { createShoppingListEmbed, createInstructionEmbed } = require('../utils/embeds');
const { createShoppingListButtons } = require('../utils/buttons');
const messageCache = require('../utils/messageCache');

// Cache autocomplete results to speed up responses
let autocompleteCache = {
  titles: [],
  lastUpdate: 0,
  ttl: 5000 // 5 second cache
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Manage your shopping lists')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a new shopping list')
        .addStringOption(option =>
          option.setName('title')
            .setDescription('Title for your shopping list')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('items')
            .setDescription('Items separated by semicolons (e.g., "milk;bread;eggs")')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add an item to the current shopping list')
        .addStringOption(option =>
          option.setName('item')
            .setDescription('Item(s) to add (separate multiple with semicolons: "milk;bread;eggs")')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('quantity')
            .setDescription('Quantity needed')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Display the current shopping list')
        .addStringOption(option =>
          option.setName('title')
            .setDescription('Title of the list to display')
            .setRequired(false)
            .setAutocomplete(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('clear')
        .setDescription('Clear items from the active shopping list'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('lists')
        .setDescription('Show all available shopping lists'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('help')
        .setDescription('Show help and instructions')),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'create':
        await handleCreate(interaction);
        break;
      case 'add':
        await handleAdd(interaction);
        break;
      case 'list':
        await handleList(interaction);
        break;
      case 'clear':
        await handleClear(interaction);
        break;
      case 'lists':
        await handleLists(interaction);
        break;
      case 'help':
        await handleHelp(interaction);
        break;
    }
  },
  // Autocomplete handler for list titles
  async autocomplete(interaction) {
    try {
      const focused = interaction.options.getFocused();
      
      // Use cached titles if available and fresh
      const now = Date.now();
      if (now - autocompleteCache.lastUpdate > autocompleteCache.ttl) {
        autocompleteCache.titles = storage.getAllListTitles();
        autocompleteCache.lastUpdate = now;
      }
      
      // Quick filter and limit to 25 results
      // Use includes() instead of startsWith() for better UX
      const filtered = autocompleteCache.titles
        .filter(title => title.toLowerCase().includes(focused.toLowerCase()))
        .slice(0, 25);
      
      // Respond immediately with timeout protection
      const responsePromise = interaction.respond(
        filtered.map(title => ({ name: title, value: title }))
      );
      
      // Add a timeout to prevent hanging on slow connections
      await Promise.race([
        responsePromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Autocomplete timeout')), 2500)
        )
      ]);
    } catch (error) {
      // Silently fail - autocomplete errors shouldn't crash the bot
      console.error('Autocomplete error:', error.message || error);
    }
  }
};

async function handleCreate(interaction) {
  // Defer FIRST before any other operations
  await interaction.deferReply({ flags: 64 });

  const title = interaction.options.getString('title');
  const itemsString = interaction.options.getString('items');
  const channelId = interaction.channel.id;

  // Check if list with this title already exists
  const existingList = storage.getListByTitle(title);
  if (existingList) {
    return interaction.editReply({ 
      content: `❌ A list named "${title}" already exists. Choose a different name or use \`/shop list "${title}"\` to display it.`
    });
  }

  // Parse items
  let items = [];
  if (itemsString) {
    items = itemsString.split(';').map(item => item.trim()).filter(item => item.length > 0);
  }

  // Create the shopping list
  const list = storage.createList(title, items);
  
  // Set as active list for this channel
  storage.setActiveList(channelId, list.id);
  
  // Create and send the embed with buttons
  const embed = createShoppingListEmbed(list);
  const buttons = createShoppingListButtons(list);
  
  // Send the shopping list as a separate message with buttons
  const message = await interaction.channel.send({ embeds: [embed], components: buttons });
  console.log(`Created shopping list message with ID: ${message.id}`);
  
  // Store the message ID for button handling
  storage.setMessageId(list.id, message.id);
  messageCache.updateCache(message);
  
  // Update the initial reply
  await interaction.editReply({ 
    content: `✅ Created shopping list "${title}" with ${list.items.length} items! This list is now active in this channel.`
  });
}

async function handleAdd(interaction) {
  await interaction.deferReply({ flags: 64 });
  const itemInput = interaction.options.getString('item');
  const quantity = interaction.options.getInteger('quantity') || 1;
  const channelId = interaction.channel.id;

  // Get active list in this channel
  const active = storage.getActiveList(channelId);
  if (!active) {
    const titles = storage.getAllListTitles();
    if (titles.length === 0) {
      return interaction.editReply({ 
        content: '❌ No shopping lists exist. Create one first with `/shop create`'
      });
    }
    return interaction.editReply({ 
      content: `❌ No active list in this channel. Use \`/shop list "${titles[0]}"\` to display a list here first.`
    });
  }

  const { listId, list } = active;

  // Parse multiple items separated by semicolons
  const items = itemInput.split(';').map(item => item.trim()).filter(item => item.length > 0);
  
  if (items.length === 0) {
    return interaction.editReply({ 
      content: '❌ Please provide at least one valid item.'
    });
  }

  // Add each item to the list
  let addedItems = [];
  for (const item of items) {
    storage.addItem(listId, item, quantity);
    const itemText = quantity > 1 ? `${item} (${quantity})` : item;
    addedItems.push(itemText);
  }

  // Update the shopping list message
  const message = await messageCache.getMessage(interaction.channel, list.messageId);
  
  if (!message) {
    // Message was deleted, clear the reference
    storage.clearListMessage(listId);
    return interaction.editReply({ 
      content: `⚠️ The shopping list message was deleted. Items were added, but you'll need to use \`/shop list\` to display the list again.`
    });
  }
  
  const updatedList = storage.getList(listId);
  const embed = createShoppingListEmbed(updatedList);
  const buttons = createShoppingListButtons(updatedList);
  await message.edit({ embeds: [embed], components: buttons });
  messageCache.updateCache(message);
  
  const resultText = items.length === 1 
    ? `✅ Added "${addedItems[0]}" to ${list.title}!`
    : `✅ Added ${items.length} items to ${list.title}:\n• ${addedItems.join('\n• ')}`;
    
  await interaction.editReply({ 
    content: resultText
  });
}

async function handleList(interaction) {
  // Defer FIRST immediately to avoid timeout
  await interaction.deferReply({ flags: 64 });

  // Determine target list: by title or current channel's active list
  const titleOption = interaction.options.getString('title');
  const channelId = interaction.channel.id;
  let listId, list;
  
  if (titleOption) {
    const found = storage.getListByTitle(titleOption);
    if (!found) {
      const titles = storage.getAllListTitles();
      return interaction.editReply({ content: `❌ No list titled "${titleOption}". Available titles: ${titles.join(', ')}` });
    }
    listId = found.listId;
    list = found.list;
  } else {
    const active = storage.getActiveList(channelId);
    if (active) {
      listId = active.listId;
      list = active.list;
    }
  }

  if (!list) {
    const titles = storage.getAllListTitles();
    if (titles.length === 0) {
      return interaction.editReply({ content: '❌ No lists exist. Create one with `/shop create`' });
    }
    return interaction.editReply({ 
      content: `❌ No active list in this channel.\n\n**Available lists:**\n${titles.map(t => `• ${t}`).join('\n')}\n\nUse \`/shop list "${titles[0]}"\` to display one.`
    });
  }
  
  // Set as active list for this channel
  storage.setActiveList(channelId, listId);
  
  // Update acknowledgment
  await interaction.editReply({ 
    content: `🔄 Displaying "${list.title}"...`
  });
  
  // Delete old message if it exists
  if (list.messageId) {
    try {
      const oldChannel = list.channelId ? interaction.client.channels.cache.get(list.channelId) : interaction.channel;
      if (oldChannel) {
        const oldMessage = await messageCache.getMessage(oldChannel, list.messageId);
        if (oldMessage) {
          await oldMessage.delete();
          console.log('Deleted old shopping list message');
        }
        messageCache.invalidate(list.messageId);
      }
    } catch (error) {
      console.log('Could not delete old message (might already be deleted)');
      messageCache.invalidate(list.messageId);
    }
  }
  
  const embed = createShoppingListEmbed(list);
  const buttons = createShoppingListButtons(list);
  
  // Send new public message with the shopping list and buttons
  const message = await interaction.channel.send({ embeds: [embed], components: buttons });
  
  // Update stored message ID and cache
  storage.setMessageId(listId, message.id);
  messageCache.updateCache(message);
  
  // Update the ephemeral reply
  await interaction.editReply({ 
    content: `✅ "${list.title}" is now active in this channel!`
  });
}

async function handleClear(interaction) {
  await interaction.deferReply({ flags: 64 });
  const channelId = interaction.channel.id;
  const active = storage.getActiveList(channelId);
  
  if (!active) {
    return interaction.editReply({ 
      content: '❌ No active shopping list in this channel.'
    });
  }
  
  const { listId, list } = active;
  storage.clearList(listId);
  
  // Update the message
  if (list.messageId) {
    try {
      const message = await messageCache.getMessage(interaction.channel, list.messageId);
      if (message) {
        const updatedList = storage.getList(listId);
        const embed = createShoppingListEmbed(updatedList);
        const buttons = createShoppingListButtons(updatedList);
        await message.edit({ embeds: [embed], components: buttons });
        messageCache.updateCache(message);
      } else {
        // Message was deleted
        storage.clearListMessage(listId);
      }
    } catch (error) {
      console.error('Error updating message after clear:', error);
    }
  }
  await interaction.editReply({ 
    content: `✅ Cleared all items from "${list.title}"!`
  });
}

async function handleLists(interaction) {
  await interaction.deferReply({ flags: 64 });
  
  const allLists = storage.getAllLists();
  
  if (allLists.length === 0) {
    return interaction.editReply({ 
      content: '📝 No shopping lists exist yet.\n\nCreate your first list with `/shop create "My List"`'
    });
  }
  
  const channelId = interaction.channel.id;
  const active = storage.getActiveList(channelId);
  
  let listText = `📋 **Available Shopping Lists** (${allLists.length})\n\n`;
  
  allLists.forEach(({ listId, list }) => {
    const isActive = active && active.listId === listId;
    const itemCount = list.items.length;
    const checkedCount = list.items.filter(i => i.checked).length;
    const status = itemCount === 0 ? '📝 Empty' : `${checkedCount}/${itemCount} complete`;
    const marker = isActive ? '🔹 **' : '▫️ ';
    const endMarker = isActive ? '** (active here)' : '';
    
    listText += `${marker}${list.title}${endMarker} - ${status}\n`;
  });
  
  listText += `\n💡 Use \`/shop list "ListName"\` to display a list in this channel.`;
  
  await interaction.editReply({ content: listText });
}

async function handleHelp(interaction) {
  await interaction.deferReply({ flags: 64 });
  const embed = createInstructionEmbed();
  await interaction.editReply({ embeds: [embed], flags: 64 });
}

// Reaction helpers removed in favor of button + modal workflows