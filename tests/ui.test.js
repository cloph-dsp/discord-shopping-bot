const test = require('node:test');
const assert = require('node:assert/strict');
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { MODAL_TITLE_MAX, ADD_PREFIX, EDIT_PREFIX, fitModalTitle } = require('../src/utils/modalTitles');
const { createShoppingListEmbed } = require('../src/utils/embeds');
const { createShoppingListButtons } = require('../src/utils/buttons');

test('modal titles fit the 45-char limit even with long list names', () => {
  const addTitle = fitModalTitle(ADD_PREFIX, 'Compras da semana para a casa inteira e para o fim de semana');
  assert.ok(addTitle.length <= MODAL_TITLE_MAX);

  const modal = new ModalBuilder()
    .setCustomId('test')
    .setTitle(addTitle)
    .addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('input')
        .setLabel('Items')
        .setStyle(TextInputStyle.Paragraph)
    ));
  assert.equal(modal.toJSON().title.length <= MODAL_TITLE_MAX, true);

  assert.equal(fitModalTitle(EDIT_PREFIX, 'x'.repeat(200)).length, MODAL_TITLE_MAX);
});

test('embeds with long lists stay under the 4096-char description cap', () => {
  const items = Array.from({ length: 250 }, (_, i) => ({
    id: `i${i}`,
    text: 'item '.repeat(20),
    checked: i % 3 === 0,
    createdAt: new Date()
  }));
  const embed = createShoppingListEmbed({
    id: 'x', title: 'T', items, messageId: null, channelId: null, createdAt: new Date()
  }).toJSON();

  assert.ok(embed.description.length <= 4096);
  assert.match(embed.description, /more items/);
});

test('button rows respect Discord component limits', () => {
  const items = Array.from({ length: 25 }, (_, i) => ({
    id: `i${i}`,
    text: 'x'.repeat(100),
    checked: false
  }));
  const rows = createShoppingListButtons({ items });

  assert.ok(rows.length <= 5);
  for (const row of rows) {
    const json = row.toJSON();
    assert.ok(json.components.length <= 5);
    for (const component of json.components) {
      assert.ok(component.label.length <= 80);
    }
  }
});
