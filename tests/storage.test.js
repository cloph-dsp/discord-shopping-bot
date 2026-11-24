const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsb-test-'));
process.env.DSB_DATA_DIR = tempDir;
process.on('exit', () => {
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* best effort */ }
});

const storage = require('../src/utils/storage');

test('switching the active list in a channel replaces the old mapping', () => {
  const a = storage.createList('A', [], 'guild-1');
  const b = storage.createList('B', [], 'guild-1');

  storage.setActiveList('chan-1', a.id);
  assert.equal(storage.getActiveList('chan-1').list.title, 'A');

  storage.setActiveList('chan-1', b.id);
  assert.equal(storage.getActiveList('chan-1').list.title, 'B');

  const rows = storage.db.prepare('SELECT COUNT(*) AS n FROM active_lists WHERE channelId = ?').get('chan-1');
  assert.equal(rows.n, 1);

  // Both lists keep the channel where they were last displayed.
  assert.equal(storage.getList(a.id).channelId, 'chan-1');
  assert.equal(storage.getList(b.id).channelId, 'chan-1');
});

test('titles and listings are scoped per guild', () => {
  // Legacy rows are global by design until claimed; clear them first.
  storage.claimLegacyLists('guild-1');

  const shared1 = storage.createList('Groceries', [], 'guild-1');
  const only1 = storage.createList('Only in one', [], 'guild-1');
  const shared2 = storage.createList('Groceries', [], 'guild-2');
  const only2 = storage.createList('Only in two', [], 'guild-2');

  assert.equal(storage.getListByTitle('Groceries', 'guild-1').listId, shared1.id);
  assert.equal(storage.getListByTitle('Groceries', 'guild-2').listId, shared2.id);
  assert.equal(storage.getListByTitle('Only in one', 'guild-1').listId, only1.id);
  assert.equal(storage.getListByTitle('Only in one', 'guild-2'), null);
  assert.equal(storage.getListByTitle('Only in two', 'guild-2').listId, only2.id);
  assert.equal(storage.getListByTitle('Only in two', 'guild-1'), null);

  assert.ok(!storage.getAllListTitles('guild-2').includes('Only in one'));
  assert.ok(storage.getAllListTitles('guild-2').includes('Groceries'));
});

test('quantities are stored separately and survive edits', () => {
  const list = storage.createList('Quantities', [], 'guild-q');
  storage.addItem(list.id, 'Milk', 3);
  storage.addItem(list.id, 'Bread', 1);

  const items = storage.getList(list.id).items;
  assert.equal(items[0].text, 'Milk');
  assert.equal(items[0].quantity, 3);
  assert.equal(items[1].quantity, 1);

  storage.editItem(list.id, items[0].id, 'Oat milk');
  const updated = storage.getList(list.id).items[0];
  assert.equal(updated.text, 'Oat milk');
  assert.equal(updated.quantity, 3);
});

test('removeItem is scoped to its list', () => {
  const a = storage.createList('RA', [], 'guild-r');
  const b = storage.createList('RB', [], 'guild-r');
  const item = storage.addItem(a.id, 'Only in A', 1);

  assert.equal(storage.removeItem(b.id, item.id), false);
  assert.equal(storage.getList(a.id).items.length, 1);
  assert.equal(storage.removeItem(a.id, item.id), true);
  assert.equal(storage.getList(a.id).items.length, 0);
});

test('sorting and page clamping follow the current item count', () => {
  const list = storage.createList('Sorted', ['Zebra', 'apple', 'Mango'], 'guild-s');
  storage.sortList(list.id);
  assert.deepEqual(storage.getList(list.id).items.map(i => i.text), ['apple', 'Mango', 'Zebra']);

  assert.equal(storage.setListPage(list.id, 99), 0);
  for (let i = 0; i < 20; i++) storage.addItem(list.id, `extra ${i}`, 1);
  assert.equal(storage.setListPage(list.id, 99), 1);
  storage.clearList(list.id);
  assert.equal(storage.setListPage(list.id, 5), 0);
});

test('a legacy database is upgraded without losing lists or their active channel', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsb-migrate-'));
  const Database = require('better-sqlite3');
  const db = new Database(path.join(dir, 'storage.db'));
  db.exec(`
    CREATE TABLE lists (id TEXT PRIMARY KEY, title TEXT NOT NULL, messageId TEXT, channelId TEXT, createdAt INTEGER NOT NULL);
    CREATE TABLE items (id TEXT PRIMARY KEY, listId TEXT NOT NULL, text TEXT NOT NULL, checked INTEGER NOT NULL DEFAULT 0, createdAt INTEGER NOT NULL);
    CREATE TABLE settings (guildId TEXT PRIMARY KEY, shoppingChannel TEXT);
    INSERT INTO lists (id, title, messageId, channelId, createdAt) VALUES ('old', 'Old list', NULL, 'old-chan', 1);
    INSERT INTO items (id, listId, text, checked, createdAt) VALUES ('i1', 'old', 'Milk (2 liters)', 0, 1);
    INSERT INTO items (id, listId, text, checked, createdAt) VALUES ('i2', 'old', 'Bread (3)', 0, 1);
  `);
  db.close();

  const script = `
    console.log = (...args) => console.error(...args);
    process.env.DSB_DATA_DIR = ${JSON.stringify(dir)};
    const s = require(${JSON.stringify(path.join(__dirname, '..', 'src', 'utils', 'storage.js'))});
    const out = {
      active: s.getActiveList('old-chan').list.title,
      guild: s.getList('old').guildId,
      quantities: s.getList('old').items.map(i => [i.text, i.quantity])
    };
    s.claimLegacyLists('guild-x');
    out.claimed = s.getList('old').guildId;
    process.stdout.write(JSON.stringify(out));
  `;
  const out = JSON.parse(execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' }).trim());

  assert.equal(out.active, 'Old list');
  assert.equal(out.guild, 'legacy');
  assert.equal(out.claimed, 'guild-x');
  assert.deepEqual(out.quantities, [['Milk (2 liters)', 1], ['Bread', 3]]);
  fs.rmSync(dir, { recursive: true, force: true });
});
