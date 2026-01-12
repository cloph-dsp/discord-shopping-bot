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