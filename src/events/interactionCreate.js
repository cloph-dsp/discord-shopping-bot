const {
  ActionRowBuilder,
  Events,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags
} = require('discord.js');
const storage = require('../utils/storage');
const { createShoppingListEmbed } = require('../utils/embeds');
const { createShoppingListButtons, disableAllButtons } = require('../utils/buttons');
const messageCache = require('../utils/messageCache');

// ponytail: removed queueMessageOperation (caused deadlocks).
// DB ops are sync, Discord message.edit is idempotent — no queue needed.

const truncate = (str, len) => str.length > len ? str.substring(0, len - 3) + '...' : str;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms))
  ]);
}

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
            await interaction.followUp({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
          } else {
            await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
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
          await interaction.reply({ content: '⚠️ Button response timeout. Please try again.', flags: MessageFlags.Ephemeral });
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
          const row = storage.getListIdAndTitleByMessageId(messageId);
          if (!row) {
            return interaction.reply({
              content: '❌ This shopping list no longer exists.',
              flags: MessageFlags.Ephemeral
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
          const row = storage.getListIdAndTitleByMessageId(messageId);
          if (!row) {
            return interaction.reply({
              content: '❌ This shopping list no longer exists.',
              flags: MessageFlags.Ephemeral
            });
          }

          const listId = row.id;
          const listTitle = row.title;

          // Check if there are items to edit
          const itemCount = storage.countItemsByListId(listId);
          if (itemCount === 0) {
            return interaction.reply({ content: '❌ No items to edit.', flags: MessageFlags.Ephemeral });
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
            await interaction.reply({ content: '❌ Failed to open form. Try again.', flags: MessageFlags.Ephemeral });
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
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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

    // Run operation directly (queue removed — was causing deadlocks)
    try {
      if (customId.startsWith('toggle_')) {
        const itemId = customId.split('_')[1];
        console.log(`[TOGGLE] Starting toggle for item ${itemId}`);
        await withTimeout(handleToggleItem(interaction, listId, itemId), 10000, `toggle ${itemId}`);
        console.log(`[TOGGLE] Completed toggle for item ${itemId}`);
      } else if (customId === 'clear_completed') {
        await withTimeout(handleClearCompleted(interaction, listId), 10000, 'clear_completed');
      } else if (customId === 'refresh_list') {
        await withTimeout(handleRefresh(interaction, listId), 10000, 'refresh_list');
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
  }
};

// ===== BUTTON OPERATION HANDLERS =====

async function handleToggleItem(interaction, listId, itemId) {
  console.log(`[TOGGLE:H] handleToggleItem start listId=${listId}`);
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

  console.log(`[TOGGLE:H] resolveChannel start`);
  const channel = await resolveChannel(interaction.client, list.channelId, interaction.channel);
  console.log(`[TOGGLE:H] resolveChannel done`);

  const updatedItem = storage.toggleItemChecked(listId, itemId);
  console.log(`[TOGGLE:H] toggle done, refreshListMessage start`);
  await refreshListMessage(interaction.client, listId, channel, false);
  console.log(`[TOGGLE:H] refreshListMessage done`);

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

  const clearedCount = storage.clearCompletedItems(listId);
  await refreshListMessage(interaction.client, listId, channel, false);

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
  await refreshListMessage(interaction.client, listId, channel, false);

  await interaction.editReply({ content: '🔄 List refreshed!' });
}

// ===== MODAL SUBMISSION HANDLERS =====

async function handleAddItemModalSubmit(interaction) {
  // Defer IMMEDIATELY before any processing
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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

  try {
    const channel = await withTimeout(
      resolveChannel(interaction.client, list.channelId, interaction.channel),
      5000, 'resolve channel add'
    );
    items.forEach(item => storage.addItem(listId, item));
    await withTimeout(refreshListMessage(interaction.client, listId, channel, false), 10000, 'refresh add');

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
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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
    const channel = await withTimeout(
      resolveChannel(interaction.client, list.channelId, interaction.channel),
      5000, 'resolve channel edit'
    );
    storage.editItem(listId, targetItem.id, newText);
    await withTimeout(refreshListMessage(interaction.client, listId, channel, false), 10000, 'refresh edit');

    await interaction.editReply({ content: `✏️ Updated "${targetItem.text}" → "${newText}".` });
  } catch (error) {
    console.error('Edit modal error:', error);
    await interaction.editReply({ content: '❌ Failed to edit the item. Please try again.' });
  }
}

// ===== UTILITY FUNCTIONS =====

async function refreshListMessage(client, listId, channelHint, disableButtons = false) {
  const list = storage.getList(listId);
  if (!list || !list.messageId) {
    console.log(`[REFRESH] no list or messageId for ${listId}`);
    return null;
  }

  console.log(`[REFRESH] resolveChannel start`);
  const channel = await resolveChannel(client, list.channelId, channelHint);
  if (!channel) {
    console.log(`[REFRESH] no channel`);
    return null;
  }
  console.log(`[REFRESH] resolveChannel done, fetching message`);

  try {
    const message = await withTimeout(messageCache.getMessage(channel, list.messageId), 5000, 'fetch message');
    console.log(`[REFRESH] message fetched: ${!!message}`);
    if (!message) {
      storage.clearListMessage(listId);
      return null;
    }

    const embed = createShoppingListEmbed(list);
    const buttons = disableButtons
      ? disableAllButtons(createShoppingListButtons(list))
      : createShoppingListButtons(list);
    await withTimeout(message.edit({ embeds: [embed], components: buttons }), 5000, 'edit message');
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
    console.log(`[RESOLVE] fetching channel ${channelId}`);
    const result = await withTimeout(client.channels.fetch(channelId), 5000, 'fetch channel');
    console.log(`[RESOLVE] fetched channel ${channelId}`);
    return result;
  } catch (error) {
    console.log('Could not fetch channel, using fallback:', error.message);
    return fallbackChannel;
  }
}


