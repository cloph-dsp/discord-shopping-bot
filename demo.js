// Demo script: runs against a throwaway SQLite DB, never the production one.
const fs = require('fs');
const os = require('os');
const path = require('path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsb-demo-'));
process.env.DSB_DATA_DIR = tempDir;

process.on('exit', () => {
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* best effort */ }
});

const storage = require('./src/utils/storage');

console.log('🛒 Discord Shopping Bot Demo (temporary database)\n');

console.log('Creating test shopping list...');
const testList = storage.createList('Weekly Groceries', [
  'Milk (2 liters)',
  'Bread',
  'Eggs (dozen)',
  'Apples',
  'Chicken breast'
]);
const listId = testList.id;

console.log('✅ Created list:', testList.title);
console.log('📝 Items:', testList.items.length);

console.log('\nAdding orange juice...');
storage.addItem(listId, 'Orange juice', 1);

console.log('\nChecking milk...');
const milk = testList.items.find(item => item.text.includes('Milk'));
if (milk) {
  storage.toggleItemChecked(listId, milk.id);
  console.log('✅ Milk checked');
}

console.log('\nChecking bread and clearing completed...');
const bread = testList.items.find(item => item.text.includes('Bread'));
if (bread) {
  storage.toggleItemChecked(listId, bread.id);
  console.log('✅ Bread checked');
  const clearedCount = storage.clearCompletedItems(listId);
  console.log(`🧹 Cleared ${clearedCount} completed items`);
}

const finalList = storage.getList(listId);
console.log('\n📋 Final list state:');
console.log('Total items:', finalList.items.length);
console.log('Items checked:', finalList.items.filter(item => item.checked).length);
console.log('Items unchecked:', finalList.items.filter(item => !item.checked).length);

console.log('\n🎉 Demo completed. Production database was not touched.');
