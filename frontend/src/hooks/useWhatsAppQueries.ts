import { useQuery, UseQueryResult } from '@tanstack/react-query';
import axios from 'axios';
import { chatCache } from '@/utils/chatCache';

// Types
interface Session {
    session_id: string;
    name?: string;
    phone_number?: string;
    status?: string;
}

interface Chat {
    jid: string;
    name: string;
    lastMessage?: string;
    timestamp?: string;
    unreadCount?: number;
    avatar?: string;
    isGroup: boolean;
}

interface Message {
    id: string;
    message: string;
    timestamp: string;
    isFromMe: boolean;
    status?: string;
    sender?: string;
    type?: string;
    media_url?: string;
    content?: string;
}

// Query Keys
export const queryKeys = {
    sessions: ['sessions'] as const,
    chats: (sessionId?: string) => ['chats', sessionId] as const,
    messages: (sessionId?: string, chatJid?: string) =>
        ['messages', sessionId, chatJid] as const,
};

// Fetch Functions
const fetchSessions = async (): Promise<Session[]> => {
    const response = await axios.get('/api/whatsapp/v1/sessions');
    return response.data.success ? response.data.data : [];
};

const fetchChats = async (sessionId: string): Promise<Chat[]> => {
    if (!sessionId) return [];
    const response = await axios.get('/api/whatsapp/v1/chats', {
        params: { session_id: sessionId },
    });

    if (response.data.success) {
        const chats = (response.data.data || []).map((chat: any) => ({
            jid: chat.jid,
            name: chat.participant_name || chat.name || chat.jid,
            lastMessage: chat.last_message || '',
            timestamp: chat.last_timestamp || chat.timestamp,
            unreadCount: chat.unread_count || 0,
            avatar: chat.avatar_url,
            isGroup: chat.jid?.includes('@g.us') || false,
        }));

        // Cache the result
        chatCache.setChats(sessionId, chats);
        return chats;
    }
    return [];
};

const fetchMessages = async (
    sessionId: string,
    chatJid: string
): Promise<Message[]> => {
    if (!sessionId || !chatJid) return [];

    const response = await axios.get('/api/whatsapp/v1/messages', {
        params: {
            session_id: sessionId,
            chat_jid: chatJid,
            limit: 50,
            page: 1,
        },
    });

    if (response.data.success) {
        const apiMessages = response.data.data || [];
        const transformedMessages = apiMessages.map((msg: any) => ({
            id: msg.message_id,
            message: msg.content,
            timestamp: msg.timestamp,
            isFromMe: msg.is_from_me,
            status: msg.status,
            sender: msg.jid || msg.sender_jid,
            type: msg.message_type,
            media_url: msg.media_url,
        }));

        // Sort by timestamp ASC (oldest first)
        transformedMessages.sort(
            (a: Message, b: Message) =>
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        // Cache the result
        chatCache.setMessages(sessionId, chatJid, transformedMessages);
        return transformedMessages;
    }
    return [];
};

// Custom Hooks with Cache Integration
export const useSessions = (): UseQueryResult<Session[], Error> => {
    return useQuery({
        queryKey: queryKeys.sessions,
        queryFn: fetchSessions,
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 30 * 60 * 1000, // 30 minutes
    });
};

/**
 * useChats - Hybrid cache approach
 * 1. Try cache first (instant)
 * 2. Fetch fresh data in background
 * 3. Update cache
 */
export const useChats = (
    sessionId?: string
): UseQueryResult<Chat[], Error> => {
    return useQuery({
        queryKey: queryKeys.chats(sessionId),
        queryFn: () => fetchChats(sessionId!),
        enabled: !!sessionId, // Only run if sessionId exists
        staleTime: 2 * 60 * 1000, // 2 minutes - shorter for chats
        gcTime: 10 * 60 * 1000, // 10 minutes
        // Try cache first for instant load
        initialData: () => {
            if (!sessionId) return undefined;
            const cached = chatCache.getChats(sessionId);
            return cached || undefined;
        },
        initialDataUpdatedAt: () => {
            // Tell React Query cache is already stale (will refetch in background)
            return 0;
        },
    });
};

/**
 * useMessages - Hybrid cache approach
 * 1. Show cached messages instantly
 * 2. Fetch fresh in background
 * 3. SSE updates cache directly
 */
export const useMessages = (
    sessionId?: string,
    chatJid?: string
): UseQueryResult<Message[], Error> => {
    return useQuery({
        queryKey: queryKeys.messages(sessionId, chatJid),
        queryFn: () => fetchMessages(sessionId!, chatJid!),
        enabled: !!sessionId && !!chatJid, // Only run if both exist
        staleTime: 1 * 60 * 1000, // 1 minute - very fresh for messages
        gcTime: 5 * 60 * 1000, // 5 minutes
        refetchInterval: false, // Don't auto-refetch (SSE will handle real-time)
        // Try cache first for instant load
        initialData: () => {
            if (!sessionId || !chatJid) return undefined;
            const cached = chatCache.getMessages(sessionId, chatJid);
            return cached || undefined;
        },
        initialDataUpdatedAt: () => {
            // Always mark as stale so background refetch happens
            return 0;
        },
    });
};
