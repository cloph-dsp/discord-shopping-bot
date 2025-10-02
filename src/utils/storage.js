// Simple in-memory storage for shopping lists
// In production, you'd want to use a proper database

class ShoppingListStorage {
  constructor() {
    this.lists = new Map(); // channelId -> { title, items: [], messageId }
    this.settings = new Map(); // guildId -> { shoppingChannel }
  }

  // Guild settings
  setShoppingChannel(guildId, channelId) {
    if (!this.settings.has(guildId)) {
      this.settings.set(guildId, {});
    }
    const settings = this.settings.get(guildId);
    settings.shoppingChannel = channelId;
    this.settings.set(guildId, settings);
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
    return item;
  }

  removeItem(channelId, itemId) {
    const list = this.lists.get(channelId);
    if (!list) return false;

    const itemIndex = list.items.findIndex(item => item.id === itemId);
    if (itemIndex === -1) return false;

    list.items.splice(itemIndex, 1);
    this.lists.set(channelId, list);
    return true;
  }

  toggleItemChecked(channelId, itemId) {
    const list = this.lists.get(channelId);
    if (!list) return null;

    const item = list.items.find(item => item.id === itemId);
    if (!item) return null;

    item.checked = !item.checked;
    this.lists.set(channelId, list);
    return item;
  }

  clearCompletedItems(channelId) {
    const list = this.lists.get(channelId);
    if (!list) return 0;

    const checkedCount = list.items.filter(item => item.checked).length;
    list.items = list.items.filter(item => !item.checked);
    this.lists.set(channelId, list);
    return checkedCount;
  }

  editItem(channelId, itemId, newText) {
    const list = this.lists.get(channelId);
    if (!list) return null;

    const item = list.items.find(item => item.id === itemId);
    if (!item) return null;

    item.text = newText;
    this.lists.set(channelId, list);
    return item;
  }

  clearList(channelId) {
    const list = this.lists.get(channelId);
    if (!list) return false;

    list.items = [];
    this.lists.set(channelId, list);
    return true;
  }

  setMessageId(channelId, messageId) {
    const list = this.lists.get(channelId);
    if (!list) return false;

    list.messageId = messageId;
    this.lists.set(channelId, list);
    return true;
  }

  deleteList(channelId) {
    return this.lists.delete(channelId);
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