// Persistent file-based storage for shopping lists
const fs = require('fs');
const path = require('path');

class ShoppingListStorage {
  constructor() {
    this.dataDir = path.join(__dirname, '..', '..', 'data');
    this.listsFile = path.join(this.dataDir, 'lists.json');
    this.settingsFile = path.join(this.dataDir, 'settings.json');
    
    // Ensure data directory exists
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    this.lists = new Map(); // channelId -> { title, items: [], messageId }
    this.settings = new Map(); // guildId -> { shoppingChannel }
    
    // Load existing data
    this.loadData();
  }

  // Data persistence methods
  loadData() {
    try {
      // Load lists
      if (fs.existsSync(this.listsFile)) {
        const listsData = JSON.parse(fs.readFileSync(this.listsFile, 'utf8'));
        this.lists = new Map(Object.entries(listsData));
        console.log(`Loaded ${this.lists.size} shopping lists from storage`);
      }
      
      // Load settings
      if (fs.existsSync(this.settingsFile)) {
        const settingsData = JSON.parse(fs.readFileSync(this.settingsFile, 'utf8'));
        this.settings = new Map(Object.entries(settingsData));
        console.log(`Loaded settings for ${this.settings.size} guilds from storage`);
      }
    } catch (error) {
      console.error('Error loading data from storage:', error);
    }
  }

  saveData() {
    try {
      // Save lists
      const listsData = Object.fromEntries(this.lists);
      fs.writeFileSync(this.listsFile, JSON.stringify(listsData, null, 2));
      
      // Save settings
      const settingsData = Object.fromEntries(this.settings);
      fs.writeFileSync(this.settingsFile, JSON.stringify(settingsData, null, 2));
    } catch (error) {
      console.error('Error saving data to storage:', error);
    }
  }

  // Guild settings
  setShoppingChannel(guildId, channelId) {
    if (!this.settings.has(guildId)) {
      this.settings.set(guildId, {});
    }
    const settings = this.settings.get(guildId);
    settings.shoppingChannel = channelId;
    this.settings.set(guildId, settings);
    this.saveData();
  }

  getShoppingChannel(guildId) {
    const settings = this.settings.get(guildId);
    return settings ? settings.shoppingChannel : null;
  }

  // Shopping list management
  createList(channelId, title, items = []) {
    const list = {
      title,
      items: items.map(item => ({
        id: this.generateId(),
        text: item.trim(),
        checked: false,
        createdAt: new Date()
      })),
      messageId: null,
      createdAt: new Date()
    };
    this.lists.set(channelId, list);
    this.saveData();
    return list;
  }

  getList(channelId) {
    return this.lists.get(channelId) || null;
  }

  addItem(channelId, itemText, quantity = 1) {
    const list = this.lists.get(channelId);
    if (!list) return null;

    const item = {
      id: this.generateId(),
      text: quantity > 1 ? `${itemText} (${quantity})` : itemText,
      checked: false,
      createdAt: new Date()
    };

    list.items.push(item);
    this.lists.set(channelId, list);
    this.saveData();
    return item;
  }

  removeItem(channelId, itemId) {
    const list = this.lists.get(channelId);
    if (!list) return false;

    const itemIndex = list.items.findIndex(item => item.id === itemId);
    if (itemIndex === -1) return false;

    list.items.splice(itemIndex, 1);
    this.lists.set(channelId, list);
    this.saveData();
    return true;
  }

  toggleItemChecked(channelId, itemId) {
    const list = this.lists.get(channelId);
    if (!list) return null;

    const item = list.items.find(item => item.id === itemId);
    if (!item) return null;

    item.checked = !item.checked;
    this.lists.set(channelId, list);
    this.saveData();
    return item;
  }

  clearCompletedItems(channelId) {
    const list = this.lists.get(channelId);
    if (!list) return 0;

    const checkedCount = list.items.filter(item => item.checked).length;
    list.items = list.items.filter(item => !item.checked);
    this.lists.set(channelId, list);
    this.saveData();
    return checkedCount;
  }

  editItem(channelId, itemId, newText) {
    const list = this.lists.get(channelId);
    if (!list) return null;

    const item = list.items.find(item => item.id === itemId);
    if (!item) return null;

    item.text = newText;
    this.lists.set(channelId, list);
    this.saveData();
    return item;
  }

  clearList(channelId) {
    const list = this.lists.get(channelId);
    if (!list) return false;

    list.items = [];
    this.lists.set(channelId, list);
    this.saveData();
    return true;
  }

  setMessageId(channelId, messageId) {
    const list = this.lists.get(channelId);
    if (!list) return false;

    list.messageId = messageId;
    this.lists.set(channelId, list);
    this.saveData();
    return true;
  }

  deleteList(channelId) {
    const deleted = this.lists.delete(channelId);
    if (deleted) {
      this.saveData();
    }
    return deleted;
  }

  generateId() {
    return Math.random().toString(36).substr(2, 9);
  }

  // Get item by index
  getItemByIndex(channelId, index) {
    const list = this.lists.get(channelId);
    if (!list || index < 0 || index >= list.items.length) return null;
    return list.items[index];
  }
}

module.exports = new ShoppingListStorage();