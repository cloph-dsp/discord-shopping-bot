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
const operationLocks = new Map();

const truncate = (str, len) => str.length > len ? str.substring(0, len - 3) + '...' : str;

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    const startTime = Date.now();
    
    // ===== AUTOCOMPLETE =====
    if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (command && typeof command.autocomplete === 'function') {
        try {
          await command.autocomplete(interaction);
        } catch (error) {
          console.error('Autocomplete error:', error);
        }
      }
      return;
    }

    // ===== SLASH COMMANDS =====
    if (interaction.isChatInputCommand()) {
      console.log(`[COMMAND] Received: ${interaction.commandName} from ${interaction.user.tag} at ${startTime}`);

      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
      }

      try {
        console.log(`[COMMAND] Executing: ${interaction.commandName}`);
        await command.execute(interaction);
        console.log(`[COMMAND] Completed: ${interaction.commandName}`);
      } catch (error) {
        console.error('Command execution error:', error);
        console.error('Stack trace:', error.stack);
        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error while executing this command!', flags: 64 });
          } else {
            await interaction.reply({ content: 'There was an error while executing this command!', flags: 64 });
          }
        } catch (followUpError) {
          console.error('Error sending error message:', followUpError);
        }
      }
      return;
    }

    // ===== MODALS =====
    if (interaction.isModalSubmit()) {
      console.log(`[MODAL] Processing modal: ${interaction.customId}`);
      if (interaction.customId.startsWith('addItemModal:')) {
        await handleAddItemModalSubmit(interaction);
      } else if (interaction.customId.startsWith('editItemModal:')) {
        await handleEditItemModalSubmit(interaction);
      }
      return;
    }

    // ===== BUTTONS =====
    if (!interaction.isButton()) return;

    const customId = interaction.customId;
    const messageId = interaction.message.id;

    // ===== MODAL BUTTONS (add_item, edit_item) =====
    // These must be shown within 3 seconds - NO DEFERRED OR OTHER DELAYS
    if (customId === 'add_item' || customId === 'edit_item') {
      const elapsed = Date.now() - startTime;
      console.log(`[BUTTON] Modal button detected: ${customId}, elapsed: ${elapsed}ms`);
      
      // Check if interaction is already too old (Discord has 3000ms window)
      if (elapsed > 2500) {
        console.error(`[BUTTON] Interaction too old (${elapsed}ms), aborting modal display`);
        try {
          await interaction.reply({ content: '⚠️ Button response timeout. Please try again.', flags: 64 });
        } catch (e) {
          console.error('Could not send timeout message:', e.message);
        }
        return;
      }
      // Fast path: build modal immediately and show it
      try {
        let modal;

        if (customId === 'add_item') {
          // Get list ID and title synchronously (0ms operation)
          const row = storage.db.prepare('SELECT id, title FROM lists WHERE messageId = ?').get(messageId);
          if (!row) {
            return interaction.reply({
              content: '❌ This shopping list no longer exists.',
              ephemeral: true
            });
          }

          const listId = row.id;
          const listTitle = row.title;

          // Build modal
          modal = new ModalBuilder()
            .setCustomId(`addItemModal:${listId}`)
            .setTitle(`Add Items — ${truncate(listTitle, 45)}`);

          const itemsInput = new TextInputBuilder()
            .setCustomId('add_item_input')
            .setLabel('Items (use ; to separate)')
            .setPlaceholder('milk;bread;eggs')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(itemsInput));
        } else if (customId === 'edit_item') {
          // Get list ID and title synchronously
          const row = storage.db.prepare('SELECT id, title FROM lists WHERE messageId = ?').get(messageId);
          if (!row) {
            return interaction.reply({
              content: '❌ This shopping list no longer exists.',
              ephemeral: true
            });
          }

          const listId = row.id;
          const listTitle = row.title;

          // Check if there are items to edit
          const itemCount = storage.db.prepare('SELECT COUNT(*) as count FROM items WHERE listId = ?').get(listId);
          if (itemCount.count === 0) {
            return interaction.reply({ content: '❌ No items to edit.', flags: 64 });
          }

          // Build modal
          modal = new ModalBuilder()
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
        }

        // Show modal - THIS MUST SUCCEED WITHIN 3 SECONDS
        if (modal) {
          console.log(`[BUTTON] About to call showModal for ${customId}, elapsed: ${Date.now() - startTime}ms`);
          await interaction.showModal(modal);
          console.log(`[BUTTON] Modal shown successfully for ${customId}, elapsed: ${Date.now() - startTime}ms`);
        }
        return;
      } catch (error) {
        // If modal fails, try to reply (this might also fail if >3 seconds)
        console.error(`Error showing modal for button ${customId}:`, error.message);
        try {
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Failed to open form. Try again.', flags: 64 });
          }
        } catch (e) {
          console.error('Could not send error reply:', e.message);
        }
        return;
      }
    }

    // ===== OTHER BUTTONS (toggle, clear, refresh) =====
    // Defer immediately to avoid timeouts
    console.log(`[BUTTON] Non-modal button detected: ${customId}, elapsed: ${Date.now() - startTime}ms, about to defer...`);
    try {
      await interaction.deferReply({ flags: 64 });
      console.log(`[BUTTON] Deferred successfully for ${customId}, elapsed: ${Date.now() - startTime}ms`);
    } catch (error) {
      console.error(`[BUTTON] Error deferring interaction for ${customId}, elapsed: ${Date.now() - startTime}ms:`, error.message);
      return;
    }

    // Get full list data for other button types
    const found = storage.getListByMessageId(messageId);
    if (!found) {
      await interaction.editReply({ content: '❌ This shopping list no longer exists.' });
      return;
    }

    const { listId, list } = found;

    // Queue the operation to prevent race conditions
    queueMessageOperation(messageId, async () => {
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
        console.error('Error in button operation:', error);
        try {
          await interaction.editReply({
            content: '❌ An error occurred while processing your request.'
          });
        } catch (editError) {
          console.error('Failed to edit reply after error:', editError);
        }
      }
    }).catch(err => {
      console.error('Queued operation failed:', err);
    });
  }
};

// ===== BUTTON OPERATION HANDLERS =====

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

// ===== MODAL SUBMISSION HANDLERS =====

async function handleAddItemModalSubmit(interaction) {
  // Defer IMMEDIATELY before any processing
  try {
    await interaction.deferReply({ flags: 64 });
  } catch (error) {
    console.error('Error deferring modal submit:', error);
    return;
  }

  const [, listId] = interaction.customId.split(':');
  const itemsRaw = interaction.fields.getTextInputValue('add_item_input').trim();
  const items = itemsRaw.split(';').map(item => item.trim()).filter(Boolean);

  if (items.length === 0) {
    return interaction.editReply({ content: '❌ Please provide at least one item.' });
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
    console.error('Error adding items:', error);
    await interaction.editReply({ content: '❌ Failed to add items.' });
  }
}

async function handleEditItemModalSubmit(interaction) {
  // Defer IMMEDIATELY before any processing
  try {
    await interaction.deferReply({ flags: 64 });
  } catch (error) {
    console.error('Error deferring modal submit:', error);
    return;
  }

  const [, listId] = interaction.customId.split(':');
  const indexStr = interaction.fields.getTextInputValue('edit_item_index').trim();
  const newText = interaction.fields.getTextInputValue('edit_item_text').trim();

  const index = parseInt(indexStr) - 1;

  const list = storage.getList(listId);
  if (!list) {
    await interaction.editReply({ content: '❌ List no longer exists.' });
    return;
  }

  if (index < 0 || index >= list.items.length) {
    await interaction.editReply({ content: `❌ Invalid item number. List has ${list.items.length} items.` });
    return;
  }

  try {
    const targetItem = list.items[index];
    const lockId = list.messageId || `list:${listId}`;

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

// ===== UTILITY FUNCTIONS =====

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
  if (!channelId) return fallbackChannel;

  try {
    return await client.channels.fetch(channelId);
  } catch (error) {
    console.log('Could not fetch channel, using fallback');
    return fallbackChannel;
  }
}

function queueMessageOperation(lockId, task) {
  if (!operationLocks.has(lockId)) {
    operationLocks.set(lockId, Promise.resolve());
  }

  const currentLock = operationLocks.get(lockId);
  const newLock = currentLock.then(() => task()).catch(err => {
    console.error('Operation error:', err);
  });

  operationLocks.set(lockId, newLock);
  return newLock;
}
