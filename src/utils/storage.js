const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.error('better-sqlite3 is required for SQLite storage. Install with `npm install better-sqlite3`.');
  throw e;
}

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const JSON_LISTS_FILE = path.join(DATA_DIR, 'lists.json');
const JSON_SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const DB_FILE = path.join(DATA_DIR, 'storage.db');

class SQLiteShoppingListStorage {
  constructor() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    this.db = new Database(DB_FILE);
    this._prepareSchema();
  }

  _prepareSchema() {
    const createLists = `
      CREATE TABLE IF NOT EXISTS lists (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        messageId TEXT,
        channelId TEXT,
        createdAt INTEGER NOT NULL
      );`;

    const createItems = `
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        listId TEXT NOT NULL,
        text TEXT NOT NULL,
        checked INTEGER NOT NULL DEFAULT 0,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY(listId) REFERENCES lists(id) ON DELETE CASCADE
      );`;

    const createSettings = `
      CREATE TABLE IF NOT EXISTS settings (
        guildId TEXT PRIMARY KEY,
        shoppingChannel TEXT
      );`;

    this.db.exec('PRAGMA foreign_keys = ON');
    this.db.exec(createLists);
    this.db.exec(createItems);
    this.db.exec(createSettings);

    // Prepared statements
    this.stmts = {
      insertList: this.db.prepare('INSERT INTO lists (id, title, messageId, channelId, createdAt) VALUES (?, ?, ?, ?, ?)'),
      getListById: this.db.prepare('SELECT * FROM lists WHERE id = ?'),
      getListByTitle: this.db.prepare('SELECT * FROM lists WHERE title = ?'),
      getListByMessageId: this.db.prepare('SELECT * FROM lists WHERE messageId = ?'),
      updateListChannel: this.db.prepare('UPDATE lists SET channelId = ? WHERE id = ?'),
      updateListMessage: this.db.prepare('UPDATE lists SET messageId = ? WHERE id = ?'),
      deleteList: this.db.prepare('DELETE FROM lists WHERE id = ?'),

      insertItem: this.db.prepare('INSERT INTO items (id, listId, text, checked, createdAt) VALUES (?, ?, ?, ?, ?)'),
      getItemsForList: this.db.prepare('SELECT * FROM items WHERE listId = ? ORDER BY rowid'),
      getItemById: this.db.prepare('SELECT * FROM items WHERE id = ?'),
      deleteItem: this.db.prepare('DELETE FROM items WHERE id = ?'),
      toggleItem: this.db.prepare('UPDATE items SET checked = 1 - checked WHERE id = ?'),
      clearCompleted: this.db.prepare('DELETE FROM items WHERE listId = ? AND checked = 1'),
      editItem: this.db.prepare('UPDATE items SET text = ? WHERE id = ?'),
      clearListItems: this.db.prepare('DELETE FROM items WHERE listId = ?')
    };
  }

  // API methods
  createList(title, items = []) {
    const listId = this.generateId();
    const createdAt = Date.now();
    this.stmts.insertList.run(listId, title, null, null, createdAt);
    for (const it of items) {
      const itemId = this.generateId();
      this.stmts.insertItem.run(itemId, listId, it, 0, Date.now());
    }
    return this.getList(listId);
  }

  setActiveList(channelId, listId) {
    this.stmts.updateListChannel.run(channelId, listId);
  }

  getActiveList(channelId) {
    const row = this.db.prepare('SELECT * FROM lists WHERE channelId = ?').get(channelId);
    if (!row) return null;
    const list = this._rowToList(row);
    return { listId: row.id, list };
  }

  getList(listId) {
    const row = this.stmts.getListById.get(listId);
    if (!row) return null;
    return this._rowToList(row);
  }

  getListByTitle(title) {
    const row = this.stmts.getListByTitle.get(title);
    if (!row) return null;
    return { listId: row.id, list: this._rowToList(row) };
  }

  addItem(listId, itemText, quantity = 1) {
    const text = quantity > 1 ? `${itemText} (${quantity})` : itemText;
    const itemId = this.generateId();
    this.stmts.insertItem.run(itemId, listId, text, 0, Date.now());
    return this.getItemById(itemId);
  }

  removeItem(listId, itemId) {
    const info = this.stmts.deleteItem.run(itemId);
    return info.changes > 0;
  }

  toggleItemChecked(listId, itemId) {
    this.stmts.toggleItem.run(itemId);
    return this.getItemById(itemId);
  }

  clearCompletedItems(listId) {
    const info = this.stmts.clearCompleted.run(listId);
    return info.changes || 0;
  }

  editItem(listId, itemId, newText) {
    const info = this.stmts.editItem.run(newText, itemId);
    return info.changes > 0 ? this.getItemById(itemId) : null;
  }

  clearList(listId) {
    const info = this.stmts.clearListItems.run(listId);
    return true;
  }

  setMessageId(listId, messageId) {
    const info = this.stmts.updateListMessage.run(messageId, listId);
    return info.changes > 0;
  }

  clearListMessage(listId) {
    const info = this.stmts.updateListMessage.run(null, listId);
    return info.changes > 0;
  }

  deleteList(listId) {
    const info = this.stmts.deleteList.run(listId);
    return info.changes > 0;
  }

  generateId() {
    try { return crypto.randomUUID(); } catch (e) { return Math.random().toString(36).substr(2, 9); }
  }

  getItemByIndex(listId, index) {
    const items = this.stmts.getItemsForList.all(listId);
    if (!items || index < 0 || index >= items.length) return null;
    return items[index];
  }

  getListByMessageId(messageId) {
    const row = this.stmts.getListByMessageId.get(messageId);
    if (!row) return null;
    return { listId: row.id, list: this._rowToList(row) };
  }

  getAllListTitles() {
    const rows = this.db.prepare('SELECT title FROM lists ORDER BY createdAt').all();
    return rows.map(r => r.title);
  }

  getAllLists() {
    const rows = this.db.prepare('SELECT * FROM lists ORDER BY createdAt').all();
    return rows.map(r => ({ listId: r.id, list: this._rowToList(r) }));
  }

  // Settings
  setShoppingChannel(guildId, channelId) {
    this.db.prepare('INSERT OR REPLACE INTO settings (guildId, shoppingChannel) VALUES (?, ?)').run(guildId, channelId);
  }

  getShoppingChannel(guildId) {
    const row = this.db.prepare('SELECT shoppingChannel FROM settings WHERE guildId = ?').get(guildId);
    return row ? row.shoppingChannel : null;
  }

  getListByChannel(channelId) {
    const active = this.getActiveList(channelId);
    return active ? active.list : null;
  }

  _rowToList(row) {
    const items = this.stmts.getItemsForList.all(row.id).map(i => ({
      id: i.id,
      text: i.text,
      checked: i.checked === 1,
      createdAt: new Date(i.createdAt)
    }));

    return {
      id: row.id,
      title: row.title,
      items,
      messageId: row.messageId,
      channelId: row.channelId,
      createdAt: new Date(row.createdAt)
    };
  }
}

module.exports = new SQLiteShoppingListStorage();
