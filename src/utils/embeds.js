const { EmbedBuilder } = require('discord.js');

const MAX_DESCRIPTION = 4096;
const MAX_TITLE = 256;
const DEFAULT_PAGE_SIZE = 15;

function progressBar(checked, total) {
  if (total === 0) return '░'.repeat(10);
  const percent = Math.round((checked / total) * 100);
  const filled = Math.min(10, Math.round(percent / 10));
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

function createShoppingListEmbed(list, page = 0, pageSize = DEFAULT_PAGE_SIZE) {
  const checkedItems = list.items.filter(item => item.checked);
  const totalItems = list.items.length;
  const checkedCount = checkedItems.length;
  const isComplete = totalItems > 0 && checkedCount === totalItems;
  const percent = totalItems === 0 ? 0 : Math.round((checkedCount / totalItems) * 100);

  let embedColor;
  if (totalItems === 0) {
    embedColor = 0x99AAB5;
  } else if (isComplete) {
    embedColor = 0x57F287;
  } else if (checkedCount > 0) {
    embedColor = 0xFEE75C;
  } else {
    embedColor = 0x5865F2;
  }

  const embed = new EmbedBuilder()
    .setTitle(`🛒 ${String(list.title).slice(0, MAX_TITLE - 2)}`)
    .setColor(embedColor)
    .setTimestamp();

  if (totalItems === 0) {
    embed.setDescription('*Your shopping list is empty. Press ➕ Add to get started!*');
    embed.setFooter({ text: '⬇️ Use the buttons below' });
    return embed;
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(0, Number(page) || 0), totalPages - 1);
  const start = currentPage * pageSize;
  const visible = list.items.slice(start, start + pageSize);

  let description = `${progressBar(checkedCount, totalItems)} **${percent}%** · ${checkedCount}/${totalItems} checked\n\n`;
  for (const [offset, item] of visible.entries()) {
    const index = start + offset;
    const quantity = item.quantity > 1 ? ` ×${item.quantity}` : '';
    const text = `${String(item.text).slice(0, 100)}${quantity}`;
    description += `${index + 1}. ${item.checked ? '✅' : '⬜'} ${item.checked ? `~~${text}~~` : text}\n`;
  }
  if (totalPages > 1) {
    description += `\n_Page ${currentPage + 1}/${totalPages} — use ◀ / ▶ to move._`;
  }
  if (description.length > MAX_DESCRIPTION) {
    description = `${description.slice(0, MAX_DESCRIPTION - 40).trimEnd()}\n\n_… list truncated._`;
  }
  embed.setDescription(description.trim());

  const completionText = `${checkedCount}/${totalItems} items`;
  let footerText;
  if (isComplete) {
    footerText = `✨ All done! (${completionText})`;
  } else if (checkedCount > 0) {
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
               '2. Press the item buttons to check things off\n' +
               '3. Lists can be displayed in any channel',
        inline: false
      },
      {
        name: '🎯 Buttons',
        value: '**Item button** - check/uncheck that item\n' +
               '**➕ Add** - add items through a modal\n' +
               '**✏️ Edit** - rename an item by its number\n' +
               '**🗑️ Remove** - delete one item by its number\n' +
               '**🧹 Clear Done** - remove all checked items\n' +
               '**🔄 Refresh** - redraw the list\n' +
               '**◀ / ▶** - browse pages when a list has more than 15 items',
        inline: false
      },
      {
        name: '📋 Commands',
        value: '`/shop create <title> [items]` - create a list\n' +
               '`/shop add <item> [quantity]` - add to the active list\n' +
               '`/shop list [title]` - display a list\n' +
               '`/shop sort` - sort the active list by name\n' +
               '`/shop delete <title>` - delete a list (asks for confirmation)\n' +
               '`/shop clear` - empty the active list\n' +
               '`/shop lists` - show all lists\n' +
               '`/shop help` - this help',
        inline: false
      },
      {
        name: '💡 Tips',
        value: '• Separate multiple items with `;`\n' +
               '• Quantities are stored per item and shown as `×N`\n' +
               '• The bar at the top shows overall progress\n' +
               '• Lists and titles are private to each server',
        inline: false
      }
    )
    .setFooter({ text: 'Enjoy your shopping! 🎉' })
    .setTimestamp();

  return embed;
}

module.exports = {
  createShoppingListEmbed,
  createInstructionEmbed,
  progressBar
};
