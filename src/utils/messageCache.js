// Message cache management to reduce API calls and handle deleted messages
const { Collection } = require('discord.js');

class MessageCache {
  constructor() {
    // Cache messages by messageId
    this.cache = new Collection(); // messageId -> { message, lastFetched, channelId }
    
    // Cache expiration time (5 minutes)
    this.CACHE_TTL = 5 * 60 * 1000;
    
    // Clean up expired cache entries every minute
    setInterval(() => this.cleanupExpired(), 60 * 1000);
  }

  /**
   * Get a message from cache or fetch from Discord
   * @param {Channel} channel - Discord channel
   * @param {string} messageId - Message ID to fetch
   * @returns {Promise<Message|null>} Message or null if not found/deleted
   */
  async getMessage(channel, messageId) {
    // Check cache first
    const cached = this.cache.get(messageId);
    if (cached && !this.isExpired(cached)) {
      return cached.message;
    }

    // Fetch from Discord with timeout to prevent indefinite hangs
    try {
      console.log(`[CACHE:F] Fetching message ${messageId}`);
      const fetchPromise = channel.messages.fetch(messageId);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Message fetch timeout')), 5000)
      );
      const message = await Promise.race([fetchPromise, timeoutPromise]);
      console.log(`[CACHE:F] Fetched message ${messageId}`);
      
      // Update cache
      this.cache.set(messageId, {
        message,
        lastFetched: Date.now(),
        channelId: channel.id
      });
      
      return message;
    } catch (error) {
      // Message was deleted or not accessible
      if (error.code === 10008 || error.code === 50001) {
        this.cache.delete(messageId);
        return null;
      }
      
      // Other error - rethrow
      throw error;
    }
  }

  /**
   * Update a cached message after editing
   * @param {Message} message - Updated message object
   */
  updateCache(message) {
    const cached = this.cache.get(message.id);
    if (cached) {
      cached.message = message;
      cached.lastFetched = Date.now();
    } else {
      this.cache.set(message.id, {
        message,
        lastFetched: Date.now(),
        channelId: message.channel.id
      });
    }
  }

  /**
   * Invalidate a message in cache (force refetch on next access)
   * @param {string} messageId - Message ID to invalidate
   */
  invalidate(messageId) {
    this.cache.delete(messageId);
    console.log(`🗑️ Invalidated cache for message: ${messageId}`);
  }

  /**
   * Check if cache entry is expired
   * @param {Object} cached - Cached entry
   * @returns {boolean} True if expired
   */
  isExpired(cached) {
    return Date.now() - cached.lastFetched > this.CACHE_TTL;
  }

  /**
   * Clean up expired cache entries
   */
  cleanupExpired() {
    const now = Date.now();
    let cleaned = 0;

    for (const [messageId, cached] of this.cache.entries()) {
      if (now - cached.lastFetched > this.CACHE_TTL) {
        this.cache.delete(messageId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} expired cache entries`);
    }
  }
}

// Export singleton instance
module.exports = new MessageCache();
