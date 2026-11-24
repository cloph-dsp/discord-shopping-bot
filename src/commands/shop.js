const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const storage = require('../utils/storage');
const { createShoppingListEmbed, createInstructionEmbed } = require('../utils/embeds');
const { createShoppingListButtons } = require('../utils/buttons');
const messageCache = require('../utils/messageCache');

const guildIdOf = interaction => interaction.guild?.id || 'dm';

// Cache autocomplete results per guild to speed up responses without leaking
// list titles between servers.
const autocompleteCache = new Map();
const AUTOCOMPLETE_TTL = 5000;

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
        .setName('sort')
        .setDescription('Sort the active shopping list by item name'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Delete a shopping list (asks for confirmation)')
        .addStringOption(option =>
          option.setName('title')
            .setDescription('Title of the list to delete')
            .setRequired(true)
            .setAutocomplete(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('help')
        .setDescription('Show help and instructions')),

  async execute(interaction) {
    const startTime = Date.now();
    const subcommand = interaction.options.getSubcommand();
    console.log(`[SHOP] Starting subcommand: ${subcommand} at ${startTime}`);

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
      case 'sort':
        await handleSort(interaction);
        break;
      case 'delete':
        await handleDelete(interaction);
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
      
      // Use cached titles for this guild if available and fresh
      const now = Date.now();
      const guildId = guildIdOf(interaction);
      let entry = autocompleteCache.get(guildId);
      if (!entry || now - entry.lastUpdate > AUTOCOMPLETE_TTL) {
        entry = { titles: storage.getAllListTitles(guildId), lastUpdate: now };
        autocompleteCache.set(guildId, entry);
      }

      // Quick filter and limit to 25 results
      // Use includes() instead of startsWith() for better UX
      const filtered = entry.titles
        .filter(title => title.toLowerCase().includes(focused.toLowerCase()))
        .slice(0, 25);
      
      // Respond immediately with timeout protection
      const responsePromise = interaction.respond(
        filtered.map(title => ({ name: title, value: title }))
      );
      
      // Add a timeout to prevent hanging on slow connections
      let timer;
      await Promise.race([
        responsePromise,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Autocomplete timeout')), 2500);
        })
      ]).finally(() => clearTimeout(timer));
    } catch (error) {
      // Silently fail - autocomplete errors shouldn't crash the bot
      console.error('Autocomplete error:', error.message || error);
    }
  }
};

async function handleCreate(interaction) {
  // Defer FIRST before any other operations
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  } catch (error) {
    console.error('Failed to defer handleCreate:', error.message);
    return;
  }

  const title = interaction.options.getString('title');
  const itemsString = interaction.options.getString('items');
  const channelId = interaction.channel.id;

  // Check if list with this title already exists
  const existingList = storage.getListByTitle(title, guildIdOf(interaction));
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
  const list = storage.createList(title, items, guildIdOf(interaction));
  
  // Set as active list for this channel
  storage.setActiveList(channelId, list.id);
  storage.setListPage(list.id, 0);
  
  // Create and send the embed with buttons
  const embed = createShoppingListEmbed(list, 0);
  const buttons = createShoppingListButtons(list, 0);
  
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
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  } catch (error) {
    console.error('Failed to defer handleAdd:', error.message);
    return;
  }
  const itemInput = interaction.options.getString('item');
  const quantity = interaction.options.getInteger('quantity') || 1;
  const channelId = interaction.channel.id;

  // Get active list in this channel
  const active = storage.getActiveList(channelId);
  if (!active) {
    const titles = storage.getAllListTitles(guildIdOf(interaction));
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
    const itemText = quantity > 1 ? `${item} ×${quantity}` : item;
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
  const page = storage.setListPage(listId, storage.getListPage(listId)) ?? 0;
  const embed = createShoppingListEmbed(updatedList, page);
  const buttons = createShoppingListButtons(updatedList, page);
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
  const startTime = Date.now();
  console.log(`[SHOP:LIST] Starting defer at ${startTime}`);
  // Defer FIRST immediately to avoid timeout
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    console.log(`[SHOP:LIST] Deferred successfully after ${Date.now() - startTime}ms`);
  } catch (error) {
    console.error(`[SHOP:LIST] Failed to defer after ${Date.now() - startTime}ms:`, error.message);
    return;
  }

  // Determine target list: by title or current channel's active list
  const titleOption = interaction.options.getString('title');
  const channelId = interaction.channel.id;
  let listId, list;
  
  if (titleOption) {
    const found = storage.getListByTitle(titleOption, guildIdOf(interaction));
    if (!found) {
      const titles = storage.getAllListTitles(guildIdOf(interaction));
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
    const titles = storage.getAllListTitles(guildIdOf(interaction));
    if (titles.length === 0) {
      return interaction.editReply({ content: '❌ No lists exist. Create one with `/shop create`' });
    }
    return interaction.editReply({ 
      content: `❌ No active list in this channel.\n\n**Available lists:**\n${titles.map(t => `• ${t}`).join('\n')}\n\nUse \`/shop list "${titles[0]}"\` to display one.`
    });
  }
  
  // Set as active list for this channel
  storage.setActiveList(channelId, listId);
  storage.setListPage(listId, 0);
  
  // Update acknowledgment
  await interaction.editReply({ 
    content: `🔄 Displaying "${list.title}"...`
  });
  
  // Delete old message if it exists
  if (list.messageId) {
    console.log(`[SHOP:LIST] About to delete old message at ${Date.now() - startTime}ms`);
    try {
      const oldChannel = list.channelId ? interaction.client.channels.cache.get(list.channelId) : interaction.channel;
      if (oldChannel) {
        const oldMessage = await messageCache.getMessage(oldChannel, list.messageId);
        if (oldMessage) {
          await oldMessage.delete();
          console.log(`[SHOP:LIST] Deleted old message at ${Date.now() - startTime}ms`);
        }
        messageCache.invalidate(list.messageId);
      }
    } catch (error) {
      console.log('Could not delete old message (might already be deleted)');
      messageCache.invalidate(list.messageId);
    }
  }
  
  console.log(`[SHOP:LIST] About to create embed/buttons at ${Date.now() - startTime}ms`);
  const embed = createShoppingListEmbed(list, 0);
  const buttons = createShoppingListButtons(list, 0);
  
  console.log(`[SHOP:LIST] About to send message at ${Date.now() - startTime}ms`);
  // Send new public message with the shopping list and buttons
  const message = await interaction.channel.send({ embeds: [embed], components: buttons });
  console.log(`[SHOP:LIST] Message sent at ${Date.now() - startTime}ms`);
  
  // Update stored message ID and cache
  storage.setMessageId(listId, message.id);
  messageCache.updateCache(message);
  
  // Update the ephemeral reply
  await interaction.editReply({ 
    content: `✅ "${list.title}" is now active in this channel!`
  });
}

async function handleClear(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  } catch (error) {
    console.error('Failed to defer handleClear:', error.message);
    return;
  }
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
        const page = storage.setListPage(listId, storage.getListPage(listId)) ?? 0;
        const embed = createShoppingListEmbed(updatedList, page);
        const buttons = createShoppingListButtons(updatedList, page);
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
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  } catch (error) {
    console.error('Failed to defer handleLists:', error.message);
    return;
  }
  
  const allLists = storage.getAllLists(guildIdOf(interaction));
  
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

async function handleSort(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  } catch (error) {
    console.error('Failed to defer handleSort:', error.message);
    return;
  }

  const active = storage.getActiveList(interaction.channel.id);
  if (!active) {
    return interaction.editReply({ content: '❌ No active shopping list in this channel.' });
  }

  const { listId, list } = active;
  const count = storage.sortList(listId);
  storage.setListPage(listId, 0);

  if (list.messageId) {
    try {
      const channel = list.channelId
        ? await interaction.client.channels.fetch(list.channelId).catch(() => interaction.channel)
        : interaction.channel;
      const message = await messageCache.getMessage(channel, list.messageId);
      if (message) {
        const updated = storage.getList(listId);
        await message.edit({
          embeds: [createShoppingListEmbed(updated, 0)],
          components: createShoppingListButtons(updated, 0)
        });
        messageCache.updateCache(message);
      } else {
        storage.clearListMessage(listId);
      }
    } catch (error) {
      console.error('Error refreshing message after sort:', error.message);
    }
  }

  await interaction.editReply({ content: `🔤 Sorted ${count} item${count === 1 ? '' : 's'} in "${list.title}".` });
}

async function handleDelete(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  } catch (error) {
    console.error('Failed to defer handleDelete:', error.message);
    return;
  }

  const title = interaction.options.getString('title');
  const found = storage.getListByTitle(title, guildIdOf(interaction));
  if (!found) {
    const titles = storage.getAllListTitles(guildIdOf(interaction));
    return interaction.editReply({
      content: `❌ No list titled "${title}". Available: ${titles.join(', ') || 'none'}`
    });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`delete_yes:${found.listId}`)
      .setLabel('Delete')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🗑️'),
    new ButtonBuilder()
      .setCustomId(`delete_no:${found.listId}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.editReply({
    content: `⚠️ Delete "${title}" (${found.list.items.length} items)? This cannot be undone.`,
    components: [row]
  });
}

async function handleHelp(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  } catch (error) {
    console.error('Failed to defer handleHelp:', error.message);
    return;
  }
  const embed = createInstructionEmbed();
  await interaction.editReply({ embeds: [embed] });
}

// Reaction helpers removed in favor of button + modal workflows