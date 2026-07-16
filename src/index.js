require('dotenv').config();
const dns = require('dns');
const { Agent } = require('undici');
dns.setDefaultResultOrder('ipv4first');
const { Client, Collection, GatewayIntentBits, REST } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Reuse TLS connections to avoid handshake delays when acknowledging interactions
const restAgent = new Agent({
  keepAliveTimeout: 60_000,
  keepAliveMaxTimeout: 120_000,
  headersTimeout: 30_000,
  bodyTimeout: 0,
  connect: { timeout: 30_000 }
});

const parsedRestTimeout = parseInt(process.env.REST_REQUEST_TIMEOUT_MS || '15000', 10);
const restTimeout = Number.isFinite(parsedRestTimeout) && parsedRestTimeout >= 3000 ? parsedRestTimeout : 15000;

// Create a new client instance with increased timeout for slow networks
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ],
  rest: {
    timeout: restTimeout,
    retries: 2, // Allow retries for transient network failures
    agent: restAgent
  }
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

// All interaction handling is now in src/events/interactionCreate.js

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

// Discord.js handles reconnection automatically; this is informational only.
client.on('disconnect', () => {
  console.warn('Bot disconnected, gateway will auto-reconnect');
});

// Login to Discord with your client's token
client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.error('Failed to login to Discord:', error);
  restAgent.close();
  if (client.restKeepAliveInterval) {
    clearInterval(client.restKeepAliveInterval);
  }
  process.exit(1);
});

// Log unhandled rejections, then exit so the supervisor restarts us cleanly.
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  gracefulShutdown('uncaughtException');
});



const gracefulShutdown = signal => {
  console.log(`${signal} received, shutting down gracefully...`);
  client.destroy();
  restAgent.close();
  if (client.restKeepAliveInterval) {
    clearInterval(client.restKeepAliveInterval);
  }
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
