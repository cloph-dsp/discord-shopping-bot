const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * Create button rows for a shopping list
 * Discord limits: 5 buttons per row, 5 rows per message = 25 buttons max
 * @param {Object} list - Shopping list object
 * @returns {Array<ActionRowBuilder>} Array of button rows
 */
function createShoppingListButtons(list) {
  const rows = [];
  
  if (list.items.length === 0) {
    // Empty list - just show add button
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('add_item')
          .setLabel('➕ Add Items')
          .setStyle(ButtonStyle.Primary)
      );
    return [row];
  }
  
  // Create item toggle buttons (max 20 items to leave room for control buttons)
  const maxItems = Math.min(list.items.length, 20);
  
  for (let i = 0; i < maxItems; i += 5) {
    const row = new ActionRowBuilder();
    const itemsInRow = Math.min(5, maxItems - i);
    
    for (let j = 0; j < itemsInRow; j++) {
      const index = i + j;
      const item = list.items[index];
      
      // Truncate long item names for button labels (max 80 chars)
      let label = `${index + 1}. ${item.text}`;
      if (label.length > 80) {
        label = label.substring(0, 77) + '...';
      }
      
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`toggle_${item.id}`)
          .setLabel(label)
          .setStyle(item.checked ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setEmoji(item.checked ? '✅' : '⬜')
      );
    }
    
    rows.push(row);
  }
  
  
  // Create control buttons row
  const controlRow = new ActionRowBuilder();
  const checkedItems = list.items.filter(item => item.checked);
  
  controlRow.addComponents(
    new ButtonBuilder()
      .setCustomId('add_item')
      .setLabel('Add')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('➕')
  );
  
  // Only show clear button if there are checked items
  if (checkedItems.length > 0) {
    controlRow.addComponents(
      new ButtonBuilder()
        .setCustomId('clear_completed')
        .setLabel('Clear Done')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🧹')
    );
  }
  
  controlRow.addComponents(
    new ButtonBuilder()
      .setCustomId('edit_item')
      .setLabel('Edit')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('✏️')
  );
  
  // Add refresh button
  controlRow.addComponents(
    new ButtonBuilder()
      .setCustomId('refresh_list')
      .setLabel('Refresh')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔄')
  );
  
  rows.push(controlRow);
  
  return rows;
}

/**
 * Disable all buttons in button rows (used when processing)
 * @param {Array<ActionRowBuilder>} rows - Button rows to disable
 * @returns {Array<ActionRowBuilder>} Disabled button rows
 */
function disableAllButtons(rows) {
  return rows.map(row => {
    const newRow = new ActionRowBuilder();
    row.components.forEach(button => {
      newRow.addComponents(
        ButtonBuilder.from(button).setDisabled(true)
      );
    });
    return newRow;
  });
}

module.exports = {
  createShoppingListButtons,
  disableAllButtons
};
