const { Events } = require('discord.js');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`Ready! Logged in as ${client.user.tag}`);
    console.log(`Bot is in ${client.guilds.cache.size} guilds`);
    
    // Warm up the REST client by making a dummy request
    // This ensures the TLS connection is established early
    // Future requests will be much faster
    try {
      console.log('[READY] Warming up REST client...');
      await client.rest.get('/gateway');
      console.log('[READY] REST client warmed up, API calls will be fast');
    } catch (error) {
      console.error('[READY] Could not warm up REST client:', error.message);
    }
    
    // Set bot activity
    client.user.setActivity('🛒 Managing shopping lists', { type: 'WATCHING' });
  },
};