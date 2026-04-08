/**
 * WhatsApp Data Cache Utility
 * 
 * Simple localStorage-based cache with TTL (Time To Live)
 * Perfect for caching chats and messages with auto-expiry
 */

interface CacheItem<T> {
  data: T;
  expires: number;
  version: string;
}

const CACHE_VERSION = '1.0.0'; // Increment to invalidate all cache

class WhatsAppCache {
  private prefix = 'whatsapp_cache_';

  /**
   * Save data to cache with TTL
   * @param key - Cache key
   * @param data - Data to cache
   * @param ttlMs - Time to live in milliseconds (default: 5 minutes)
   */
  set<T>(key: string, data: T, ttlMs: number = 5 * 60 * 1000): void {
    try {
      const cacheItem: CacheItem<T> = {
        data,
        expires: Date.now() + ttlMs,
        version: CACHE_VERSION,
      };
      localStorage.setItem(
        this.prefix + key,
        JSON.stringify(cacheItem)
      );
    } catch (error) {
      console.warn('Failed to save to cache:', error);
      // Fail silently - cache is optional
    }
  }

  /**
   * Get data from cache if not expired
   * @param key - Cache key
   * @returns Cached data or null if expired/missing
   */
  get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(this.prefix + key);
      if (!item) return null;

      const cacheItem: CacheItem<T> = JSON.parse(item);

      // Check version mismatch
      if (cacheItem.version !== CACHE_VERSION) {
        this.delete(key);
        return null;
      }

      // Check expiry
      if (Date.now() > cacheItem.expires) {
        this.delete(key);
        return null;
      }

      return cacheItem.data;
    } catch (error) {
      console.warn('Failed to read from cache:', error);
      return null;
    }
  }

  /**
   * Delete specific cache entry
   */
  delete(key: string): void {
    try {
      localStorage.removeItem(this.prefix + key);
    } catch (error) {
      console.warn('Failed to delete cache:', error);
    }
  }

  /**
   * Clear all WhatsApp cache
   */
  clearAll(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }

  /**
   * Get cache stats for debugging
   */
  getStats(): { count: number; totalSize: number } {
    let count = 0;
    let totalSize = 0;

    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          count++;
          const item = localStorage.getItem(key);
          if (item) totalSize += item.length;
        }
      });
    } catch (error) {
      console.warn('Failed to get cache stats:', error);
    }

    return { count, totalSize };
  }
}

// Singleton instance
export const cache = new WhatsAppCache();

// Cache keys factory
export const cacheKeys = {
  sessions: () => 'sessions',
  chats: (sessionId: string) => `chats_${sessionId}`,
  messages: (sessionId: string, chatJid: string) => 
    `messages_${sessionId}_${chatJid}`,
  chatList: (sessionId: string) => `chat_list_${sessionId}`,
};

// Cache TTLs (Time To Live)
export const cacheTTL = {
  sessions: 10 * 60 * 1000,    // 10 minutes
  chats: 5 * 60 * 1000,         // 5 minutes
  messages: 3 * 60 * 1000,      // 3 minutes
  chatList: 5 * 60 * 1000,      // 5 minutes
};

export default cache;
