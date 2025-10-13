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
    
    // Build required reactions for this state
    const requiredEmojis = [];
    
    // Add unique emoji for each item (up to 50 items)
    for (let i = 0; i < Math.min(list.items.length, EMOJIS.ITEM.length); i++) {
      requiredEmojis.push(EMOJIS.ITEM[i]);
    }
    
    // Add clear completed button if there are checked items
    const hasCheckedItems = list.items.some(item => item.checked);
    if (hasCheckedItems) {
      requiredEmojis.push(EMOJIS.CLEAR_COMPLETED);
    }
    
    // Always add utility buttons
    requiredEmojis.push(EMOJIS.ADD_ITEM);
    requiredEmojis.push(EMOJIS.EDIT);

    // Current reactions on the message
    const presentReactions = message.reactions.cache;
    const presentEmojiNames = new Set(presentReactions.map(r => r.emoji.name));

    // Determine which to add and which to remove
    const requiredSet = new Set(requiredEmojis);
    const toAdd = requiredEmojis.filter(e => !presentEmojiNames.has(e));
    const toRemove = presentReactions.filter(r => !requiredSet.has(r.emoji.name));

    const botId = message.client.user.id;

    // Remove only extra reactions (if needed)
    if (toRemove.size > 0) {
      if (skipDelays) {
        await Promise.allSettled(
          toRemove.map(async r => {
            try {
              if (permissions.has('ManageMessages')) {
                await r.remove();
              } else {
                await r.users.remove(botId);
              }
            } catch (remErr) {
              console.error(`Failed to remove reaction ${r.emoji.name}:`, remErr.message);
            }
          })
        );
      } else {
        for (const r of toRemove.values()) {
          try {
            if (permissions.has('ManageMessages')) {
              await r.remove();
            } else {
              await r.users.remove(botId);
            }
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (remErr) {
            console.error(`Failed to remove reaction ${r.emoji.name}:`, remErr.message);
          }
        }
      }
    }

    // Add only missing reactions
    if (toAdd.length > 0) {
      if (skipDelays) {
        const reactionPromises = toAdd.map(emoji => 
          message.react(emoji).catch(error => 
            console.error(`Failed to add emoji ${emoji}:`, error.message)
          )
        );
        await Promise.allSettled(reactionPromises);
      } else {
        for (const emoji of toAdd) {
          try {
            await message.react(emoji);
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (emojiError) {
            console.error(`Failed to add emoji ${emoji}:`, emojiError.message);
          }
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