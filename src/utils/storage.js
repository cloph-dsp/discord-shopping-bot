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

// DSB_DATA_DIR exists so demo/tests never touch the production database.
const DATA_DIR = process.env.DSB_DATA_DIR || path.join(__dirname, '..', '..', 'data');
const LEGACY_GUILD_ID = 'legacy';
const DB_FILE = path.join(DATA_DIR, 'storage.db');

class SQLiteShoppingListStorage {
  constructor() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    this.db = new Database(DB_FILE);
    this._prepareSchema();
  }

  _prepareSchema() {
    this.db.exec('PRAGMA foreign_keys = ON');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS lists (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        messageId TEXT,
        channelId TEXT,
        guildId TEXT NOT NULL DEFAULT '${LEGACY_GUILD_ID}',
        createdAt INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        listId TEXT NOT NULL,
        text TEXT NOT NULL,
        checked INTEGER NOT NULL DEFAULT 0,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY(listId) REFERENCES lists(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS settings (
        guildId TEXT PRIMARY KEY,
        shoppingChannel TEXT
      );
      CREATE TABLE IF NOT EXISTS active_lists (
        channelId TEXT PRIMARY KEY,
        listId TEXT NOT NULL,
        FOREIGN KEY(listId) REFERENCES lists(id) ON DELETE CASCADE
      );
    `);

    // Upgrade databases created before guildId existed. Existing rows stay
    // legacy/global until ready.js assigns them to the single guild in use.
    const columns = this.db.prepare('PRAGMA table_info(lists)').all().map(c => c.name);
    if (!columns.includes('guildId')) {
      this.db.exec(`ALTER TABLE lists ADD COLUMN guildId TEXT NOT NULL DEFAULT '${LEGACY_GUILD_ID}'`);
      console.log('[DB] Added guildId column to existing lists.');
    }

    // One active list per channel. Seed from pre-upgrade databases (newest wins).
    this.db.exec(`
      INSERT OR IGNORE INTO active_lists (channelId, listId)
      SELECT channelId, id FROM lists
      WHERE channelId IS NOT NULL ORDER BY createdAt DESC;
    `);

    // Title uniqueness within a guild. Never abort startup on an old DB that
    // already contains duplicates - warn instead so an operator can clean it.
    const duplicates = this.db.prepare(`
      SELECT guildId, title, COUNT(*) AS n FROM lists
      GROUP BY guildId, title HAVING n > 1
    `).all();
    if (duplicates.length > 0) {
      console.warn(`[DB] ${duplicates.length} duplicate (guildId, title) pair(s); unique index skipped.`);
    } else {
      this.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_lists_guild_title ON lists(guildId, title)');
    }

    this.stmts = {
      insertList: this.db.prepare('INSERT INTO lists (id, title, messageId, channelId, guildId, createdAt) VALUES (?, ?, ?, ?, ?, ?)'),
      getListById: this.db.prepare('SELECT * FROM lists WHERE id = ?'),
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
      clearListItems: this.db.prepare('DELETE FROM items WHERE listId = ?'),

      getActiveList: this.db.prepare(`
        SELECT l.* FROM active_lists a
        JOIN lists l ON l.id = a.listId
        WHERE a.channelId = ?
      `),
      setActiveList: this.db.prepare(`
        INSERT INTO active_lists (channelId, listId) VALUES (?, ?)
        ON CONFLICT(channelId) DO UPDATE SET listId = excluded.listId
      `),
      claimLegacyLists: this.db.prepare(`UPDATE lists SET guildId = ? WHERE guildId = '${LEGACY_GUILD_ID}'`)
    };
  }

  // API methods
  createList(title, items = [], guildId = LEGACY_GUILD_ID) {
    const listId = this.generateId();
    const createdAt = Date.now();
    this.db.transaction(() => {
      this.stmts.insertList.run(listId, title, null, null, guildId, createdAt);
      for (const it of items) {
        this.stmts.insertItem.run(this.generateId(), listId, it, 0, Date.now());
      }
    })();
    return this.getList(listId);
  }

  /**
   * Sets the active list for a channel. `lists.channelId` stays as the last
   * channel where the list was displayed; the mapping itself lives in
   * active_lists so switching lists never leaves two owners for one channel.
   */
  setActiveList(channelId, listId) {
    this.db.transaction(() => {
      this.stmts.setActiveList.run(channelId, listId);
      this.stmts.updateListChannel.run(channelId, listId);
    })();
    return true;
  }

  getActiveList(channelId) {
    const row = this.stmts.getActiveList.get(channelId);
    if (!row) return null;
    return { listId: row.id, list: this._rowToList(row) };
  }

  getList(listId) {
    const row = this.stmts.getListById.get(listId);
    if (!row) return null;
    return this._rowToList(row);
  }

  getListByTitle(title, guildId = LEGACY_GUILD_ID) {
    const row = this.db.prepare(`
      SELECT * FROM lists
      WHERE title = ? AND (guildId = ? OR guildId = '${LEGACY_GUILD_ID}')
      ORDER BY CASE WHEN guildId = ? THEN 0 ELSE 1 END
      LIMIT 1
    `).get(title, guildId, guildId);
    if (!row) return null;
    return { listId: row.id, list: this._rowToList(row) };
  }

  addItem(listId, itemText, quantity = 1) {
    const text = quantity > 1 ? `${itemText} (${quantity})` : itemText;
    const itemId = this.generateId();
    this.stmts.insertItem.run(itemId, listId, text, 0, Date.now());
    return this.stmts.getItemById.get(itemId);
  }

  removeItem(listId, itemId) {
    const info = this.stmts.deleteItem.run(itemId);
    return info.changes > 0;
  }

  toggleItemChecked(listId, itemId) {
    this.stmts.toggleItem.run(itemId);
    return this.stmts.getItemById.get(itemId);
  }

  clearCompletedItems(listId) {
    const info = this.stmts.clearCompleted.run(listId);
    return info.changes || 0;
  }

  editItem(listId, itemId, newText) {
    const info = this.stmts.editItem.run(newText, itemId);
    return info.changes > 0 ? this.stmts.getItemById.get(itemId) : null;
  }

  clearList(listId) {
    const info = this.stmts.clearListItems.run(listId);
    return info.changes ?? 0;
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
    try { return crypto.randomUUID(); } catch (e) { return crypto.randomBytes(16).toString('hex'); }
  }

  getListByMessageId(messageId) {
    const row = this.stmts.getListByMessageId.get(messageId);
    if (!row) return null;
    return { listId: row.id, list: this._rowToList(row) };
  }

  getListIdAndTitleByMessageId(messageId) {
    const row = this.stmts.getListByMessageId.get(messageId);
    if (!row) return null;
    return { id: row.id, title: row.title };
  }

  countItemsByListId(listId) {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM items WHERE listId = ?').get(listId);
    return row ? row.count : 0;
  }

  _titlesForGuild(guildId) {
    return this.db.prepare(`
      SELECT title FROM lists
      WHERE guildId = ? OR guildId = '${LEGACY_GUILD_ID}'
      ORDER BY createdAt
    `).all(guildId).map(r => r.title);
  }

  getAllListTitles(guildId = LEGACY_GUILD_ID) {
    return this._titlesForGuild(guildId);
  }

  getAllLists(guildId = LEGACY_GUILD_ID) {
    const rows = this.db.prepare(`
      SELECT * FROM lists
      WHERE guildId = ? OR guildId = '${LEGACY_GUILD_ID}'
      ORDER BY createdAt
    `).all(guildId);
    return rows.map(r => ({ listId: r.id, list: this._rowToList(r) }));
  }

  /** Assign pre-guild lists to the guild when the bot is in exactly one guild. */
  claimLegacyLists(guildId) {
    return this.stmts.claimLegacyLists.run(guildId).changes;
  }

  // Settings
  setShoppingChannel(guildId, channelId) {
    this.db.prepare('INSERT OR REPLACE INTO settings (guildId, shoppingChannel) VALUES (?, ?)').run(guildId, channelId);
  }

  getShoppingChannel(guildId) {
    const row = this.db.prepare('SELECT shoppingChannel FROM settings WHERE guildId = ?').get(guildId);
    return row ? row.shoppingChannel : null;
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
      guildId: row.guildId,
      createdAt: new Date(row.createdAt)
    };
  }
}

module.exports = new SQLiteShoppingListStorage();
