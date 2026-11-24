const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// buttons.js imports storage for PAGE_SIZE: keep this test off the live DB.
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsb-ui-'));
process.env.DSB_DATA_DIR = tempDir;
process.on('exit', () => {
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* best effort */ }
});

const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { MODAL_TITLE_MAX, ADD_PREFIX, EDIT_PREFIX, REMOVE_PREFIX, fitModalTitle } = require('../src/utils/modalTitles');
const { createShoppingListEmbed, progressBar } = require('../src/utils/embeds');
const { createShoppingListButtons } = require('../src/utils/buttons');

const makeItems = (n, checkedEvery = 0) => Array.from({ length: n }, (_, i) => ({
  id: `i${i}`,
  text: `item ${i}`,
  quantity: i % 4 === 0 ? 3 : 1,
  checked: checkedEvery > 0 && i % checkedEvery === 0,
  createdAt: new Date()
}));
const makeList = items => ({ id: 'x', title: 'T', items, messageId: null, channelId: null, createdAt: new Date() });

test('modal titles fit the 45-char limit even with long list names', () => {
  for (const prefix of [ADD_PREFIX, EDIT_PREFIX, REMOVE_PREFIX]) {
    assert.equal(fitModalTitle(prefix, 'x'.repeat(200)).length, MODAL_TITLE_MAX);
    const modal = new ModalBuilder()
      .setCustomId('test')
      .setTitle(fitModalTitle(prefix, 'Compras da semana para a casa inteira'))
      .addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('input').setLabel('Items').setStyle(TextInputStyle.Paragraph)
      ));
    assert.ok(modal.toJSON().title.length <= MODAL_TITLE_MAX);
  }
});

test('progress bar maps checked counts to ten blocks', () => {
  assert.equal(progressBar(0, 10), '░'.repeat(10));
  assert.equal(progressBar(5, 10), '█████░░░░░');
  assert.equal(progressBar(10, 10), '█'.repeat(10));
});

test('embeds show the requested page and stay under the 4096-char cap', () => {
  const pageTwo = createShoppingListEmbed(makeList(makeItems(40, 3)), 1).toJSON();
  assert.match(pageTwo.description, /16\. ✅ ~~item 15~~/);
  assert.match(pageTwo.description, /Page 2\/3/);
  assert.doesNotMatch(pageTwo.description, /^1\. ⬜ item 0/m);

  const long = createShoppingListEmbed(makeList(makeItems(250)), 0).toJSON();
  assert.ok(long.description.length <= 4096);
});

test('button rows respect limits, paginate and show quantities', () => {
  const rows = createShoppingListButtons(makeList(makeItems(40)), 1).map(row => row.toJSON());
  assert.equal(rows.length, 5);
  for (const row of rows) {
    assert.ok(row.components.length <= 5);
    for (const component of row.components) assert.ok(component.label.length <= 80);
  }

  const nav = rows[4].components;
  assert.equal(nav[0].custom_id, 'page_prev');
  assert.equal(nav[0].disabled, false);
  assert.equal(nav[1].label, '2/3');
  assert.equal(nav[2].custom_id, 'page_next');
  assert.equal(nav[2].disabled, false);

  const labels = rows.slice(0, 3).flatMap(row => row.components.map(c => c.label));
  assert.equal(labels[0], '16. item 15');
  assert.equal(labels[1], '17. item 16 ×3');

  const lastPage = createShoppingListButtons(makeList(makeItems(40)), 2).map(row => row.toJSON());
  assert.equal(lastPage[lastPage.length - 1].components[2].disabled, true);
});

test('empty and single-page lists need no navigation row', () => {
  assert.equal(createShoppingListButtons(makeList([])).length, 1);
  const rows = createShoppingListButtons(makeList(makeItems(10)), 0).map(row => row.toJSON());
  assert.equal(rows.length, 3);
  assert.ok(!rows.some(row => row.components.some(c => c.custom_id.startsWith('page_'))));
});
