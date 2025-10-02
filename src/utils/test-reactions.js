// Simple test to debug emoji reactions
const { EmbedBuilder } = require('discord.js');

// Test emojis individually
const TEST_EMOJIS = {
  SIMPLE: '✅',           // Simple emoji
  NUMBER: '1️⃣',          // Number emoji
  CLEAR: '🧹',           // Clean emoji  
  ADD: '➕',             // Plus emoji
  EDIT: '✏️'             // Edit emoji
};

function createTestEmbed() {
  const embed = new EmbedBuilder()
    .setTitle('🛒 Test Shopping List')
    .setColor(0x00AE86)
    .setDescription(`
1️⃣ ⬜ Test Item 1
2️⃣ ⬜ Test Item 2
3️⃣ ⬜ Test Item 3

Click number emojis to test reactions!
    `)
    .setFooter({ text: 'Testing emoji reactions...' });

  return embed;
}

async function addTestReactions(message) {
  try {
    console.log('Adding test reactions...');
    
    // Test simple emoji first
    await message.react(TEST_EMOJIS.SIMPLE);
    console.log('✅ Simple emoji added');
    
    // Test number emojis
    await message.react(TEST_EMOJIS.NUMBER);
    console.log('1️⃣ Number emoji added');
    
    // Test other emojis
    await message.react(TEST_EMOJIS.CLEAR);
    console.log('🧹 Clear emoji added');
    
    await message.react(TEST_EMOJIS.ADD);
    console.log('➕ Add emoji added');
    
    await message.react(TEST_EMOJIS.EDIT);
    console.log('✏️ Edit emoji added');
    
    console.log('All test reactions added successfully!');
    
  } catch (error) {
    console.error('Error adding test reactions:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      status: error.status
    });
  }
}

module.exports = {
  TEST_EMOJIS,
  createTestEmbed,
  addTestReactions
};