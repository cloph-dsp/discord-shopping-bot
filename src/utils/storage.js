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
    
    // Queue for save operations to prevent concurrent writes
    this.saveQueue = Promise.resolve();
    this.pendingSave = false;
    
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
    // Queue save operations to prevent concurrent writes
    if (this.pendingSave) {
      // A save is already scheduled, no need to queue another
      return;
    }
    
    this.pendingSave = true;
    
    // Queue the save operation
    this.saveQueue = this.saveQueue.then(() => {
      return new Promise((resolve) => {
        // Small delay to batch multiple rapid changes
        setTimeout(() => {
          try {
            // Save lists
            const listsData = Object.fromEntries(this.lists);
            fs.writeFileSync(this.listsFile, JSON.stringify(listsData, null, 2));
            
            // Save settings
            const settingsData = Object.fromEntries(this.settings);
            fs.writeFileSync(this.settingsFile, JSON.stringify(settingsData, null, 2));
            
            console.log('💾 Data saved successfully');
          } catch (error) {
            console.error('Error saving data to storage:', error);
          } finally {
            this.pendingSave = false;
            resolve();
          }
        }, 100); // 100ms debounce
      });
    });
  }

  // Channel settings (deprecated - kept for backwards compatibility)
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
  createList(title, items = []) {
    const listId = this.generateId();
    const list = {
      id: listId,
      title,
      items: items.map(item => ({
        id: this.generateId(),
        text: item.trim(),
        checked: false,
        createdAt: new Date()
      })),
      messageId: null,
      channelId: null, // Will be set when displayed
      createdAt: new Date()
    };
    this.lists.set(listId, list);
    this.saveData();
    return list;
  }

  // Set which list is active in a channel
  setActiveList(channelId, listId) {
    const list = this.lists.get(listId);
    if (list) {
      list.channelId = channelId;
      this.lists.set(listId, list);
      this.saveData();
    }
  }

  // Get active list for a channel
  getActiveList(channelId) {
    for (const [listId, list] of this.lists.entries()) {
      if (list.channelId === channelId) {
        return { listId, list };
      }
    }
    return null;
  }

  // Get list by ID
  getList(listId) {
    return this.lists.get(listId) || null;
  }

  // Legacy: get list by channel (for backwards compatibility)
  getListByChannel(channelId) {
    const active = this.getActiveList(channelId);
    return active ? active.list : null;
  }

  addItem(listId, itemText, quantity = 1) {
    const list = this.lists.get(listId);
    if (!list) return null;

    const item = {
      id: this.generateId(),
      text: quantity > 1 ? `${itemText} (${quantity})` : itemText,
      checked: false,
      createdAt: new Date()
    };

    list.items.push(item);
    this.lists.set(listId, list);
    this.saveData();
    return item;
  }

  removeItem(listId, itemId) {
    const list = this.lists.get(listId);
    if (!list) return false;

    const itemIndex = list.items.findIndex(item => item.id === itemId);
    if (itemIndex === -1) return false;

    list.items.splice(itemIndex, 1);
    this.lists.set(listId, list);
    this.saveData();
    return true;
  }

  toggleItemChecked(listId, itemId) {
    const list = this.lists.get(listId);
    if (!list) return null;

    const item = list.items.find(item => item.id === itemId);
    if (!item) return null;

    item.checked = !item.checked;
    this.lists.set(listId, list);
    this.saveData();
    return item;
  }

  clearCompletedItems(listId) {
    const list = this.lists.get(listId);
    if (!list) return 0;

    const checkedCount = list.items.filter(item => item.checked).length;
    list.items = list.items.filter(item => !item.checked);
    this.lists.set(listId, list);
    this.saveData();
    return checkedCount;
  }

  editItem(listId, itemId, newText) {
    const list = this.lists.get(listId);
    if (!list) return null;

    const item = list.items.find(item => item.id === itemId);
    if (!item) return null;

    item.text = newText;
    this.lists.set(listId, list);
    this.saveData();
    return item;
  }

  clearList(listId) {
    const list = this.lists.get(listId);
    if (!list) return false;

    list.items = [];
    this.lists.set(listId, list);
    this.saveData();
    return true;
  }

  setMessageId(listId, messageId) {
    const list = this.lists.get(listId);
    if (!list) return false;

    list.messageId = messageId;
    this.lists.set(listId, list);
    this.saveData();
    return true;
  }

  clearListMessage(listId) {
    const list = this.lists.get(listId);
    if (!list) return false;

    list.messageId = null;
    this.lists.set(listId, list);
    this.saveData();
    return true;
  }

  deleteList(listId) {
    const deleted = this.lists.delete(listId);
    if (deleted) {
      this.saveData();
    }
    return deleted;
  }

  generateId() {
    return Math.random().toString(36).substr(2, 9);
  }

  // Get item by index
  getItemByIndex(listId, index) {
    const list = this.lists.get(listId);
    if (!list || index < 0 || index >= list.items.length) return null;
    return list.items[index];
  }
  
  // Find a list by its title
  getListByTitle(title) {
    for (const [listId, list] of this.lists.entries()) {
      if (list.title === title) {
        return { listId, list };
      }
    }
    return null;
  }

  // Get list by message ID
  getListByMessageId(messageId) {
    for (const [listId, list] of this.lists.entries()) {
      if (list.messageId === messageId) {
        return { listId, list };
      }
    }
    return null;
  }

  // Get all list titles
  getAllListTitles() {
    return Array.from(this.lists.values()).map(list => list.title);
  }

  // Get all lists
  getAllLists() {
    return Array.from(this.lists.entries()).map(([listId, list]) => ({ listId, list }));
  }
}

module.exports = new ShoppingListStorage();