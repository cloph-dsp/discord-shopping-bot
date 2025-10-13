const { EMOJIS } = require('./embeds');

async function addReactionsToMessage(message, list, options = {}) {
  const skipDelays = options.skipDelays === true;
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

    // Collect all reactions to add in parallel
    const reactionsToAdd = [];
    
    // Add unique emoji for each item (up to 50 items)
    for (let i = 0; i < Math.min(list.items.length, EMOJIS.ITEM.length); i++) {
      reactionsToAdd.push(EMOJIS.ITEM[i]);
    }
    
    // Add clear completed button if there are checked items
    const hasCheckedItems = list.items.some(item => item.checked);
    if (hasCheckedItems) {
      reactionsToAdd.push(EMOJIS.CLEAR_COMPLETED);
    }
    
    // Always add utility buttons
    reactionsToAdd.push(EMOJIS.ADD_ITEM);
    reactionsToAdd.push(EMOJIS.EDIT);

    // Add all reactions in parallel for maximum speed
    if (skipDelays) {
      const reactionPromises = reactionsToAdd.map(emoji => 
        message.react(emoji).catch(error => 
          console.error(`Failed to add emoji ${emoji}:`, error.message)
        )
      );
      await Promise.allSettled(reactionPromises);
    } else {
      // Sequential with delays (fallback for rate limiting)
      for (const emoji of reactionsToAdd) {
        try {
          await message.react(emoji);
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (emojiError) {
          console.error(`Failed to add emoji ${emoji}:`, emojiError.message);
        }
      }
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