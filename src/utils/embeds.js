const { EmbedBuilder } = require('discord.js');

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
    embed.setDescription('*Your shopping list is empty. Click the "Add Items" button below to get started!*');
    embed.setFooter({ text: '⬇️ Use the buttons below' });
    return embed;
  }

  // Compact summary instead of full list (buttons show everything)
  let description = '';
  
  if (totalItems <= 20) {
    // All items have buttons - no need to show in embed
    description = `*Use the buttons below to check off items as you shop!*`;
  } else {
    // Show items beyond the 20 that have buttons
    description = `**First 20 items have buttons below.**\n\n**Remaining items:**\n`;
    for (let i = 20; i < list.items.length; i++) {
      const item = list.items[i];
      const status = item.checked ? '✅' : '⬜';
      const itemText = item.checked ? `~~${item.text}~~` : item.text;
      description += `${i + 1}. ${status} ${itemText}\n`;
    }
  }

  embed.setDescription(description.trim());

  // Enhanced footer with completion status
  const completionText = `${checkedItems.length}/${totalItems} items`;
  let footerText = '';
  
  if (isComplete) {
    footerText = `✨ All done! (${completionText})`;
  } else if (checkedItems.length > 0) {
    footerText = `📝 ${completionText} checked - Keep going!`;
  } else {
    footerText = `🛒 ${completionText} - Let's shop!`;
  }
  
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
  createShoppingListEmbed,
  createInstructionEmbed
};