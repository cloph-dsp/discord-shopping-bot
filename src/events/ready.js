const { Events } = require('discord.js');
const storage = require('../utils/storage');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`Ready! Logged in as ${client.user.tag}`);
    console.log(`Bot is in ${client.guilds.cache.size} guilds`);

    // Lists created before guild scoping are global. With a single guild we can
    // assign them safely; with several, leave them global rather than guessing.
    if (client.guilds.cache.size === 1) {
      const moved = storage.claimLegacyLists(client.guilds.cache.first().id);
      if (moved > 0) console.log(`[READY] Assigned ${moved} legacy list(s) to this guild.`);
    } else if (client.guilds.cache.size > 1) {
      console.warn('[READY] Multiple guilds: legacy lists stay global until assigned manually.');
    }
    
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

    const parsedInterval = parseInt(process.env.REST_KEEPALIVE_INTERVAL_MS || '45000', 10);
    const keepAliveInterval = Number.isFinite(parsedInterval) && parsedInterval >= 15000
      ? parsedInterval
      : 45000;
    if (client.restKeepAliveInterval) {
      clearInterval(client.restKeepAliveInterval);
    }
    client.restKeepAliveInterval = setInterval(async () => {
      try {
        await client.rest.get('/gateway');
      } catch (error) {
        console.warn('[READY] REST keep-alive ping failed:', error.message);
      }
    }, keepAliveInterval);
    console.log(`[READY] REST keep-alive ping scheduled every ${keepAliveInterval}ms`);
    
    // Set bot activity
    client.user.setActivity('🛒 Managing shopping lists', { type: 'WATCHING' });
  },
};