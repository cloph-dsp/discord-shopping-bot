const { Events } = require('discord.js');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    const startTime = Date.now();
    
    // Only handle autocomplete and slash commands
    if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (command && typeof command.autocomplete === 'function') {
        try {
          await command.autocomplete(interaction);
        } catch (error) {
          console.error('Autocomplete error:', error);
        }
      }
      return;
    }

    // Ignore buttons and modals (handled by buttonInteraction.js)
    if (!interaction.isChatInputCommand()) return;

    console.log(`[COMMAND] Received: ${interaction.commandName} from ${interaction.user.tag} at ${startTime}`);

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      console.log(`[COMMAND] Executing: ${interaction.commandName}`);
      await command.execute(interaction);
      console.log(`[COMMAND] Completed: ${interaction.commandName}`);
    } catch (error) {
      console.error('Command execution error:', error);
      console.error('Stack trace:', error.stack);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: 'There was an error while executing this command!', flags: 64 });
        } else {
          await interaction.reply({ content: 'There was an error while executing this command!', flags: 64 });
        }
      } catch (followUpError) {
        console.error('Error sending error message:', followUpError);
      }
    }
  }
};
