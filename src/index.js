require('dotenv').config();
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ],
});

// Collection to store commands
client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
  }
}

// Load events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

// DEPRECATED: Global interaction handler - use event files instead
// This was causing race conditions with button/modal interactions
// All interaction handling is now delegated to:
//   - buttonInteraction.js for buttons and modals
//   - shop.js for slash commands (via interactionCreate in this global handler)
// NOTE: This handler ONLY processes slash commands and autocomplete
// Button/Modal interactions are handled by buttonInteraction.js event

// Slash command handler - separate from button/modal interactions
client.on('interactionCreate', async interaction => {
  // Handle autocomplete interactions for command options
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
  
  // Only handle slash commands here
  // Button and Modal interactions are handled by buttonInteraction.js
  if (!interaction.isChatInputCommand()) return;

  console.log(`[COMMAND] Received: ${interaction.commandName} from ${interaction.user.tag}`);

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
});

// Handle connection errors and resilience
client.on('error', error => {
  console.error('Discord client error:', error);
});

client.on('warn', info => {
  console.warn('Discord client warning:', info);
});

client.on('shardError', error => {
  console.error('WebSocket connection error:', error);
});

client.on('shardReady', (id, unavailableGuilds) => {
  console.log(`Shard ${id} ready! ${unavailableGuilds?.size || 0} guilds unavailable`);
});

client.on('shardDisconnect', (event, id) => {
  console.warn(`Shard ${id} disconnected (code: ${event.code})`);
});

client.on('shardReconnecting', id => {
  console.log(`Shard ${id} reconnecting...`);
});

client.on('shardResume', (id, replayedEvents) => {
  console.log(`Shard ${id} resumed (replayed ${replayedEvents} events)`);
});

// Auto-reconnect on disconnect
client.on('disconnect', () => {
  console.warn('Bot disconnected, attempting to reconnect...');
});

// Login to Discord with your client's token
client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.error('Failed to login to Discord:', error);
  process.exit(1);
});
