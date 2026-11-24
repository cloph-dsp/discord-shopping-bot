const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { PAGE_SIZE } = require('../utils/storage');

function itemLabel(item, index) {
  const quantity = item.quantity > 1 ? ` ×${item.quantity}` : '';
  const label = `${index + 1}. ${item.text}${quantity}`;
  return label.length > 80 ? `${label.substring(0, 77)}...` : label;
}

/**
 * Item rows plus controls, with a navigation row when the list spans pages.
 * Discord caps messages at 5 action rows of 5 buttons each.
 */
function createShoppingListButtons(list, page = 0) {
  if (list.items.length === 0) {
    return [new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('add_item')
        .setLabel('➕ Add Items')
        .setStyle(ButtonStyle.Primary)
    )];
  }

  const totalPages = Math.max(1, Math.ceil(list.items.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(0, Number(page) || 0), totalPages - 1);
  const start = currentPage * PAGE_SIZE;
  const visible = list.items.slice(start, start + PAGE_SIZE);
  const rows = [];

  for (let i = 0; i < visible.length; i += 5) {
    const row = new ActionRowBuilder();
    for (let j = 0; j < Math.min(5, visible.length - i); j++) {
      const index = start + i + j;
      const item = visible[i + j];
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`toggle_${item.id}`)
          .setLabel(itemLabel(item, index))
          .setStyle(item.checked ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setEmoji(item.checked ? '✅' : '⬜')
      );
    }
    rows.push(row);
  }

  const controls = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('add_item').setLabel('Add').setStyle(ButtonStyle.Primary).setEmoji('➕'),
    new ButtonBuilder().setCustomId('edit_item').setLabel('Edit').setStyle(ButtonStyle.Secondary).setEmoji('✏️'),
    new ButtonBuilder().setCustomId('remove_item').setLabel('Remove').setStyle(ButtonStyle.Secondary).setEmoji('🗑️')
  );
  if (list.items.some(item => item.checked)) {
    controls.addComponents(
      new ButtonBuilder().setCustomId('clear_completed').setLabel('Clear Done').setStyle(ButtonStyle.Danger).setEmoji('🧹')
    );
  }
  controls.addComponents(
    new ButtonBuilder().setCustomId('refresh_list').setLabel('Refresh').setStyle(ButtonStyle.Secondary).setEmoji('🔄')
  );
  rows.push(controls);

  if (totalPages > 1) {
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('page_prev')
        .setLabel('Previous')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('◀')
        .setDisabled(currentPage === 0),
      new ButtonBuilder()
        .setCustomId('page_info')
        .setLabel(`${currentPage + 1}/${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('page_next')
        .setLabel('Next')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('▶')
        .setDisabled(currentPage === totalPages - 1)
    ));
  }

  return rows;
}

/** Disable all buttons in button rows (used when processing). */
function disableAllButtons(rows) {
  return rows.map(row => {
    const newRow = new ActionRowBuilder();
    row.components.forEach(button => {
      newRow.addComponents(ButtonBuilder.from(button).setDisabled(true));
    });
    return newRow;
  });
}

module.exports = {
  createShoppingListButtons,
  disableAllButtons
};
