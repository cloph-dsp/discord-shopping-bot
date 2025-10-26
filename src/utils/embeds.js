const { EmbedBuilder } = require('discord.js');

// Emojis used for reactions

// Number emojis 1-10
const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
// Regional indicator letters 🇦-🇿 (A-Z)
const LETTER_EMOJIS = [
  '🇦','🇧','🇨','🇩','🇪','🇫','🇬','🇭','🇮','🇯','🇰','🇱','🇲','🇳','🇴','🇵','🇶','🇷','🇸','🇹','🇺','🇻','🇼','🇽','🇾','🇿'
];
// Special symbols for 37-50 (pick visually distinct, non-conflicting emojis)
const EXTRA_EMOJIS = [
  '🅰️','🅱️','🆎','🆑','🆒','🆓','🆔','🆕','🆖','🆗','🆘','🆙','🆚','🈁','🈂️','🈷️','🈶','🈯️','🉐','🈹','🈚','🈸','🈺','🈳'
];

const EMOJIS = {
  ITEM: [...NUMBER_EMOJIS, ...LETTER_EMOJIS, ...EXTRA_EMOJIS],
  CLEAR_COMPLETED: '🧹',  // Clear all checked items
  ADD_ITEM: '➕',         // Add new item
  EDIT: '✏️'              // Edit mode
};

function createShoppingListEmbed(list) {
  const checkedItems = list.items.filter(item => item.checked);
  const totalItems = list.items.length;
  const isComplete = totalItems > 0 && checkedItems.length === totalItems;
  
  // Dynamic color based on completion status
  let embedColor;
  if (totalItems === 0) {
    embedColor = 0x99AAB5; // Gray - empty list
  } else if (isComplete) {
    embedColor = 0x57F287; // Green - all done!
  } else if (checkedItems.length > 0) {
    embedColor = 0xFEE75C; // Yellow - in progress
  } else {
    embedColor = 0x5865F2; // Blurple - fresh list
  }
  
  const embed = new EmbedBuilder()
    .setTitle(`🛒 ${list.title}`)
    .setColor(embedColor)
    .setTimestamp();

  if (totalItems === 0) {
    embed.setDescription('*Your shopping list is empty. Add some items to get started!*');
    embed.setFooter({ text: '⬇️ Click the "Add Items" button below or use /shop add' });
    return embed;
  }

  let description = '';

  // Show all items with improved formatting
  list.items.forEach((item, index) => {
    const status = item.checked ? '✅' : '⬜';
    const itemText = item.checked ? `~~${item.text}~~` : item.text;
    
    description += `${index + 1}. ${status} ${itemText}\n`;
  });

  embed.setDescription(description.trim());

  // Enhanced footer with completion status and instructions
  const completionText = `${checkedItems.length}/${totalItems} items checked`;
  let footerText = completionText;
  
  if (isComplete) {
    footerText = `✨ ${completionText} - All done!`;
  } else if (checkedItems.length > 0) {
    footerText = `📝 ${completionText} - Keep going!`;
  } else {
    footerText = `🛒 ${completionText} - Let's shop!`;
  }
  
  // Add interaction hints
  footerText += ` • Click buttons below to interact`;
  
  embed.setFooter({ text: footerText });

  return embed;
}

function createInstructionEmbed() {
  const embed = new EmbedBuilder()
    .setTitle('🛒 Shopping List Bot')
    .setColor(0x5865F2)
    .setDescription('Create and manage interactive shopping lists with buttons!')
    .addFields(
      {
        name: '📝 Getting Started',
        value: '1. Create a list: `/shop create "My List" milk;bread;eggs`\n' +
               '2. Click buttons to interact with items\n' +
               '3. Lists can be displayed in any channel!',
        inline: false
      },
      {
        name: '🎯 How It Works',
        value: '**Item Buttons** - Click to check/uncheck items\n' +
               '**➕ Add** - Add new items quickly\n' +
               '**🧹 Clear Done** - Remove all completed items\n' +
               '**✏️ Edit** - Modify existing items\n' +
               '**🔄 Refresh** - Update the list display',
        inline: false
      },
      {
        name: '📋 Main Commands',
        value: '`/shop create <title> [items]` - Create new list\n' +
               '`/shop list [title]` - Display a list (with autocomplete)\n' +
               '`/shop lists` - Show all your lists\n' +
               '`/shop add <item>` - Add items to active list\n' +
               '`/shop clear` - Clear the active list',
        inline: false
      },
      {
        name: '💡 Tips',
        value: '• Lists work in any channel\n' +
               '• Use semicolons to add multiple items: `milk;bread;eggs`\n' +
               '• Embed colors change based on progress\n' +
               '• Up to 20 items can have buttons (more items shown in text)',
        inline: false
      }
    )
    .setFooter({ text: 'Enjoy your shopping! 🎉' })
    .setTimestamp();

  return embed;
}

module.exports = {
  EMOJIS,
  createShoppingListEmbed,
  createInstructionEmbed
};