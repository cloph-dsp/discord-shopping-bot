const {
  ActionRowBuilder,
  Events,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const storage = require('../utils/storage');
const { createShoppingListEmbed } = require('../utils/embeds');
const { createShoppingListButtons, disableAllButtons } = require('../utils/buttons');
const messageCache = require('../utils/messageCache');

// Track ongoing operations per message to prevent race conditions
const operationLocks = new Map(); // lockId -> Promise

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('addItemModal:')) {
        await handleAddItemModalSubmit(interaction);
      } else if (interaction.customId.startsWith('editItemModal:')) {
        await handleEditItemModalSubmit(interaction);
      }
      return;
    }

    if (!interaction.isButton()) return;

    const messageId = interaction.message.id;
    // OPTIMIZATION: For modal buttons (add/edit), we only need the list ID and title
    // Don't fetch full list data which includes all items (expensive)
    const customId = interaction.customId;
    
    if (customId === 'add_item' || customId === 'edit_item') {
      // Quick lookup: only get list ID and title for modals
      let listId, listTitle;
      try {
        const row = storage.db.prepare('SELECT id, title FROM lists WHERE messageId = ?').get(messageId);
        if (!row) {
          return interaction.reply({
            content: '❌ This shopping list no longer exists.',
            ephemeral: true
          });
        }
        listId = row.id;
        listTitle = row.title;
      } catch (error) {
        console.error('Error fetching list for modal:', error);
        return interaction.reply({
          content: '❌ An error occurred. Please try again.',
          ephemeral: true
        });
      }

      console.log(`[BUTTON] ${interaction.user.tag} clicked: ${customId} on list: ${listTitle}`);

      if (customId === 'add_item') {
        try {
          await showAddItemModal(interaction, listTitle, listId);
        } catch (error) {
          console.error('Failed to show add modal:', error);
          try {
            if (!interaction.replied && !interaction.deferred) {
              await interaction.reply({ content: '❌ Failed to show add modal. Please try again.', flags: 64 });
            }
          } catch (e) {
            console.error('Failed to send error reply:', e);
          }
        }
        return;
      }

      if (customId === 'edit_item') {
        try {
          // For edit, we need to check if there are items - do a quick count
          const itemCount = storage.db.prepare('SELECT COUNT(*) as count FROM items WHERE listId = ?').get(listId);
          if (itemCount.count === 0) {
            await interaction.reply({ content: '❌ No items to edit.', flags: 64 });
            return;
          }
        } catch (e) {
          console.error('Error checking items:', e);
        }
        
        try {
          await showEditItemModal(interaction, listTitle, listId);
        } catch (error) {
          console.error('Failed to show edit modal:', error);
          try {
            if (!interaction.replied && !interaction.deferred) {
              await interaction.reply({ content: '❌ Failed to show edit modal. Please try again.', flags: 64 });
            }
          } catch (e) {
            console.error('Failed to send error reply:', e);
          }
        }
        return;
      }
    }

    // For non-modal buttons, fetch full list data
    const found = storage.getListByMessageId(messageId);

    if (!found) {
      return interaction.reply({
        content: '❌ This shopping list no longer exists.',
        ephemeral: true
      });
    }

    const { listId, list } = found;

    // For other buttons: defer FIRST (before queuing), then queue the operation
    try {
      await interaction.deferReply({ flags: 64 });
    } catch (error) {
      console.error('Error deferring interaction:', error);
      return;
    }

    // Now queue the operation without blocking the defer
    const operation = async () => {
      try {
        if (customId.startsWith('toggle_')) {
          const itemId = customId.split('_')[1];
          await handleToggleItem(interaction, listId, itemId);
        } else if (customId === 'clear_completed') {
          await handleClearCompleted(interaction, listId);
        } else if (customId === 'refresh_list') {
          await handleRefresh(interaction, listId);
        }
      } catch (error) {
        console.error('Error handling button operation:', error);
        try {
          await interaction.editReply({
            content: '❌ An error occurred while processing your request.'
          });
        } catch (editError) {
          console.error('Failed to edit reply after error:', editError);
        }
      }
    };

    // Fire and forget - operation runs in the background
    queueMessageOperation(messageId, operation).catch(err => {
      console.error('Queued operation failed:', err);
    });
  }
};

async function handleToggleItem(interaction, listId, itemId) {
  const list = storage.getList(listId);
  if (!list) {
    await interaction.editReply({ content: '❌ List not found.' });
    return;
  }

  const item = list.items.find(i => i.id === itemId);
  if (!item) {
    await interaction.editReply({ content: '❌ Item not found.' });
    return;
  }

  const channel = await resolveChannel(interaction.client, list.channelId, interaction.channel);
  await disableButtonsOnMessage(list, channel);

  const updatedItem = storage.toggleItemChecked(listId, itemId);
  await refreshListMessage(interaction.client, listId, channel);

  const isCheckedNow = updatedItem ? updatedItem.checked : !item.checked;
  const emoji = isCheckedNow ? '✅' : '⬜';
  const status = isCheckedNow ? 'checked' : 'unchecked';

  await interaction.editReply({
    content: `${emoji} ${status.charAt(0).toUpperCase() + status.slice(1)}: **${updatedItem?.text || item.text}**`
  });
}

async function handleClearCompleted(interaction, listId) {
  const list = storage.getList(listId);
  if (!list) {
    await interaction.editReply({ content: '❌ List not found.' });
    return;
  }

  const channel = await resolveChannel(interaction.client, list.channelId, interaction.channel);
  await disableButtonsOnMessage(list, channel);

  const clearedCount = storage.clearCompletedItems(listId);
  await refreshListMessage(interaction.client, listId, channel);

  if (clearedCount > 0) {
    await interaction.editReply({ content: `🧹 Cleared ${clearedCount} completed item${clearedCount === 1 ? '' : 's'}!` });
  } else {
    await interaction.editReply({ content: 'No completed items to clear.' });
  }
}

async function handleRefresh(interaction, listId) {
  const list = storage.getList(listId);
  if (!list) {
    await interaction.editReply({ content: '❌ List not found.' });
    return;
  }

  const channel = await resolveChannel(interaction.client, list.channelId, interaction.channel);
  await disableButtonsOnMessage(list, channel);
  await refreshListMessage(interaction.client, listId, channel);

  await interaction.editReply({ content: '🔄 List refreshed!' });
}

async function handleAddItemModalSubmit(interaction) {
  const [, listId] = interaction.customId.split(':');
  const itemsRaw = interaction.fields.getTextInputValue('add_item_input').trim();
  const items = itemsRaw.split(';').map(item => item.trim()).filter(Boolean);

  if (items.length === 0) {
    return interaction.reply({ content: '❌ Please provide at least one item.', flags: 64 });
  }

  try {
    await interaction.deferReply({ flags: 64 });
  } catch (error) {
    console.error('Error deferring modal submit:', error);
    return;
  }

  const list = storage.getList(listId);
  if (!list) {
    await interaction.editReply({ content: '❌ List no longer exists.' });
    return;
  }

  const lockId = list.messageId || `list:${listId}`;

  try {
    await queueMessageOperation(lockId, async () => {
      const currentList = storage.getList(listId);
      if (!currentList) return;
      const channel = await resolveChannel(interaction.client, currentList.channelId, interaction.channel);
      await disableButtonsOnMessage(currentList, channel);
      items.forEach(item => storage.addItem(listId, item));
      await refreshListMessage(interaction.client, listId, channel);
    });

    const resultText = items.length === 1
      ? `➕ Added "${items[0]}" to the shopping list.`
      : `➕ Added ${items.length} items to the shopping list:\n• ${items.join('\n• ')}`;

    await interaction.editReply({ content: resultText });
  } catch (error) {
    console.error('Add modal error:', error);
    await interaction.editReply({ content: '❌ Failed to add items. Please try again.' });
  }
}

async function handleEditItemModalSubmit(interaction) {
  const [, listId] = interaction.customId.split(':');
  const itemNumberRaw = interaction.fields.getTextInputValue('edit_item_index').trim();
  const newText = interaction.fields.getTextInputValue('edit_item_text').trim();

  const itemIndex = Number.parseInt(itemNumberRaw, 10) - 1;
  if (!Number.isInteger(itemIndex) || itemIndex < 0) {
    return interaction.reply({ content: '❌ Please provide a valid item number.', flags: 64 });
  }

  if (!newText) {
    return interaction.reply({ content: '❌ New text cannot be empty.', flags: 64 });
  }

  try {
    await interaction.deferReply({ flags: 64 });
  } catch (error) {
    console.error('Error deferring modal submit:', error);
    return;
  }

  const list = storage.getList(listId);
  if (!list) {
    await interaction.editReply({ content: '❌ List no longer exists.' });
    return;
  }

  if (itemIndex >= list.items.length) {
    await interaction.editReply({ content: `❌ Please choose a number between 1 and ${list.items.length}.` });
    return;
  }

  const targetItem = list.items[itemIndex];
  const lockId = list.messageId || `list:${listId}`;

  try {
    await queueMessageOperation(lockId, async () => {
      const currentList = storage.getList(listId);
      if (!currentList) return;
      const channel = await resolveChannel(interaction.client, currentList.channelId, interaction.channel);
      await disableButtonsOnMessage(currentList, channel);
      storage.editItem(listId, targetItem.id, newText);
      await refreshListMessage(interaction.client, listId, channel);
    });

    await interaction.editReply({ content: `✏️ Updated "${targetItem.text}" → "${newText}".` });
  } catch (error) {
    console.error('Edit modal error:', error);
    await interaction.editReply({ content: '❌ Failed to edit the item. Please try again.' });
  }
}

async function showAddItemModal(interaction, listTitle, listId) {
  const modal = new ModalBuilder()
    .setCustomId(`addItemModal:${listId}`)
    .setTitle(`Add Items — ${truncate(listTitle, 45)}`);

  const itemsInput = new TextInputBuilder()
    .setCustomId('add_item_input')
    .setLabel('Items (use ; to separate)')
    .setPlaceholder('milk;bread;eggs')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(itemsInput));
  await interaction.showModal(modal);
}

async function showEditItemModal(interaction, listTitle, listId) {
  const modal = new ModalBuilder()
    .setCustomId(`editItemModal:${listId}`)
    .setTitle(`Edit Item — ${truncate(listTitle, 45)}`);

  const indexInput = new TextInputBuilder()
    .setCustomId('edit_item_index')
    .setLabel('Item number (1-99)')
    .setPlaceholder('1')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const textInput = new TextInputBuilder()
    .setCustomId('edit_item_text')
    .setLabel('New item text')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(indexInput),
    new ActionRowBuilder().addComponents(textInput)
  );

  await interaction.showModal(modal);
}

async function disableButtonsOnMessage(list, channel) {
  if (!list?.messageId || !channel) return null;

  try {
    const message = await messageCache.getMessage(channel, list.messageId);
    if (!message) {
      storage.clearListMessage(list.id);
      return null;
    }

    const disabledRows = disableAllButtons(createShoppingListButtons(list));
    await message.edit({ embeds: [createShoppingListEmbed(list)], components: disabledRows });
    messageCache.updateCache(message);
    return message;
  } catch (error) {
    console.error('Failed to disable buttons:', error);
    return null;
  }
}

async function refreshListMessage(client, listId, channelHint) {
  const list = storage.getList(listId);
  if (!list || !list.messageId) {
    return null;
  }

  const channel = await resolveChannel(client, list.channelId, channelHint);
  if (!channel) {
    return null;
  }

  try {
    const message = await messageCache.getMessage(channel, list.messageId);
    if (!message) {
      storage.clearListMessage(listId);
      return null;
    }

    const embed = createShoppingListEmbed(list);
    const buttons = createShoppingListButtons(list);
    await message.edit({ embeds: [embed], components: buttons });
    messageCache.updateCache(message);
    return message;
  } catch (error) {
    console.error('Failed to refresh list message:', error);
    return null;
  }
}

async function resolveChannel(client, channelId, fallbackChannel) {
  if (fallbackChannel && (!channelId || fallbackChannel.id === channelId)) {
    return fallbackChannel;
  }

  if (!channelId) {
    return fallbackChannel || null;
  }

  const cached = client.channels.cache.get(channelId);
  if (cached) {
    return cached;
  }

  try {
    return await client.channels.fetch(channelId);
  } catch (error) {
    console.error(`Unable to fetch channel ${channelId}:`, error);
    return fallbackChannel || null;
  }
}

function queueMessageOperation(lockId, task) {
  const previous = operationLocks.get(lockId);
  const run = previous
    ? previous.then(() => task())
    : task();

  operationLocks.set(lockId, run);

  run.finally(() => {
    if (operationLocks.get(lockId) === run) {
      operationLocks.delete(lockId);
    }
  });

  return run;
}

function truncate(text, max) {
  if (!text) return '';
  if (text.length <= max) return text;
  const safeMax = Math.max(max - 3, 0);
  return `${text.slice(0, safeMax)}...`;
}
