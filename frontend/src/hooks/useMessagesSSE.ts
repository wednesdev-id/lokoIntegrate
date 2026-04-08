import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

interface MessageEvent {
    type: string;
    session_id: string;
    message_id: string;
    chat_jid: string;
    sender_jid: string;
    content: string;
    is_from_me: boolean;
    timestamp: string;
    status: string;
}

interface Chat {
    jid: string;
    name: string;
    lastMessage: string;
    lastMessageTime: string;
    unreadCount: number;
    avatar?: string;
    isGroup: boolean;
}

export function useMessagesSSE() {
    const [chats, setChats] = useState<Chat[]>([]);
    const [connected, setConnected] = useState(false);
    const eventSourceRef = useRef<EventSource | null>(null);

    // Load initial chats from API
    const loadInitialChats = useCallback(async () => {
        try {
            const response = await axios.get('/api/whatsapp/v1/chats');
            if (response.data.success) {
                const apiChats = response.data.data.chats || [];
                const transformedChats: Chat[] = apiChats.map((chat: any) => ({
                    jid: chat.jid,
                    name: chat.name || chat.jid.split('@')[0],
                    lastMessage: chat.last_message || 'No messages yet',
                    lastMessageTime: chat.last_message_at || chat.updated_at || new Date().toISOString(),
                    unreadCount: chat.unread_count || 0,
                    avatar: chat.profile_pic,
                    isGroup: chat.is_group || false
                }));
                setChats(transformedChats);
            }
        } catch (error) {
            console.error('Failed to load initial chats:', error);
        }
    }, []);

    // Update chat list when new message arrives
    const handleNewMessage = useCallback((event: MessageEvent) => {
        setChats(prevChats => {
            // Find existing chat
            const existingIndex = prevChats.findIndex(c => c.jid === event.chat_jid);

            if (existingIndex >= 0) {
                // Update existing chat
                const updated = [...prevChats];
                updated[existingIndex] = {
                    ...updated[existingIndex],
                    lastMessage: event.content,
                    lastMessageTime: event.timestamp,
                    unreadCount: event.is_from_me ? updated[existingIndex].unreadCount : updated[existingIndex].unreadCount + 1
                };

                // Move to top
                const [chat] = updated.splice(existingIndex, 1);
                return [chat, ...updated];
            } else {
                // Add new chat
                const newChat: Chat = {
                    jid: event.chat_jid,
                    name: event.sender_jid.split('@')[0],
                    lastMessage: event.content,
                    lastMessageTime: event.timestamp,
                    unreadCount: event.is_from_me ? 0 : 1,
                    isGroup: event.chat_jid.endsWith('@g.us')
                };
                return [newChat, ...prevChats];
            }
        });
    }, []);

    // Connect to SSE stream
    useEffect(() => {
        // Load initial chats
        loadInitialChats();

        // Connect to SSE
        const token = localStorage.getItem('auth_token') || '';
        const eventSource = new EventSource(`/api/whatsapp/v1/messages/stream?token=${token}`);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
            console.log('[SSE] Connected to message stream');
            setConnected(true);
        };

        eventSource.onmessage = (e) => {
            try {
                const event: MessageEvent = JSON.parse(e.data);
                console.log('[SSE] New message:', event);

                if (event.type === 'new_message') {
                    handleNewMessage(event);
                }
            } catch (error) {
                console.error('[SSE] Failed to parse message:', error);
            }
        };

        eventSource.onerror = (error) => {
            console.error('[SSE] Connection error:', error);
            setConnected(false);

            // Auto-reconnect after 5 seconds
            setTimeout(() => {
                console.log('[SSE] Attempting to reconnect...');
                eventSource.close();
            }, 5000);
        };

        // Cleanup on unmount
        return () => {
            if (eventSourceRef.current) {
                console.log('[SSE] Disconnecting from message stream');
                eventSourceRef.current.close();
            }
        };
    }, [loadInitialChats, handleNewMessage]);

    return {
        chats,
        connected,
        refreshChats: loadInitialChats
    };
}
