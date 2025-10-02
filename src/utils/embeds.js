const { EmbedBuilder } = require('discord.js');

// Emojis used for reactions
const EMOJIS = {
  NUMBERS: ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'],
  CLEAR_COMPLETED: '🧹',  // Clear all checked items
  ADD_ITEM: '➕',         // Add new item
  EDIT: '✏️'              // Edit mode
};

function createShoppingListEmbed(list) {
  const embed = new EmbedBuilder()
    .setTitle(`🛒 ${list.title}`)
    .setColor(0x00AE86)
    .setTimestamp();

  if (list.items.length === 0) {
    embed.setDescription('*Your shopping list is empty. Add some items with `/shop add`!*');
    embed.setFooter({ text: 'Use /shop add <item> to add items to your list' });
    return embed;
  }

  let description = '';
  const checkedItems = list.items.filter(item => item.checked);
  const uncheckedItems = list.items.filter(item => !item.checked);

  // Show all items with their numbers
  list.items.forEach((item, index) => {
    const numberEmoji = EMOJIS.NUMBERS[index] || `${index + 1}️⃣`;
    const itemText = item.checked ? `~~${item.text}~~` : item.text;
    const status = item.checked ? '✅' : '⬜';
    
    description += `${numberEmoji} ${status} ${itemText}\n`;
  });

  // Add summary
  if (checkedItems.length > 0) {
    description += `\n**Progress:** ${checkedItems.length}/${list.items.length} items checked`;
  }

  embed.setDescription(description);

  // Add footer with instructions
  let instructions = 'Click number emojis to check/uncheck items';
  if (checkedItems.length > 0) {
    instructions += ` • ${EMOJIS.CLEAR_COMPLETED} Clear completed`;
  }
  instructions += ` • ${EMOJIS.ADD_ITEM} Add item • ${EMOJIS.EDIT} Edit`;
  
  embed.setFooter({ text: instructions });

  return embed;
}

function createInstructionEmbed() {
  const embed = new EmbedBuilder()
    .setTitle('🛒 Shopping List Bot')
    .setColor(0x0099FF)
    .setDescription('Create and manage interactive shopping lists with emoji reactions!')
    .addFields(
      {
        name: '📝 Getting Started',
        value: `1. Set a shopping channel: \`/shop channel #your-channel\`
                2. Create a list: \`/shop create "My List" milk;bread;eggs\`
                3. Use emoji reactions to interact with items`,
        inline: false
      },
      {
        name: '🎯 How It Works',
        value: `1️⃣2️⃣3️⃣ **Click numbers**: Check/uncheck items (becomes ~~strikethrough~~)
                ${EMOJIS.CLEAR_COMPLETED} **Clear completed**: Remove all checked items at once
                ${EMOJIS.ADD_ITEM} **Add item**: Add new items quickly
                ${EMOJIS.EDIT} **Edit**: Modify existing items`,
        inline: false
      },
      {
        name: '📋 Commands',
        value: `\`/shop create <title> [items]\` - Create new shopping list
                \`/shop add <item> [quantity]\` - Add item to list
                \`/shop list\` - Show current list
                \`/shop clear\` - Clear the list
                \`/shop channel <channel>\` - Set shopping channel`,
        inline: false
      }
    )
    .setTimestamp();

  return embed;
}

module.exports = {
  EMOJIS,
  createShoppingListEmbed,
  createInstructionEmbed
};