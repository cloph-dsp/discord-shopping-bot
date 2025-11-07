const { Events } = require('discord.js');
const storage = require('../utils/storage');
const { createShoppingListEmbed } = require('../utils/embeds');
const { createShoppingListButtons, disableAllButtons } = require('../utils/buttons');
const messageCache = require('../utils/messageCache');

// Track ongoing operations per message to prevent race conditions
const operationLocks = new Map(); // messageId -> Promise

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // Only handle button interactions
    if (!interaction.isButton()) return;
    
    const messageId = interaction.message.id;
    
    // Find list by message ID
    const found = storage.getListByMessageId(messageId);
    
    if (!found) {
      return interaction.reply({ 
        content: '❌ This shopping list no longer exists.',
        ephemeral: true
      });
    }
    
    const { listId, list } = found;
    
    console.log(`[BUTTON] ${interaction.user.tag} clicked: ${interaction.customId} on list: ${list.title}`);
    
    // Defer the interaction immediately so Discord knows we're processing it
    // This gives us more time and prevents "Unknown interaction" errors
    try {
      await interaction.deferReply({ ephemeral: true });
    } catch (error) {
      console.error('Error deferring interaction:', error);
      return;
    }
    
    // Queue this operation to prevent race conditions
    const processOperation = async () => {
      try {
        if (interaction.customId.startsWith('toggle_')) {
          await handleToggleItem(interaction, listId);
        } else if (interaction.customId === 'clear_completed') {
          await handleClearCompleted(interaction, listId);
        } else if (interaction.customId === 'add_item') {
          await handleAddItem(interaction, listId);
        } else if (interaction.customId === 'edit_item') {
          await handleEditItem(interaction, listId);
        } else if (interaction.customId === 'refresh_list') {
          await handleRefresh(interaction, listId);
        }
      } catch (error) {
        console.error('Error handling button interaction:', error);
        
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ 
            content: '❌ An error occurred while processing your request.',
            ephemeral: true
          }).catch(() => {});
        } else if (interaction.deferred) {
          await interaction.editReply({ 
            content: '❌ An error occurred while processing your request.'
          }).catch(() => {});
        }
      }
    };
    
    // Wait for any ongoing operation on this message to complete first
    const existingOperation = operationLocks.get(messageId);
    if (existingOperation) {
      console.log(`⏳ Queuing button operation - waiting for previous operation to complete`);
      const chainedOperation = existingOperation.then(processOperation);
      operationLocks.set(messageId, chainedOperation);
      
      // Clean up lock after this chained operation completes
      chainedOperation.finally(() => {
        if (operationLocks.get(messageId) === chainedOperation) {
          operationLocks.delete(messageId);
        }
      });
    } else {
      const newOperation = processOperation();
      operationLocks.set(messageId, newOperation);
      
      // Clean up lock after completion
      newOperation.finally(() => {
        if (operationLocks.get(messageId) === newOperation) {
          operationLocks.delete(messageId);
        }
      });
    }
  },
};

async function handleToggleItem(interaction, listId) {
  // Get fresh list data
  const list = storage.getList(listId);
  if (!list) {
    return interaction.editReply({ content: '❌ List not found.' });
  }
  
  const itemId = interaction.customId.split('_')[1];
  const item = list.items.find(i => i.id === itemId);
  
  if (!item) {
    return interaction.editReply({ 
      content: '❌ Item not found.'
    });
  }
  
  // Toggle item
  storage.toggleItemChecked(listId, itemId);
  
  // Update the original message directly (not through interaction)
  try {
    const updatedList = storage.getList(listId);
    if (updatedList && updatedList.messageId) {
      const message = await messageCache.getMessage(interaction.channel, updatedList.messageId);
      if (message) {
        const embed = createShoppingListEmbed(updatedList);
        const buttons = createShoppingListButtons(updatedList);
        await message.edit({ embeds: [embed], components: buttons });
        messageCache.updateCache(message);
      }
    }
  } catch (err) {
    console.error('Error updating list message:', err);
  }
  
  // Send ephemeral feedback
  const status = item.checked ? 'unchecked' : 'checked';
  const emoji = item.checked ? '⬜' : '✅';
  await interaction.editReply({ 
    content: `${emoji} ${status.charAt(0).toUpperCase() + status.slice(1)}: **${item.text}**`
  });
}

async function handleClearCompleted(interaction, listId) {
  const clearedCount = storage.clearCompletedItems(listId);
  
  // Update the original message directly
  try {
    const updatedList = storage.getList(listId);
    if (updatedList && updatedList.messageId) {
      const message = await messageCache.getMessage(interaction.channel, updatedList.messageId);
      if (message) {
        const embed = createShoppingListEmbed(updatedList);
        const buttons = createShoppingListButtons(updatedList);
        await message.edit({ embeds: [embed], components: buttons });
        messageCache.updateCache(message);
      }
    }
  } catch (err) {
    console.error('Error updating list message:', err);
  }
  
  // Send feedback
  if (clearedCount > 0) {
    await interaction.editReply({ 
      content: `🧹 Cleared ${clearedCount} completed item${clearedCount === 1 ? '' : 's'}!`
    });
  } else {
    await interaction.editReply({ 
      content: 'No completed items to clear.'
    });
  }
}

async function handleAddItem(interaction, listId) {
  await interaction.editReply({
    content: '➕ What would you like to add to the shopping list?\n*Separate multiple items with semicolons (;). Reply within 30 seconds.*'
  });
  
  const filter = m => m.author.id === interaction.user.id;
  const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });
  
  collector.on('collect', async m => {
    // Parse multiple items separated by semicolons
    const items = m.content.split(';').map(item => item.trim()).filter(item => item.length > 0);
    
    if (items.length === 0) {
      await interaction.followUp({
        content: '❌ Please provide at least one valid item.',
        ephemeral: true
      });
      return;
    }
    
    // Add each item
    let addedItems = [];
    for (const item of items) {
      try {
        storage.addItem(listId, item);
        addedItems.push(item);
      } catch (err) {
        console.error('Error adding item', item, err);
      }
    }
    
    // Update the shopping list message
    try {
      const updatedList = storage.getList(listId);
      if (updatedList && updatedList.messageId) {
        const message = await messageCache.getMessage(interaction.channel, updatedList.messageId);
        if (message) {
          const embed = createShoppingListEmbed(updatedList);
          const buttons = createShoppingListButtons(updatedList);
          await message.edit({ embeds: [embed], components: buttons });
          messageCache.updateCache(message);
        }
      }
    } catch (err) {
      console.error('Error updating shopping list after add:', err);
    }
    
    // Send summary
    const resultText = addedItems.length === 1 
      ? `➕ Added "${addedItems[0]}" to the shopping list!`
      : `➕ Added ${addedItems.length} items to the shopping list:\n• ${addedItems.join('\n• ')}`;
    await interaction.followUp({
      content: resultText,
      ephemeral: true
    });
  });
  
  collector.on('end', (collected, reason) => {
    if (reason === 'time') {
      interaction.followUp({ 
        content: '⏰ Add timeout. Use the button again to try.',
        ephemeral: true
      }).catch(() => {});
    }
  });
}

async function handleEditItem(interaction, listId) {
  // Get fresh list data
  const list = storage.getList(listId);
  if (!list) {
    return interaction.editReply({ content: '❌ List not found.' });
  }
  
  if (list.items.length === 0) {
    return interaction.editReply({ 
      content: '❌ No items to edit.'
    });
  }
  
  let editText = '✏️ Which item would you like to edit?\n\n';
  list.items.forEach((item, index) => {
    const status = item.checked ? '✅' : '⬜';
    const text = item.checked ? `~~${item.text}~~` : item.text;
    editText += `**${index + 1}.** ${status} ${text}\n`;
  });
  editText += `\nReply with a number (1-${list.items.length}), or "cancel" to cancel.`;
  
  await interaction.editReply({ content: editText });
  
  const filter = m => m.author.id === interaction.user.id;
  const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });
  
  collector.on('collect', async m => {
    const choice = m.content.trim().toLowerCase();
    
    if (choice === 'cancel') {
      await m.reply('❌ Edit cancelled.');
      return;
    }
    
    const itemIndex = parseInt(choice) - 1;
    if (itemIndex >= 0 && itemIndex < list.items.length) {
      const item = list.items[itemIndex];
      await handleEditItemText(interaction, m, item, listId);
    } else {
      await m.reply('❌ Invalid choice. Please try again.');
    }
  });
  
  collector.on('end', (collected, reason) => {
    if (reason === 'time') {
      interaction.followUp({ 
        content: '⏰ Edit timeout.',
        ephemeral: true
      }).catch(() => {});
    }
  });
}

async function handleEditItemText(interaction, choiceMessage, item, listId) {
  await choiceMessage.reply(
    `✏️ Enter the new text for: **${item.text}**\n*Type \`cancel\` to cancel editing.*`
  );
  
  const filter = m => m.author.id === interaction.user.id;
  const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });
  
  collector.on('collect', async m => {
    if (m.content.toLowerCase() === 'cancel') {
      await m.reply('❌ Edit cancelled.');
      return;
    }
    
    const oldText = item.text;
    storage.editItem(listId, item.id, m.content);
    
    // Update the list message
    const list = storage.getList(listId);
    const message = await messageCache.getMessage(interaction.channel, list.messageId);
    if (message) {
      const embed = createShoppingListEmbed(list);
      const buttons = createShoppingListButtons(list);
      await message.edit({ embeds: [embed], components: buttons });
      messageCache.updateCache(message);
    }
    
    await m.reply(`✏️ Updated "${oldText}" → "${m.content}"`);
  });
  
  collector.on('end', (collected, reason) => {
    if (reason === 'time') {
      interaction.followUp({ 
        content: '⏰ Edit timeout.',
        ephemeral: true
      }).catch(() => {});
    }
  });
}

async function handleRefresh(interaction, listId) {
  // Update the original message directly
  const list = storage.getList(listId);
  if (list) {
    try {
      const message = await messageCache.getMessage(interaction.channel, list.messageId);
      if (message) {
        const embed = createShoppingListEmbed(list);
        const buttons = createShoppingListButtons(list);
        await message.edit({ embeds: [embed], components: buttons });
        messageCache.updateCache(message);
      }
    } catch (err) {
      console.error('Error updating list message:', err);
    }
  }
  
  await interaction.editReply({ 
    content: '🔄 List refreshed!'
  });
}
