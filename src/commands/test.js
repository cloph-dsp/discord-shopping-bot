const { SlashCommandBuilder } = require('discord.js');
const { createTestEmbed, addTestReactions } = require('../utils/test-reactions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('test')
    .setDescription('Test emoji reactions'),

  async execute(interaction) {
    try {
      // Create test embed
      const embed = createTestEmbed();
      const message = await interaction.reply({ embeds: [embed], fetchReply: true });
      
      console.log(`Test message created with ID: ${message.id}`);
      console.log(`Channel: ${message.channel.name} (${message.channel.id})`);
      console.log(`Guild: ${message.guild.name} (${message.guild.id})`);
      
      // Check bot permissions
      const permissions = message.guild.members.me.permissions;
      console.log('Bot permissions:', {
        AddReactions: permissions.has('AddReactions'),
        ReadMessageHistory: permissions.has('ReadMessageHistory'),
        SendMessages: permissions.has('SendMessages'),
        UseExternalEmojis: permissions.has('UseExternalEmojis')
      });
      
      // Test adding reactions
      setTimeout(async () => {
        await addTestReactions(message);
      }, 1000);
      
    } catch (error) {
      console.error('Error in test command:', error);
      await interaction.reply({ 
        content: `❌ Test failed: ${error.message}`, 
        ephemeral: true 
      });
    }
  },
};