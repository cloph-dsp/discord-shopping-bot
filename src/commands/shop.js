const { SlashCommandBuilder } = require('discord.js');
const storage = require('../utils/storage');
const { EMOJIS, createShoppingListEmbed, createInstructionEmbed } = require('../utils/embeds');

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
            .setDescription('Item to add')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('quantity')
            .setDescription('Quantity needed')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Display the current shopping list'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('clear')
        .setDescription('Clear the current shopping list'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('channel')
        .setDescription('Set the shopping list channel')
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('Channel for shopping lists')
            .setRequired(true)))
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
      case 'channel':
        await handleChannel(interaction);
        break;
      case 'help':
        await handleHelp(interaction);
        break;
    }
  },
};

async function handleCreate(interaction) {
  const title = interaction.options.getString('title');
  const itemsString = interaction.options.getString('items');
  const channelId = interaction.channel.id;
  const guildId = interaction.guild.id;

  // Check if this is the designated shopping channel
  const shoppingChannel = storage.getShoppingChannel(guildId);
  if (shoppingChannel && channelId !== shoppingChannel) {
    return interaction.reply({ 
      content: `❌ Please use the designated shopping channel: <#${shoppingChannel}>`,
      ephemeral: true 
    });
  }

  // Parse items
  let items = [];
  if (itemsString) {
    items = itemsString.split(';').map(item => item.trim()).filter(item => item.length > 0);
  }

  // Create the shopping list
  const list = storage.createList(channelId, title, items);
  
  // Create and send the embed as a regular message (not interaction reply)
  const embed = createShoppingListEmbed(list);
  
  // Send initial reply
  await interaction.reply({ 
    content: `✅ Creating shopping list "${title}"...`, 
    ephemeral: true 
  });
  
  // Send the actual shopping list as a separate message
  const message = await interaction.channel.send({ embeds: [embed] });
  
  console.log(`Created shopping list message with ID: ${message.id}`);
  
  // Store the message ID for reaction handling
  storage.setMessageId(channelId, message.id);
  
  // Add reactions for each item (with delay to ensure message is ready)
  setTimeout(async () => {
    try {
      await addReactionsToMessage(message, list);
    } catch (error) {
      console.error('Error adding reactions:', error);
      // Try to inform user of the issue
      await interaction.followUp({ 
        content: `⚠️ Created list but couldn't add reaction buttons. Bot might be missing "Add Reactions" permission.`,
        ephemeral: true 
      });
    }
  }, 1000);
  
  // Update the initial reply
  await interaction.editReply({ 
    content: `✅ Created shopping list "${title}" with ${list.items.length} items! Click the number emojis below to check items.`
  });
}

async function handleAdd(interaction) {
  const item = interaction.options.getString('item');
  const quantity = interaction.options.getInteger('quantity') || 1;
  const channelId = interaction.channel.id;

  const list = storage.getList(channelId);
  if (!list) {
    return interaction.reply({ 
      content: '❌ No shopping list found in this channel. Create one first with `/shop create`',
      ephemeral: true 
    });
  }

  storage.addItem(channelId, item, quantity);
  
  // Update the shopping list message
  const message = await interaction.channel.messages.fetch(list.messageId);
  const embed = createShoppingListEmbed(storage.getList(channelId));
  await message.edit({ embeds: [embed] });
  
  // Re-add reactions
  await addReactionsToMessage(message, storage.getList(channelId));
  
  const itemText = quantity > 1 ? `${item} (${quantity})` : item;
  await interaction.reply({ 
    content: `✅ Added "${itemText}" to the shopping list!`,
    ephemeral: true 
  });
}

async function handleList(interaction) {
  const channelId = interaction.channel.id;
  const list = storage.getList(channelId);

  if (!list) {
    return interaction.reply({ 
      content: '❌ No shopping list found in this channel. Create one first with `/shop create`',
      ephemeral: true 
    });
  }

  const embed = createShoppingListEmbed(list);
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleClear(interaction) {
  const channelId = interaction.channel.id;
  const list = storage.getList(channelId);

  if (!list) {
    return interaction.reply({ 
      content: '❌ No shopping list found in this channel.',
      ephemeral: true 
    });
  }

  storage.clearList(channelId);
  
  // Update the message
  if (list.messageId) {
    try {
      const message = await interaction.channel.messages.fetch(list.messageId);
      const embed = createShoppingListEmbed(storage.getList(channelId));
      await message.edit({ embeds: [embed] });
      await message.reactions.removeAll();
    } catch (error) {
      console.error('Error updating message after clear:', error);
    }
  }

  await interaction.reply({ 
    content: '✅ Shopping list cleared!',
    ephemeral: true 
  });
}

async function handleChannel(interaction) {
  const channel = interaction.options.getChannel('channel');
  const guildId = interaction.guild.id;

  // Check if user has permission to manage channels
  if (!interaction.member.permissions.has('MANAGE_CHANNELS')) {
    return interaction.reply({ 
      content: '❌ You need the "Manage Channels" permission to set the shopping channel.',
      ephemeral: true 
    });
  }

  storage.setShoppingChannel(guildId, channel.id);
  
  await interaction.reply({ 
    content: `✅ Set ${channel} as the shopping list channel!`,
    ephemeral: true 
  });
}

async function handleHelp(interaction) {
  const embed = createInstructionEmbed();
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function addReactionsToMessage(message, list) {
  try {
    if (list.items.length === 0) return;
    
    console.log(`Adding reactions for ${list.items.length} items...`);
    
    // Test with a simple emoji first
    await message.react('✅');
    console.log('✅ Test emoji added successfully');
    
    // Add number emojis for each item (up to 10 items)
    for (let i = 0; i < Math.min(list.items.length, EMOJIS.NUMBERS.length); i++) {
      try {
        await message.react(EMOJIS.NUMBERS[i]);
        console.log(`${EMOJIS.NUMBERS[i]} Added number emoji ${i + 1}`);
        // Small delay between reactions to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (emojiError) {
        console.error(`Failed to add emoji ${EMOJIS.NUMBERS[i]}:`, emojiError.message);
      }
    }
    
    // Add clear completed button if there are checked items
    const hasCheckedItems = list.items.some(item => item.checked);
    if (hasCheckedItems) {
      try {
        await message.react(EMOJIS.CLEAR_COMPLETED);
        console.log(`${EMOJIS.CLEAR_COMPLETED} Added clear completed emoji`);
      } catch (emojiError) {
        console.error('Failed to add clear completed emoji:', emojiError.message);
      }
    }
    
    // Add utility buttons
    try {
      await message.react(EMOJIS.ADD_ITEM);
      console.log(`${EMOJIS.ADD_ITEM} Added add item emoji`);
      await new Promise(resolve => setTimeout(resolve, 200));
      
      await message.react(EMOJIS.EDIT);
      console.log(`${EMOJIS.EDIT} Added edit emoji`);
    } catch (emojiError) {
      console.error('Failed to add utility emojis:', emojiError.message);
    }
    
    console.log(`Successfully added reactions to message`);
  } catch (error) {
    console.error('Error in addReactionsToMessage:', error);
    throw error; // Re-throw so caller can handle it
  }
}