const { EMOJIS } = require('./embeds');

async function addReactionsToMessage(message, list) {
  try {
    if (list.items.length === 0) return;
    
    console.log(`Adding reactions for ${list.items.length} items...`);
    console.log(`Message ID: ${message.id}, Channel: ${message.channel.name}`);
    
    // Check bot permissions in this specific channel
    const permissions = message.channel.permissionsFor(message.guild.members.me);
    console.log('Bot permissions in this channel:', {
      AddReactions: permissions.has('AddReactions'),
      ManageMessages: permissions.has('ManageMessages'),
      ReadMessageHistory: permissions.has('ReadMessageHistory'),
      SendMessages: permissions.has('SendMessages')
    });
    
    // Try to remove existing reactions first (if we have permission)
    if (permissions.has('ManageMessages')) {
      try {
        await message.reactions.removeAll();
        console.log('✅ Cleared existing reactions');
      } catch (removeError) {
        console.error('Failed to remove existing reactions:', removeError.message);
        console.error('Error code:', removeError.code);
      }
    }
    
    // Add unique emoji for each item (up to 50 items)
    for (let i = 0; i < Math.min(list.items.length, EMOJIS.ITEM.length); i++) {
      try {
        await message.react(EMOJIS.ITEM[i]);
        console.log(`${EMOJIS.ITEM[i]} Added item emoji ${i + 1}`);
        // Small delay between reactions to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (emojiError) {
        console.error(`Failed to add emoji ${EMOJIS.ITEM[i]}:`, emojiError.message);
        console.error('Emoji error code:', emojiError.code);
      }
    }
    
    // Add clear completed button if there are checked items
    const hasCheckedItems = list.items.some(item => item.checked);
    if (hasCheckedItems) {
      try {
        await message.react(EMOJIS.CLEAR_COMPLETED);
        console.log(`${EMOJIS.CLEAR_COMPLETED} Added clear completed emoji`);
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (emojiError) {
        console.error('Failed to add clear completed emoji:', emojiError.message);
      }
    }
    
    // Add utility buttons
    try {
      await message.react(EMOJIS.ADD_ITEM);
      console.log(`${EMOJIS.ADD_ITEM} Added add item emoji`);
      await new Promise(resolve => setTimeout(resolve, 300));
      
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

module.exports = {
  addReactionsToMessage
};