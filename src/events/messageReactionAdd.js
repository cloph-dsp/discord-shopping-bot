const { Events } = require('discord.js');
const storage = require('../utils/storage');
const { EMOJIS, createShoppingListEmbed } = require('../utils/embeds');
const { addReactionsToMessage } = require('../utils/reactions');

module.exports = {
  name: Events.MessageReactionAdd,
  execute(reaction, user) {
    // Ignore bot's own reactions
    if (user.bot) return;

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
  const channelId = message.channel.id;
  const list = storage.getList(channelId);

  console.log(`Reaction detected: ${reaction.emoji.name} by ${user.username}`);
  console.log(`Message ID: ${message.id}, Stored ID: ${list ? list.messageId : 'none'}`);

  // Only handle reactions on shopping list messages
  if (!list || list.messageId !== message.id) {
    console.log('Ignoring reaction - not a shopping list message or wrong message ID');
    return;
  }

  const emoji = reaction.emoji.name;
  console.log(`Processing reaction: ${emoji}`);
  
  try {
    // Handle different types of reactions first (faster response)
    if (EMOJIS.ITEM.includes(emoji)) {
      // Item emoji - toggle item checked status
      const itemIndex = EMOJIS.ITEM.indexOf(emoji);
      if (itemIndex < list.items.length) {
        const item = list.items[itemIndex];
        await handleItemToggle(message, item, channelId, user);
      }
    } else if (emoji === EMOJIS.CLEAR_COMPLETED) {
      // Clear all completed items
      await handleClearCompleted(message, channelId, user);
    } else if (emoji === EMOJIS.ADD_ITEM) {
      // Add new item
      await handleAddItem(message, channelId, user);
    } else if (emoji === EMOJIS.EDIT) {
      // Edit mode - show instructions
      await handleEditMode(message, channelId, user);
    }

    // Remove the user's reaction after processing (non-blocking for speed)
    reaction.users.remove(user.id).catch(err => 
      console.log('Could not remove reaction (might be missing permissions)')
    );
  } catch (error) {
    console.error('Error handling reaction:', error);
  }
}

async function handleItemToggle(message, item, channelId, user) {
  const wasChecked = item.checked;
  storage.toggleItemChecked(channelId, item.id);
  await updateShoppingListMessage(message, channelId);
  
  const status = wasChecked ? 'unchecked' : 'checked';
  const emoji = wasChecked ? '⬜' : '✅';
  await message.channel.send(`${emoji} ${user.username} ${status}: **${item.text}**`);
}

async function handleClearCompleted(message, channelId, user) {
  const clearedCount = storage.clearCompletedItems(channelId);
  await updateShoppingListMessage(message, channelId);
  
  if (clearedCount > 0) {
    await message.channel.send(`🧹 ${user.username} cleared ${clearedCount} completed item${clearedCount === 1 ? '' : 's'}!`);
  } else {
    await message.channel.send(`${user.username}, no completed items to clear.`);
  }
}

async function handleAddItem(message, channelId, user) {
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
        storage.addItem(channelId, item);
        addedItems.push(item);
      } catch (err) {
        console.error('Error adding item', item, err);
        await m.reply(`❌ Failed to add "${item}". Continuing with next.`);
      }
    }
    
    // Update the shopping list message sequentially
    try {
      await updateShoppingListMessage(message, channelId);
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

async function handleEditMode(message, channelId, user) {
  const list = storage.getList(channelId);
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
      await handleEditItem(message, item, channelId, user);
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

async function handleEditItem(message, item, channelId, user) {
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
    storage.editItem(channelId, item.id, m.content);
    await updateShoppingListMessage(message, channelId);
    await m.reply(`✏️ Updated "${oldText}" → "${m.content}"`);
  });
  
  collector.on('end', (collected, reason) => {
    if (reason === 'time') {
      message.channel.send(`⏰ ${user.username}, edit timeout. Please try again if needed.`);
    }
  });
}



async function updateShoppingListMessage(message, channelId) {
  const list = storage.getList(channelId);
  if (!list) return;

  const embed = createShoppingListEmbed(list);
  
  try {
    // Update message content immediately
    await message.edit({ embeds: [embed] });
    // Re-add reactions immediately with no delays
    try {
      await addReactionsToMessage(message, list, { skipDelays: true });
    } catch (error) {
      console.error('Error re-adding reactions after update:', error);
    }
  } catch (error) {
    console.error('Error updating shopping list message:', error);
  }
}