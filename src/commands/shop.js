const { SlashCommandBuilder } = require('discord.js');
const storage = require('../utils/storage');
const { EMOJIS, createShoppingListEmbed, createInstructionEmbed } = require('../utils/embeds');
const { addReactionsToMessage } = require('../utils/reactions');

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
      flags: 64 // Ephemeral flag
    });
  }

  await interaction.deferReply({ flags: 64 });

  // Parse items
  let items = [];
  if (itemsString) {
    items = itemsString.split(';').map(item => item.trim()).filter(item => item.length > 0);
  }

  // Create the shopping list
  const list = storage.createList(channelId, title, items);
  // Create and send the embed as a regular message (not interaction reply)
  const embed = createShoppingListEmbed(list);
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
        flags: 64 // Ephemeral flag
      });
    }
  }, 5000);
  // Update the initial reply
  await interaction.editReply({ 
    content: `✅ Created shopping list "${title}" with ${list.items.length} items! Click the number emojis below to check items.`
  });
}

async function handleAdd(interaction) {
  await interaction.deferReply({ flags: 64 });
  const item = interaction.options.getString('item');
  const quantity = interaction.options.getInteger('quantity') || 1;
  const channelId = interaction.channel.id;

  const list = storage.getList(channelId);
  if (!list) {
    return interaction.editReply({ 
      content: '❌ No shopping list found in this channel. Create one first with `/shop create`',
      flags: 64 
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
  await interaction.editReply({ 
    content: `✅ Added "${itemText}" to the shopping list!`,
    flags: 64 
  });
}

async function handleList(interaction) {
  await interaction.deferReply({ flags: 64 });
  const channelId = interaction.channel.id;
  const list = storage.getList(channelId);
  if (!list) {
    return interaction.editReply({ 
      content: '❌ No shopping list found in this channel. Create one first with `/shop create`',
      flags: 64 
    });
  }
  
  // Delete old message if it exists
  if (list.messageId) {
    try {
      const oldMessage = await interaction.channel.messages.fetch(list.messageId);
      await oldMessage.delete();
      console.log('Deleted old shopping list message');
    } catch (error) {
      console.log('Could not delete old message (might already be deleted)');
    }
  }
  
  const embed = createShoppingListEmbed(list);
  
  // Send new public message with the shopping list
  const message = await interaction.channel.send({ embeds: [embed] });
  
  // Update stored message ID
  storage.setMessageId(channelId, message.id);
  
  // Add reactions with a delay
  setTimeout(async () => {
    try {
      await addReactionsToMessage(message, list);
      console.log('Added reactions to recalled shopping list');
    } catch (error) {
      console.error('Error adding reactions to recalled list:', error);
    }
  }, 1000);
  
  // Confirm with ephemeral reply
  await interaction.editReply({ 
    content: `✅ Shopping list "${list.title}" recalled and updated with fresh emoji buttons!`
  });
}

async function handleClear(interaction) {
  await interaction.deferReply({ flags: 64 });
  const channelId = interaction.channel.id;
  const list = storage.getList(channelId);
  if (!list) {
    return interaction.editReply({ 
      content: '❌ No shopping list found in this channel.',
      flags: 64 
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
  await interaction.editReply({ 
    content: '✅ Shopping list cleared!',
    flags: 64 
  });
}

async function handleChannel(interaction) {
  await interaction.deferReply({ flags: 64 });
  const channel = interaction.options.getChannel('channel');
  const guildId = interaction.guild.id;
  // Check if user has permission to manage channels
  if (!interaction.member.permissions.has('MANAGE_CHANNELS')) {
    return interaction.editReply({ 
      content: '❌ You need the "Manage Channels" permission to set the shopping channel.',
      flags: 64 
    });
  }
  storage.setShoppingChannel(guildId, channel.id);
  await interaction.editReply({ 
    content: `✅ Set ${channel} as the shopping list channel!`,
    flags: 64 
  });
}

async function handleHelp(interaction) {
  await interaction.deferReply({ flags: 64 });
  const embed = createInstructionEmbed();
  await interaction.editReply({ embeds: [embed], flags: 64 });
}

// addReactionsToMessage function moved to utils/reactions.js