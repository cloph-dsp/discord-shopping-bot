const { Events } = require('discord.js');
const storage = require('../utils/storage');
const { EMOJIS, createShoppingListEmbed } = require('../utils/embeds');
const { addReactionsToMessage } = require('../utils/reactions');
const messageCache = require('../utils/messageCache');

// ⚠️ DEPRECATED: This reaction handler is kept for backward compatibility only
// The bot now uses Discord Buttons (see src/events/buttonInteraction.js)
// This file can be removed once all existing lists have been recreated with buttons

// Track ongoing operations per message to prevent race conditions
const operationLocks = new Map(); // messageId -> Promise

module.exports = {
  name: Events.MessageReactionAdd,
  execute(reaction, user) {
    // Ignore bot's own reactions
    if (user.bot) return;
    
    // Log deprecation warning
    console.log('[DEPRECATED] Reaction used - consider recreating list with /shop list for button support');

    handleReaction(reaction, user);
  },
};

async function handleReaction(reaction, user) {
  // If the reaction is partial, fetch the full reaction
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      console.error('Something went wrong when fetching the reaction:', error);
      return;
    }
  }

  const message = reaction.message;
  const messageId = message.id;
  
  // Find list by message ID
  const found = storage.getListByMessageId(messageId);
  
  console.log(`Reaction detected: ${reaction.emoji.name} by ${user.username}`);
  console.log(`Message ID: ${messageId}`);

  // Only handle reactions on shopping list messages
  if (!found) {
    console.log('Ignoring reaction - not a shopping list message');
    return;
  }

  const { listId, list } = found;
  const emoji = reaction.emoji.name;
  console.log(`Processing reaction: ${emoji} for list: ${list.title}`);
  
  // Queue this operation to prevent race conditions
  const processOperation = async () => {
    try {
      // Handle different types of reactions first (faster response)
      if (EMOJIS.ITEM.includes(emoji)) {
        // Item emoji - toggle item checked status
        const itemIndex = EMOJIS.ITEM.indexOf(emoji);
        if (itemIndex < list.items.length) {
          const item = list.items[itemIndex];
          await handleItemToggle(message, item, listId, user);
        }
      } else if (emoji === EMOJIS.CLEAR_COMPLETED) {
        // Clear all completed items
        await handleClearCompleted(message, listId, user);
      } else if (emoji === EMOJIS.ADD_ITEM) {
        // Add new item
        await handleAddItem(message, listId, user);
      } else if (emoji === EMOJIS.EDIT) {
        // Edit mode - show instructions
        await handleEditMode(message, listId, user);
      }

      // Remove the user's reaction after processing (non-blocking for speed)
      reaction.users.remove(user.id).catch(err => 
        console.log('Could not remove reaction (might be missing permissions)')
      );
    } catch (error) {
      console.error('Error handling reaction:', error);
    }
  };

  // Wait for any ongoing operation on this message to complete first
  const existingOperation = operationLocks.get(messageId);
  if (existingOperation) {
    console.log(`⏳ Queuing operation - waiting for previous operation to complete`);
    const chainedOperation = existingOperation.then(processOperation);
    operationLocks.set(messageId, chainedOperation);
    
    // Clean up lock after this chained operation completes
    chainedOperation.finally(() => {
      // Only delete if this is still the last operation
      if (operationLocks.get(messageId) === chainedOperation) {
        operationLocks.delete(messageId);
      }
    });
  } else {
    const newOperation = processOperation();
    operationLocks.set(messageId, newOperation);
    
    // Clean up lock after completion
    newOperation.finally(() => {
      // Only delete if this is still the last operation
      if (operationLocks.get(messageId) === newOperation) {
        operationLocks.delete(messageId);
      }
    });
  }
}

async function handleItemToggle(message, item, listId, user) {
  const wasChecked = item.checked;
  storage.toggleItemChecked(listId, item.id);
  await updateShoppingListMessage(message, listId);
  
  const status = wasChecked ? 'unchecked' : 'checked';
  const emoji = wasChecked ? '⬜' : '✅';
  await message.channel.send(`${emoji} ${user.username} ${status}: **${item.text}**`);
}

async function handleClearCompleted(message, listId, user) {
  const clearedCount = storage.clearCompletedItems(listId);
  await updateShoppingListMessage(message, listId);
  
  if (clearedCount > 0) {
    await message.channel.send(`🧹 ${user.username} cleared ${clearedCount} completed item${clearedCount === 1 ? '' : 's'}!`);
  } else {
    await message.channel.send(`${user.username}, no completed items to clear.`);
  }
}

async function handleAddItem(message, listId, user) {
  await message.channel.send(
    `➕ ${user.username}, what would you like to add to the shopping list?\n*Separate multiple items with semicolons (;). Type \`cancel\` to cancel.*`
  );
  
  const filter = m => m.author.id === user.id;
  const collector = message.channel.createMessageCollector({ filter, time: 30000, max: 1 });
  
  collector.on('collect', async m => {
    if (m.content.toLowerCase() === 'cancel') {
      await m.reply('❌ Add cancelled.');
      return;
    }
    
    // Parse multiple items separated by semicolons
    const items = m.content.split(';').map(item => item.trim()).filter(item => item.length > 0);
    
    if (items.length === 0) {
      await m.reply('❌ Please provide at least one valid item.');
      return;
    }
    
    // Add each item to the list sequentially
    let addedItems = [];
    for (const item of items) {
      try {
        storage.addItem(listId, item);
        addedItems.push(item);
      } catch (err) {
        console.error('Error adding item', item, err);
        await m.reply(`❌ Failed to add "${item}". Continuing with next.`);
      }
    }
    
    // Update the shopping list message sequentially
    try {
      await updateShoppingListMessage(message, listId);
    } catch (err) {
      console.error('Error updating shopping list after add:', err);
      await m.reply('⚠️ Could not refresh the shopping list after adding items.');
    }
    
    // Send summary of added items
    const resultText = addedItems.length === 1 
      ? `➕ Added "${addedItems[0]}" to the shopping list!`
      : `➕ Added ${addedItems.length} items to the shopping list:\n• ${addedItems.join('\n• ')}`;
    await m.reply(resultText);
  });
  
  collector.on('end', (collected, reason) => {
    if (reason === 'time') {
      message.channel.send(`⏰ ${user.username}, add timeout. Use \`/shop add\` instead.`);
    }
  });
}

async function handleEditMode(message, listId, user) {
  const list = storage.getList(listId);
  if (!list || list.items.length === 0) return;

  let editText = `✏️ ${user.username}, which item would you like to edit?\n\n`;
  list.items.forEach((item, index) => {
    const status = item.checked ? '✅' : '⬜';
    const text = item.checked ? `~~${item.text}~~` : item.text;
    editText += `**${index + 1}.** ${status} ${text}\n`;
  });
  editText += `\nReply with a number (1-${list.items.length}) to edit, or "cancel" to cancel.`;
  
  const editMessage = await message.channel.send(editText);
  
  const filter = m => m.author.id === user.id;
  const collector = message.channel.createMessageCollector({ filter, time: 30000, max: 1 });
  
  collector.on('collect', async m => {
    const choice = m.content.trim().toLowerCase();
    
    if (choice === 'cancel') {
      await editMessage.delete();
      await m.delete();
      return;
    }
    
    const itemIndex = parseInt(choice) - 1;
    if (itemIndex >= 0 && itemIndex < list.items.length) {
      const item = list.items[itemIndex];
      await editMessage.delete();
      await m.delete();
      await handleEditItem(message, item, listId, user);
    } else {
      await m.reply('❌ Invalid choice. Please try again.');
    }
  });
  
  collector.on('end', (collected, reason) => {
    if (reason === 'time') {
      editMessage.delete().catch(() => {});
      message.channel.send(`⏰ ${user.username}, edit timeout.`);
    }
  });
}

async function handleEditItem(message, item, listId, user) {
  await message.channel.send(
    `✏️ ${user.username}, enter the new text for: **${item.text}**\n*Type \`cancel\` to cancel editing.*`
  );
  
  const filter = m => m.author.id === user.id;
  const collector = message.channel.createMessageCollector({ filter, time: 30000, max: 1 });
  
  collector.on('collect', async m => {
    if (m.content.toLowerCase() === 'cancel') {
      await m.reply('❌ Edit cancelled.');
      return;
    }
    
    const oldText = item.text;
    storage.editItem(listId, item.id, m.content);
    await updateShoppingListMessage(message, listId);
    await m.reply(`✏️ Updated "${oldText}" → "${m.content}"`);
  });
  
  collector.on('end', (collected, reason) => {
    if (reason === 'time') {
      message.channel.send(`⏰ ${user.username}, edit timeout. Please try again if needed.`);
    }
  });
}



async function updateShoppingListMessage(message, listId) {
  const list = storage.getList(listId);
  if (!list) return;

  const embed = createShoppingListEmbed(list);
  
  try {
    // Update message content immediately
    await message.edit({ embeds: [embed] });
    messageCache.updateCache(message);
    
    // Re-add reactions immediately with no delays
    try {
      await addReactionsToMessage(message, list, { skipDelays: true });
    } catch (error) {
      console.error('Error re-adding reactions after update:', error);
    }
  } catch (error) {
    console.error('Error updating shopping list message:', error);
    
    // If message no longer exists, clear the reference
    if (error.code === 10008) {
      console.log('Message was deleted, clearing reference');
      storage.clearListMessage(listId);
      messageCache.invalidate(message.id);
    }
  }
}