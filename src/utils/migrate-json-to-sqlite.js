#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.error('better-sqlite3 is required. Run: npm install better-sqlite3');
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const JSON_LISTS_FILE = path.join(DATA_DIR, 'lists.json');
const JSON_SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const DB_FILE = path.join(DATA_DIR, 'storage.db');

function generateId() {
  try { return crypto.randomUUID(); } catch (e) { return Math.random().toString(36).substr(2, 9); }
}

function ensureSchema(db) {
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS lists (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      messageId TEXT,
      channelId TEXT,
      createdAt INTEGER NOT NULL
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      listId TEXT NOT NULL,
      text TEXT NOT NULL,
      checked INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY(listId) REFERENCES lists(id) ON DELETE CASCADE
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      guildId TEXT PRIMARY KEY,
      shoppingChannel TEXT
    );
  `);
}

function migrateLists(db) {
  if (!fs.existsSync(JSON_LISTS_FILE)) {
    console.log('No JSON lists file to migrate.');
    return;
  }

  const raw = fs.readFileSync(JSON_LISTS_FILE, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse JSON lists file:', err);
    return;
  }

  const insertList = db.prepare('INSERT OR IGNORE INTO lists (id, title, messageId, channelId, createdAt) VALUES (?, ?, ?, ?, ?)');
  const insertItem = db.prepare('INSERT OR IGNORE INTO items (id, listId, text, checked, createdAt) VALUES (?, ?, ?, ?, ?)');

  const tx = db.transaction(() => {
    for (const [listId, list] of Object.entries(parsed)) {
      const createdAt = list.createdAt ? new Date(list.createdAt).getTime() : Date.now();
      insertList.run(listId, list.title || 'Untitled', list.messageId || null, list.channelId || null, createdAt);
      if (Array.isArray(list.items)) {
        for (const item of list.items) {
          const itemId = item.id || generateId();
          const itemCreated = item.createdAt ? new Date(item.createdAt).getTime() : Date.now();
          insertItem.run(itemId, listId, item.text || '', item.checked ? 1 : 0, itemCreated);
        }
      }
    }
  });

  tx();
  try { fs.renameSync(JSON_LISTS_FILE, JSON_LISTS_FILE + '.migrated'); } catch (e) { console.warn('Could not rename lists.json:', e.message); }
  console.log('Lists migrated.');
}

function migrateSettings(db) {
  if (!fs.existsSync(JSON_SETTINGS_FILE)) {
    console.log('No JSON settings file to migrate.');
    return;
  }

  const raw = fs.readFileSync(JSON_SETTINGS_FILE, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse JSON settings file:', err);
    return;
  }

  const insertSettings = db.prepare('INSERT OR REPLACE INTO settings (guildId, shoppingChannel) VALUES (?, ?)');
  const tx = db.transaction(() => {
    for (const [guildId, settings] of Object.entries(parsed)) {
      insertSettings.run(guildId, settings.shoppingChannel || null);
    }
  });

  tx();
  try { fs.renameSync(JSON_SETTINGS_FILE, JSON_SETTINGS_FILE + '.migrated'); } catch (e) { console.warn('Could not rename settings.json:', e.message); }
  console.log('Settings migrated.');
}

function main() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_FILE);
  ensureSchema(db);
  migrateLists(db);
  migrateSettings(db);
  db.close();
  console.log('Migration complete.');
}

if (require.main === module) main();

module.exports = { main };
