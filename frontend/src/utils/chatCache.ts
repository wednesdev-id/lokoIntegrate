/**
 * Mini Cache for WhatsApp Chat Messages
 * 
 * Lightweight localStorage cache specifically for chat messages
 * Works alongside React Query (which handles sessions/contacts)
 * Optimized for SSE real-time updates
 */

interface CacheItem<T> {
    data: T;
    expires: number;
    timestamp: number;
}

class ChatCache {
    private prefix = 'wa_chat_';
    private defaultTTL = 5 * 60 * 1000; // 5 minutes

    /**
     * Cache messages for a specific chat
     */
    setMessages(sessionId: string, chatJid: string, messages: any[], ttl?: number): void {
        try {
            const key = this.getMessageKey(sessionId, chatJid);
            const item: CacheItem<any[]> = {
                data: messages,
                expires: Date.now() + (ttl || this.defaultTTL),
                timestamp: Date.now(),
            };
            localStorage.setItem(key, JSON.stringify(item));
            console.log(`💾 Cached ${messages.length} messages for ${chatJid}`);
        } catch (error) {
            console.warn('Cache write failed:', error);
        }
    }

    /**
     * Get cached messages if not expired
     */
    getMessages(sessionId: string, chatJid: string): any[] | null {
        try {
            const key = this.getMessageKey(sessionId, chatJid);
            const item = localStorage.getItem(key);
            if (!item) return null;

            const cached: CacheItem<any[]> = JSON.parse(item);

            // Check if expired
            if (Date.now() > cached.expires) {
                this.deleteMessages(sessionId, chatJid);
                return null;
            }

            console.log(`⚡ Using cached messages (${cached.data.length}) for ${chatJid}`);
            return cached.data;
        } catch (error) {
            console.warn('Cache read failed:', error);
            return null;
        }
    }

    /**
     * Cache chat list
     */
    setChats(sessionId: string, chats: any[], ttl?: number): void {
        try {
            const key = this.getChatListKey(sessionId);
            const item: CacheItem<any[]> = {
                data: chats,
                expires: Date.now() + (ttl || this.defaultTTL),
                timestamp: Date.now(),
            };
            localStorage.setItem(key, JSON.stringify(item));
            console.log(`💾 Cached ${chats.length} chats`);
        } catch (error) {
            console.warn('Cache write failed:', error);
        }
    }

    /**
     * Get cached chat list
     */
    getChats(sessionId: string): any[] | null {
        try {
            const key = this.getChatListKey(sessionId);
            const item = localStorage.getItem(key);
            if (!item) return null;

            const cached: CacheItem<any[]> = JSON.parse(item);

            if (Date.now() > cached.expires) {
                this.deleteChats(sessionId);
                return null;
            }

            console.log(`⚡ Using cached chats (${cached.data.length})`);
            return cached.data;
        } catch (error) {
            console.warn('Cache read failed:', error);
            return null;
        }
    }

    /**
     * Add a single new message to cache (for SSE updates)
     */
    appendMessage(sessionId: string, chatJid: string, newMessage: any): void {
        const cached = this.getMessages(sessionId, chatJid);
        if (cached) {
            // Check if message already exists (prevent duplicates)
            const exists = cached.some(msg => msg.id === newMessage.id);
            if (!exists) {
                cached.push(newMessage);
                // Re-sort by timestamp
                cached.sort((a, b) =>
                    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                );
                this.setMessages(sessionId, chatJid, cached);
                console.log('✅ Appended new message to cache');
            }
        }
    }

    /**
     * Delete specific chat messages
     */
    deleteMessages(sessionId: string, chatJid: string): void {
        const key = this.getMessageKey(sessionId, chatJid);
        localStorage.removeItem(key);
    }

    /**
     * Delete chat list
     */
    deleteChats(sessionId: string): void {
        const key = this.getChatListKey(sessionId);
        localStorage.removeItem(key);
    }

    /**
     * Clear all chat cache for session
     */
    clearSession(sessionId: string): void {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith(`${this.prefix}${sessionId}_`)) {
                localStorage.removeItem(key);
            }
        });
        console.log(`🧹 Cleared cache for session ${sessionId}`);
    }

    /**
     * Clear all cache
     */
    clearAll(): void {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith(this.prefix)) {
                localStorage.removeItem(key);
            }
        });
        console.log('🧹 Cleared all chat cache');
    }

    // Helper methods
    private getMessageKey(sessionId: string, chatJid: string): string {
        return `${this.prefix}${sessionId}_msg_${chatJid}`;
    }

    private getChatListKey(sessionId: string): string {
        return `${this.prefix}${sessionId}_chats`;
    }

    /**
     * Get cache stats
     */
    getStats(): { items: number; sizeKB: number } {
        let items = 0;
        let totalBytes = 0;

        Object.keys(localStorage).forEach(key => {
            if (key.startsWith(this.prefix)) {
                items++;
                const item = localStorage.getItem(key);
                if (item) totalBytes += item.length * 2; // UTF-16 = 2 bytes per char
            }
        });

        return {
            items,
            sizeKB: Math.round(totalBytes / 1024),
        };
    }
}

// Singleton
export const chatCache = new ChatCache();

export default chatCache;
