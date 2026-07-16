// Demo script to test the shopping bot functionality locally
// This simulates the bot's features for testing

const storage = require('./src/utils/storage');
const { createShoppingListEmbed } = require('./src/utils/embeds');

console.log('🛒 Discord Shopping Bot Demo\n');

// Test storage functionality
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

// Test adding items
console.log('\nAdding orange juice...');
storage.addItem(listId, 'Orange juice', 1);

// Test checking items
console.log('\nChecking milk...');
const milk = testList.items.find(item => item.text.includes('Milk'));
if (milk) {
  storage.toggleItemChecked(listId, milk.id);
  console.log('✅ Milk checked');
}

// Test clearing completed items
console.log('\nChecking bread and clearing completed...');
const bread = testList.items.find(item => item.text.includes('Bread'));
if (bread) {
  storage.toggleItemChecked(listId, bread.id);
  console.log('✅ Bread checked');
  const clearedCount = storage.clearCompletedItems(listId);
  console.log(`🧹 Cleared ${clearedCount} completed items`);
}

// Show final state
const finalList = storage.getList(listId);
console.log('\n📋 Final list state:');
console.log('Total items:', finalList.items.length);
console.log('Items checked:', finalList.items.filter(item => item.checked).length);
console.log('Items unchecked:', finalList.items.filter(item => !item.checked).length);

console.log('\n🎉 Demo completed! The bot is ready to use in Discord.');
console.log('\nNext steps:');
console.log('1. Set up your Discord bot token in .env');
console.log('2. Run: npm run deploy');
console.log('3. Run: npm start');
console.log('4. Invite the bot to your server and use /shop commands!');