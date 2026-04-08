import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { MediaModal } from './MediaModal';
import { ToastContainer } from '@/components/common/Toast';
import { initializeNotificationSound, playNotificationSound } from '@/utils/notificationSound';
import { formatWhatsAppTime } from '@/utils/timeFormat';
import { ContactListSidebar } from './ContactListSidebar';
import { ChatPanel } from './ChatPanel';
import { useSession } from '@/contexts/SessionContext';
import { useContacts } from '@/contexts/ContactsContext';
import { ForwardDialog } from './ForwardDialog';
import { useSearchParams } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Chat {
  jid: string;
  name: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  avatar?: string;
  isGroup: boolean;
  isInconsistent?: boolean;
}

interface Message {
  id: string;
  message: string;
  timestamp: string;
  isFromMe: boolean;
  status?: string;
  sender?: string;
  type?: string;
  message_type?: string;
  media_url?: string;
  mediaURL?: string;
  content?: string;
  quoted?: {
    id: string;
    message: string;
    sender?: string;
  } | null;
}

export default function ChatManagement() {
  // Use SessionContext for session management (uses localStorage cache)
  const { activeSession, refreshSessions } = useSession();
  const { getContactName } = useContacts(); // Use Context

  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Chat List Pagination
  const [chatOffset, setChatOffset] = useState(0);
  const [hasMoreChats, setHasMoreChats] = useState(true);
  const [isLoadingMoreChats, setIsLoadingMoreChats] = useState(false);
  const [archivedChatJids, setArchivedChatJids] = useState<string[]>([]);
  const [inconsistentChatJids, setInconsistentChatJids] = useState<string[]>([]);
  const [deleteChatDialogOpen, setDeleteChatDialogOpen] = useState(false);
  const [deleteFromWAChoice, setDeleteFromWAChoice] = useState(false);

  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [mediaModal, setMediaModal] = useState<{
    isOpen: boolean;
    type: 'image' | 'video' | 'audio' | null;
    url: string | null;
    caption?: string | null;
  }>({ isOpen: false, type: null, url: null, caption: null });
  const [toasts, setToasts] = useState<Array<{
    id: string;
    title: string;
    message: string;
    timestamp?: string;
    chatJid?: string;
  }>>([]);

  // Removed local contactMap state

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize notification sound on mount
  useEffect(() => {
    initializeNotificationSound();
  }, []);

  const [searchParams, setSearchParams] = useSearchParams();
  const normalizeJid = (jid?: string) => (jid || '').split('@')[0];

  useEffect(() => {
    if (!activeSession?.session_id) return;
    const raw = localStorage.getItem(`archived_chat_jids_${activeSession.session_id}`);
    if (!raw) {
      setArchivedChatJids([]);
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      setArchivedChatJids(Array.isArray(parsed) ? parsed : []);
    } catch {
      setArchivedChatJids([]);
    }
  }, [activeSession?.session_id]);

  useEffect(() => {
    if (!activeSession?.session_id) return;
    localStorage.setItem(`archived_chat_jids_${activeSession.session_id}`, JSON.stringify(archivedChatJids));
  }, [activeSession?.session_id, archivedChatJids]);

  useEffect(() => {
    if (!activeSession?.session_id) return;
    const raw = localStorage.getItem(`inconsistent_chat_jids_${activeSession.session_id}`);
    if (!raw) {
      setInconsistentChatJids([]);
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      setInconsistentChatJids(Array.isArray(parsed) ? parsed : []);
    } catch {
      setInconsistentChatJids([]);
    }
  }, [activeSession?.session_id]);

  useEffect(() => {
    if (!activeSession?.session_id) return;
    localStorage.setItem(`inconsistent_chat_jids_${activeSession.session_id}`, JSON.stringify(inconsistentChatJids));
  }, [activeSession?.session_id, inconsistentChatJids]);

  // Handle URL JID parameter for auto-selecting a chat (e.g. from ContactManagement)
  useEffect(() => {
    const jidParam = searchParams.get('jid');

    console.log('[ChatManagement] URL parameter handler:', {
      jidParam,
      activeSession: activeSession?.session_id,
      sessionStatus: activeSession?.status,
      hasChats: chats.length > 0
    });

    // We only proceed if we have an active session
    if (jidParam && activeSession) {
      // 1. Check if the chat exists in the currently loaded list (match both JID formats)
      const normalizedJidParam = normalizeJid(jidParam);

      console.log('[ChatManagement] Looking for chat matching:', {
        originalJidParam: jidParam,
        normalizedJidParam,
        totalChats: chats.length,
        allChatsJids: chats.map(c => ({ jid: c.jid, normalized: normalizeJid(c.jid) }))
      });

      let chatToSelect = chats.find(c => normalizeJid(c.jid) === normalizedJidParam);

      console.log('[ChatManagement] Chat found in list:', chatToSelect ? {
        jid: chatToSelect.jid,
        name: chatToSelect.name,
        isGroup: chatToSelect.isGroup
      } : 'NOT FOUND - will create new chat');

      // 2. If not found in loaded chats, we might need to fetch it or create a temporary one
      if (!chatToSelect) {
        // Construct a new synthetic chat so the user can start messaging immediately
        // The name will be resolved by getContactName if available, or fallback to JID
        const displayName = getContactName(jidParam) || jidParam.replace('@s.whatsapp.net', '');
        
        chatToSelect = {
          jid: jidParam,
          name: displayName,
          lastMessage: '',
          lastMessageTime: new Date().toISOString(),
          unreadCount: 0,
          isGroup: jidParam.includes('@g.us'),
          avatar: undefined,
          isInconsistent: inconsistentChatJids.includes(normalizeJid(jidParam)),
        };
        
        // Add this temporary chat to the list so it appears selected
        setChats(prev => {
            // Check if it already exists to avoid duplicates
            if (prev.some(c => c.jid === chatToSelect!.jid)) return prev;
            return [chatToSelect!, ...prev];
        });
      }

      // 3. Select the chat
      if (chatToSelect && (!selectedChat || selectedChat.jid !== chatToSelect.jid)) {
        console.log('[ChatManagement] Selecting chat:', {
          jid: chatToSelect.jid,
          name: chatToSelect.name,
          isGroup: chatToSelect.isGroup,
          wasSelected: !!selectedChat
        });
        setSelectedChat(chatToSelect);
        
        // On mobile, close sidebar when a chat is selected via URL
        if (window.innerWidth < 768) {
            setIsMobileSidebarOpen(false);
        }
        
        // Clean up URL
        console.log('[ChatManagement] Chat selected successfully, cleaning up URL parameter');
        searchParams.delete('jid');
        setSearchParams(searchParams, { replace: true });
      } else if (jidParam && activeSession) {
        console.log('[ChatManagement] Chat already selected or no change needed');
      } else {
        console.log('[ChatManagement] Skipping - no jidParam or no activeSession');
      }
    }
  }, [searchParams, activeSession, chats, getContactName, selectedChat, setSearchParams]);

  // Persist selected chat to localStorage to survive tab switches/refreshes
  useEffect(() => {
    if (selectedChat && activeSession) {
      localStorage.setItem(`last_selected_chat_jid_${activeSession.session_id}`, selectedChat.jid);
    }
  }, [selectedChat, activeSession?.session_id]);

  // Restore selected chat on mount if available
  useEffect(() => {
    if (!activeSession) return;
    
    const lastJid = localStorage.getItem(`last_selected_chat_jid_${activeSession.session_id}`);
    if (lastJid && !selectedChat && chats.length > 0) {
       const restoredChat = chats.find(c => c.jid === lastJid);
       if (restoredChat) {
         setSelectedChat(restoredChat);
         // Open sidebar on mobile
         if (window.innerWidth < 768) setIsMobileSidebarOpen(false);
       }
    }
  }, [chats, activeSession?.session_id, selectedChat]);

  // Toast functions
  const addToast = (title: string, message: string, chatJid?: string, timestamp?: string) => {
    // Attempt to resolve title using Context
    let displayTitle = title;
    if (chatJid) {
      // Try to resolve name if title looks like a phone number or JID
      const resolved = getContactName(chatJid);
      if (resolved && resolved !== chatJid && resolved !== chatJid.split('@')[0]) {
        displayTitle = resolved;
      }
    }

    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, title: displayTitle, message, chatJid, timestamp }]);
    setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  // Load chats
  const loadChats = async (isLoadMore = false, refreshUpToCurrent = false) => {
    if (!activeSession) {
      console.log('⚠️  ChatManagement: No active session, skipping chat load');
      setChats([]); // Reset chats if no session
      return;
    }

    if (isLoadMore && (isLoadingMoreChats || !hasMoreChats)) return;

    try {
      if (isLoadMore) setIsLoadingMoreChats(true);

      console.log(`📋 ChatManagement: Loading chats for session: ${activeSession.session_name} (isLoadMore: ${isLoadMore})`);

      let fetchOffset = 0;
      let fetchLimit = 100;

      if (isLoadMore) {
        fetchOffset = chatOffset;
      } else if (refreshUpToCurrent && chatOffset > 100) {
        // Fetch everything loaded so far if it's a refresh to not lose scrolled chats
        fetchLimit = chatOffset;
      }

      const response = await axios.get('/api/whatsapp/v1/chats', {
        params: {
          session_id: activeSession.session_id,
          session_code: activeSession.session_code,
          offset: fetchOffset,
          limit: fetchLimit
        },
      });

      if (response.data.success) {
        // API returns: { success, message, data: { chats: [...], total: N, has_more: boolean } }
        const chatList = response.data.data?.chats || [];
        const hasMoreReturned = response.data.data?.has_more ?? false;

        console.log('📋 ChatManagement: Received', chatList.length, 'chats from API');

        const transformedChats = chatList.map((chat: any) => {
          const lastTime = chat.last_message_time || chat.lastMessageTime || chat.updated_at;

          // Use backend name if it's a real name (not just the raw JID).
          // Otherwise, rely on getContactName to fetch from contacts or strip the @suffix for a clean phone number.
          let displayName = chat.jid;
          if (chat.jid) {
            const resolved = getContactName(chat.jid);
            displayName = (chat.name && chat.name !== chat.jid) ? chat.name : resolved;
          }

          return {
            jid: chat.jid || chat.chat_jid || chat.ID,
            name: displayName,
            lastMessage: chat.last_message || chat.lastMessage,
            lastMessageTime: lastTime,
            unreadCount: chat.unread_count || chat.unreadCount || 0,
            avatar: chat.avatar,
            isGroup: chat.is_group || chat.isGroup || false,
            isInconsistent: inconsistentChatJids.includes(normalizeJid(chat.jid || chat.chat_jid || chat.ID)),
          };
        });

        // Helper to get deduplication key
        const getDedupKey = (chatJid: string, isGrp: boolean) => {
          if (!chatJid) return "";
          if (isGrp || chatJid.includes('@g.us') || chatJid.includes('@broadcast')) {
            return chatJid.toLowerCase();
          }
          return chatJid.split('@')[0];
        };

        // Deduplicate and sort
        const chatMap = new Map<string, Chat>();

        // If loading more, preserve existing chats first
        // IMPORTANT: When activeSession changes (isLoadMore=false), we DO NOT preserve existing chats
        if (isLoadMore) {
          chats.forEach(chat => {
            const dedupKey = getDedupKey(chat.jid, chat.isGroup);
            if (dedupKey) chatMap.set(dedupKey, chat);
          });
        }

        transformedChats.forEach((chat: Chat) => {
          const dedupKey = getDedupKey(chat.jid, chat.isGroup);
          if (!dedupKey) return;
          
          // If not loading more, we always overwrite/add because we started with empty map
          if (!chatMap.has(dedupKey)) {
            chatMap.set(dedupKey, chat);
          } else {
            const existing = chatMap.get(dedupKey)!;
            const existingTime = existing.lastMessageTime ? new Date(existing.lastMessageTime).getTime() : 0;
            const newTime = chat.lastMessageTime ? new Date(chat.lastMessageTime).getTime() : 0;
            // Prefer the chat with the most recent message
            if (newTime > existingTime) {
              chatMap.set(dedupKey, chat);
            }
          }
        });

        const uniqueChats = Array.from(chatMap.values());
        uniqueChats.sort((a, b) => {
          const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
          const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
          return timeB - timeA;
        });

        const visibleChats = uniqueChats.filter((chat) => !archivedChatJids.includes(normalizeJid(chat.jid)));
        console.log('✅ ChatManagement: Loaded', visibleChats.length, 'visible chats');
        setChats(visibleChats);

        if (isLoadMore) {
          setChatOffset(prev => prev + fetchLimit);
        } else {
          setChatOffset(fetchLimit);
        }
        setHasMoreChats(hasMoreReturned);
      } else {
        console.error('❌ ChatManagement: API returned success=false:', response.data.message);
        if (!isLoadMore) setChats([]);
      }
    } catch (error) {
      console.error('❌ ChatManagement: Failed to load chats:', error);
      if (!isLoadMore) setChats([]);
    } finally {
      if (isLoadMore) setIsLoadingMoreChats(false);
    }
  };

  // Load messages (offset-based pagination)
  const loadMessages = async (chat: Chat | null, offset = 0, append = false) => {
    if (!chat || !activeSession) return;

    try {
      if (append) setIsLoadingMore(true);

      const limit = 50;

      const response = await axios.get('/api/whatsapp/v1/messages', {
        params: {
          session_id: activeSession.session_id,
          session_code: activeSession.session_code,
          chat_jid: chat.jid,
          limit,
          offset,
        },
      });

      if (response.data.success) {
        // API returns: { success, message, data: { messages: [...], total: N } }
        const apiMessages = response.data.data?.messages || response.data.data || [];
        console.log('📨 Received', apiMessages.length, 'messages from API');

        const transformedMessages = apiMessages.map((msg: any) => ({
          id: msg.message_id,
          message: msg.content,
          timestamp: msg.timestamp,
          isFromMe: msg.is_from_me,
          status: msg.status,
          sender: msg.jid || msg.sender_jid,
          type: msg.message_type,
          media_url: msg.media_url,
          quoted: msg.quoted_message_id ? {
            id: msg.quoted_message_id,
            message: msg.quoted_message_content || '',
            sender: msg.quoted_message_sender,
          } : null,
        }));

        // Sort by timestamp ASC (oldest first)
        transformedMessages.sort((a: any, b: any) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        if (append) {
          setMessages(prev => [...transformedMessages, ...prev]);
        } else {
          setMessages(transformedMessages);

          // Auto mark as read upon loading new chat
          const unreadIds = apiMessages
            .filter((msg: any) => !msg.is_from_me && !msg.status?.includes('read'))
            .map((msg: any) => msg.message_id);

          if (unreadIds.length > 0 && activeSession) {
            axios.post('/api/whatsapp/v1/messages/mark-read', {
              session_id: activeSession.session_id,
              session_code: activeSession.session_code,
              chat_jid: chat.jid,
              message_ids: unreadIds,
            }).catch(console.error);
          }
        }

        // Determine if there are potentially more messages to load
        const total = response.data.pagination?.total ?? undefined;
        if (typeof total === 'number') {
          setHasMore(offset + apiMessages.length < total);
        } else {
          // Fallback: assume "no more" only when we receive less than limit
          setHasMore(apiMessages.length === limit);
        }
        // Don't auto-scroll to bottom - let user scroll naturally
        // setTimeout(() => scrollToBottom(), 100);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
      if (!append) setMessages([]);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleLoadMoreMessages = () => {
    if (selectedChat && hasMore && !isLoadingMore) {
      // Use current messages.length as offset to fetch older messages
      loadMessages(selectedChat, messages.length, true);
    }
  };

  // Send message
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedChat || !activeSession) return;

    // Create optimistic message for instant UI update
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      message: messageInput,
      content: messageInput,
      timestamp: new Date().toISOString(),
      isFromMe: true,
      status: 'pending',
      message_type: 'text',
      type: 'text',
      quoted: replyingTo ? {
        id: replyingTo.id,
        message: replyingTo.message || replyingTo.content || '',
        sender: replyingTo.sender
      } : null
    };

    const messageText = messageInput;

    try {
      // 1. Add to UI immediately
      setMessages(prev => [...prev, optimisticMessage]);

      // 2. Clear input immediately
      setMessageInput('');
      setReplyingTo(null);

      // 3. Prepare payload
      const payload: any = {
        session_id: activeSession.session_id,
        session_code: activeSession.session_code,
        jid: selectedChat.jid,
        message: messageText,
        message_type: 'text',
      };

      if (replyingTo) {
        payload.quoted_message_id = replyingTo.id;
      }

      // 4. Send to backend
      const response = await axios.post('/api/whatsapp/v1/messages/send', payload);

      // 5. Update with real message ID
      if (response.data.success && response.data.data?.message_id) {
        setMessages(prev => prev.map(msg =>
          msg.id === tempId
            ? { ...msg, id: response.data.data.message_id, status: 'sent' }
            : msg
        ));
      }

    } catch (error) {
      console.error('Failed to send message:', error);

      // Rollback on error
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      setMessageInput(messageText);
      alert('Failed to send message. Please try again.');
    }
  };

  // Message action handlers
  const handleReply = (message: Message) => {
    setReplyingTo(message);
  };

  const handleForward = (message: Message) => {
    setForwardingMessage(message);
  };

  const handleForwardToChat = async (chatJid: string, message: Message) => {
    if (!activeSession) return;

    try {
      await axios.post('/api/whatsapp/v1/messages/send', {
        session_id: activeSession.session_id,
        session_code: activeSession.session_code,
        jid: chatJid,
        message: message.message || message.content,
      });

      addToast('Message forwarded', `Sent to ${chats.find(c => c.jid === chatJid)?.name || chatJid}`);
    } catch (error) {
      console.error('Failed to forward message:', error);
      addToast('Forward failed', 'Could not forward message');
    }
  };

  const handleDelete = async (messageId: string, deleteForEveryone: boolean) => {
    if (!activeSession || !selectedChat) return;

    try {
      await axios.delete(`/api/whatsapp/v1/messages/${messageId}`, {
        data: {
          session_id: activeSession.session_id,
          delete_for_everyone: deleteForEveryone,
        },
      });

      // Refresh messages
      await loadMessages(selectedChat);
      addToast('Message deleted', deleteForEveryone ? 'Deleted for everyone' : 'Deleted for you');
    } catch (error) {
      console.error('Failed to delete message:', error);
      addToast('Delete failed', 'Could not delete message');
    }
  };

  const handleDeleteChat = (deleteFromWA: boolean) => {
    if (!activeSession || !selectedChat) return;
    setDeleteFromWAChoice(deleteFromWA);
    setDeleteChatDialogOpen(true);
  };

  const confirmDeleteChat = async () => {
    if (!activeSession || !selectedChat) return;

    try {
      const response = await axios.delete('/api/whatsapp/v1/chats', {
        params: {
          session_id: activeSession.session_id,
          session_code: activeSession.session_code,
          chat_jid: selectedChat.jid,
          delete_from_wa: deleteFromWAChoice,
        },
      });

      if (response.data?.success) {
        const waMsg = response.data?.data?.wa_delete_message;
        addToast('Chat dihapus', waMsg || `${selectedChat.name} berhasil dihapus dari database.`);
        setChats(prev => prev.filter(c => c.jid !== selectedChat.jid));
        setSelectedChat(null);
        setMessages([]);
        setIsMobileSidebarOpen(true);
        setDeleteChatDialogOpen(false);
      } else {
        addToast('Gagal hapus chat', response.data?.message || 'Terjadi kesalahan');
      }
    } catch (error: any) {
      console.error('Failed to delete chat:', error);
      addToast('Gagal hapus chat', error?.response?.data?.message || 'Terjadi kesalahan saat menghapus chat');
    }
  };

  const handleArchiveChat = () => {
    if (!selectedChat) return;
    const key = normalizeJid(selectedChat.jid);
    setArchivedChatJids((prev) => (prev.includes(key) ? prev : [...prev, key]));
    setChats((prev) => prev.filter((c) => normalizeJid(c.jid) !== key));
    setSelectedChat(null);
    setMessages([]);
    setIsMobileSidebarOpen(true);
    addToast('Chat diarsipkan', 'Chat disembunyikan dari daftar (lokal).');
  };

  const handleCheckConsistency = async (cleanupIfMissing: boolean) => {
    if (!activeSession || !selectedChat) return;
    try {
      const response = await axios.post('/api/whatsapp/v1/chats/consistency-check', null, {
        params: {
          session_id: activeSession.session_id,
          session_code: activeSession.session_code,
          chat_jid: selectedChat.jid,
          cleanup_if_missing: cleanupIfMissing,
        },
      });

      if (!response.data?.success) {
        addToast('Gagal cek konsistensi', response.data?.message || 'Terjadi kesalahan');
        return;
      }

      const data = response.data?.data || {};
      const waExists = !!data.wa_chat_exists;
      const reason = data.wa_check_reason || 'No detail';
      const cleanupApplied = !!data.cleanup_applied;

      if (!waExists && cleanupApplied) {
        addToast('Sinkronisasi selesai', `Chat tidak ditemukan di WA. Data lokal dibersihkan. (${reason})`);
        const key = normalizeJid(selectedChat.jid);
        setInconsistentChatJids(prev => prev.filter(j => j !== key));
        setChats(prev => prev.filter(c => c.jid !== selectedChat.jid));
        setSelectedChat(null);
        setMessages([]);
        setIsMobileSidebarOpen(true);
        return;
      }

      if (!waExists) {
        const key = normalizeJid(selectedChat.jid);
        setInconsistentChatJids(prev => (prev.includes(key) ? prev : [...prev, key]));
        setChats(prev => prev.map(c => normalizeJid(c.jid) === key ? { ...c, isInconsistent: true } : c));
        addToast('Chat tidak ada di WA', `Data lokal masih ada. Jalankan sinkronkan untuk hapus lokal. (${reason})`);
        return;
      }

      const key = normalizeJid(selectedChat.jid);
      setInconsistentChatJids(prev => prev.filter(j => j !== key));
      setChats(prev => prev.map(c => normalizeJid(c.jid) === key ? { ...c, isInconsistent: false } : c));
      addToast('Chat masih ada di WA', `Tidak ada cleanup lokal. (${reason})`);
    } catch (error: any) {
      console.error('Failed consistency check:', error);
      addToast('Gagal cek konsistensi', error?.response?.data?.message || 'Terjadi kesalahan saat validasi WA vs DB');
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    addToast('Copied', 'Message copied to clipboard');
  };

  const handleStar = async (messageId: string) => {
    // TODO: Implement star/unstar message API
    console.log('Star message:', messageId);
    addToast('Feature coming soon', 'Star messages will be available soon');
  };

  const handleChatSelect = async (chat: Chat) => {
    // Optimistically mark as read in the UI
    setChats(prev => prev.map(c =>
      c.jid === chat.jid ? { ...c, unreadCount: 0 } : c
    ));
    setSelectedChat({ ...chat, unreadCount: 0 });
    setIsMobileSidebarOpen(false);
  };

  // Refs to avoid SSE reconnects on state changes
  const selectedChatRef = useRef(selectedChat);
  const chatsRef = useRef(chats);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
    chatsRef.current = chats;
  }, [selectedChat, chats]);

	// SSE Connection for real-time messages
	useEffect(() => {
		if (!activeSession) return;

		const token = localStorage.getItem('auth_token') || '';
		// Extract session code properly
		const sessionCode = activeSession.session_code || '';
		const eventSource = new EventSource(`/api/whatsapp/v1/messages/stream?session_id=${activeSession.session_id}&session_code=${sessionCode}&token=${token}`);

		eventSource.onmessage = (event) => {
      try {
        if (!event.data) {
          console.warn('⚠️ SSE event.data is undefined or empty');
          return;
        }

        const messageData = JSON.parse(event.data);

        if (messageData.type === 'connected') {
          console.log('✅ SSE connected to session:', messageData.session_id);
          return;
        }

        if (messageData.type === 'new_message') {
          // Normalize JIDs by removing suffixes like @s.whatsapp.net or @lid for comparison
          const activeJid = normalizeJid(selectedChatRef.current?.jid);
          const messageJid = normalizeJid(messageData.chat_jid);
          const isActiveChat = activeJid && activeJid === messageJid;

          if (!isActiveChat) {
            console.log(`ℹ️ SSE message for another chat (${messageJid}), current is (${activeJid})`);
          }

          const isWindowFocused = document.hasFocus();

          // Append to message list if we're in the chat
          if (isActiveChat) {
            setMessages(prev => {
              const exists = prev.some(m => m.id === messageData.message_id);
              if (exists) {
                // If it exists (e.g., from optimistic update), we update its status
                return prev.map(m => m.id === messageData.message_id ? { ...m, status: messageData.status || 'delivered' } : m);
              } else {
                // Not in state, append it (both from me and from others)
                const newMessage: Message = {
                  id: messageData.message_id,
                  message: messageData.content,
                  timestamp: messageData.timestamp,
                  isFromMe: messageData.is_from_me,
                  status: messageData.status,
                  sender: messageData.sender_jid,
                  type: messageData.message_type || 'text',
                  message_type: messageData.message_type || 'text',
                  content: messageData.content,
                  media_url: messageData.media_url
                };
                return [...prev, newMessage];
              }
            });

            // Mark read immediately if focused and not from me
            if (isWindowFocused && !messageData.is_from_me) {
              axios.post('/api/whatsapp/v1/messages/mark-read', {
                session_id: activeSession.session_id,
                chat_jid: messageData.chat_jid,
                message_ids: [messageData.message_id],
              }).catch(console.error);
            }
          }

          // Play notification and toast
          if (!isWindowFocused || !isActiveChat) {
            if (!messageData.is_from_me) {
              playNotificationSound();

              const senderChat = chatsRef.current.find(c => normalizeJid(c.jid) === normalizeJid(messageData.chat_jid));
              const senderName = senderChat?.name || messageData.sender_jid.split('@')[0];
              const preview = messageData.content?.length > 50
                ? messageData.content.substring(0, 50) + '...'
                : messageData.content;

              addToast(
                senderName,
                preview || '[Media]',
                messageData.chat_jid,
                formatWhatsAppTime(messageData.timestamp)
              );
            }
          }

          // === Optimistic UI Chat Reordering ===
          // Move this chat to the top of the list instantly for a snappy UX
          setChats(prevChats => {
            if (archivedChatJids.includes(messageJid)) {
              return prevChats;
            }
            const chatIndex = prevChats.findIndex(c => normalizeJid(c.jid) === messageJid);
            if (chatIndex > -1) {
              const updatedChat = { ...prevChats[chatIndex] };

              // Update last message data
              updatedChat.lastMessage = messageData.content || (messageData.message_type === 'image' ? '📸 Image' : messageData.message_type === 'video' ? '🎥 Video' : messageData.message_type === 'audio' ? '🎵 Audio' : messageData.message_type === 'document' ? '📄 Document' : '[Media]');
              updatedChat.lastMessageTime = messageData.timestamp;
              updatedChat.isInconsistent = inconsistentChatJids.includes(messageJid);

              // Increment unread count if it's not the active focused chat and not from me
              if (!messageData.is_from_me && !(isWindowFocused && isActiveChat)) {
                updatedChat.unreadCount = (updatedChat.unreadCount || 0) + 1;
              }

              // Create new array, splicing out the old chat and unshifting the updated one to the top
              const newChats = [...prevChats];
              newChats.splice(chatIndex, 1);
              newChats.unshift(updatedChat);

              return newChats;
            } else {
              // Chat not currently loaded in the list, just rely on loadChats to fetch it
              return prevChats;
            }
          });
          // =====================================

          // Refresh chats silently in background to ensure sync, preserving loaded scroll
          loadChats(false, true);
        }

        if (messageData.type === 'receipt') {
          console.log('👀 Message receipt updated:', messageData);
          setMessages(prev => prev.map(msg => {
            if (msg.id === messageData.message_id) {
              return { ...msg, status: messageData.status };
            }
            return msg;
          }));

          // Force chats refresh to update unread badges
          if (messageData.status === 'read' || messageData.status === 'read-self') {
            loadChats();
          }
        }

        if (messageData.type === 'message_update') {
          console.log('🔄 Message status updated:', messageData);
          setMessages(prev => prev.map(msg => {
            if (msg.id === messageData.message_id || msg.id === messageData.id) {
              return { ...msg, status: messageData.status };
            }
            return msg;
          }));
        }
      } catch (err) {
        console.error('❌ SSE parse error:', err);
      }
    };

    eventSource.onerror = () => {
      console.warn('⚠️  SSE connection error (WhatsApp may be disconnected)');
      eventSource.close();
    };

    return () => {
      console.log('🔌 Closing SSE connection');
      eventSource.close();
    };
  }, [activeSession]);

  // Background check for new messages in the active chat
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (selectedChat && activeSession) {
      interval = setInterval(async () => {
        try {
          // Fetch newest messages silently
          const response = await axios.get('/api/whatsapp/v1/messages', {
            params: {
              session_id: activeSession.session_id,
              session_code: activeSession.session_code,
              chat_jid: selectedChat.jid,
              page: 1,
              limit: 20,
            },
          });

          if (response.data.success) {
            const apiMessages = response.data.data?.messages || response.data.data || [];

            setMessages(prev => {
              let added = false;
              const newMessages = [...prev];

              apiMessages.forEach((msg: any) => {
                const existsIdx = newMessages.findIndex(m => m.id === msg.message_id);
                if (existsIdx === -1) {
                  newMessages.push({
                    id: msg.message_id,
                    message: msg.content,
                    timestamp: msg.timestamp,
                    isFromMe: msg.is_from_me,
                    status: msg.status,
                    sender: msg.jid || msg.sender_jid,
                    type: msg.message_type,
                    media_url: msg.media_url,
                    quoted: msg.quoted_message_id ? {
                      id: msg.quoted_message_id,
                      message: msg.quoted_message_content || '',
                      sender: msg.quoted_message_sender,
                    } : null,
                  });
                  added = true;
                } else if (newMessages[existsIdx].status !== msg.status) {
                  // Update status if it changed
                  newMessages[existsIdx] = { ...newMessages[existsIdx], status: msg.status };
                  added = true;
                }
              });

              if (added) {
                newMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                return newMessages;
              }
              return prev;
            });
          }
        } catch (err) {
          console.error('Background sync failed:', err);
        }
      }, 30000); // 30 seconds interval
    }
    return () => clearInterval(interval);
  }, [selectedChat, activeSession]);

  // Auto-scroll to bottom of messages only when near the bottom
  useEffect(() => {
    if (!messagesContainerRef.current) return;
    const container = messagesContainerRef.current;

    // Check if user is scrolled near the bottom (within 300px)
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 300;

    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Effect to reload chats when active session changes
  useEffect(() => {
    // Reset state when switching sessions
    setChats([]);
    setMessages([]);
    setSelectedChat(null);
    setChatOffset(0);
    setHasMoreChats(true);
    
    // We need to wait a tick or ensure activeSession is fully updated
    if (activeSession?.session_id) {
      console.log('🔄 Session changed to:', activeSession.session_name, 'ID:', activeSession.session_id, 'Code:', activeSession.session_code);
      loadChats(false);
    }
  }, [activeSession?.session_id, activeSession?.session_code]); // Trigger when session ID or Code changes

  // Whenever selectedChat changes (either from sidebar or deep-link via ?jid=),
  // automatically load the latest messages for that chat so history appears like WhatsApp.
  useEffect(() => {
    if (!selectedChat || !activeSession) return;

    // Reset "hasMore" so infinite scroll can work per chat
    setHasMore(true);
    setIsLoadingMore(false);

    loadMessages(selectedChat, 0, false).then(() => {
      // Scroll to bottom after initial load
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 100);
    });
  }, [selectedChat?.jid, activeSession?.session_id]);

  return (
    <div
      className="flex h-full min-h-0 w-full overflow-hidden bg-background"
      style={{ touchAction: 'pan-y' }}
    >
      <ContactListSidebar
        chats={chats}
        selectedChat={selectedChat}
        searchQuery={searchQuery}
        onChatSelect={handleChatSelect}
        onSearchChange={setSearchQuery}
        onRefreshChats={() => loadChats(false, false)}
        onRefreshSessions={refreshSessions}
        isVisible={isMobileSidebarOpen}
        hasMoreChats={hasMoreChats}
        isLoadingMoreChats={isLoadingMoreChats}
        onLoadMoreChats={() => loadChats(true, false)}
      />

      <ChatPanel
        selectedChat={selectedChat}
        messages={messages}
        messageInput={messageInput}
        replyingTo={replyingTo}
        onBack={() => {
          setSelectedChat(null);
          setIsMobileSidebarOpen(true);
        }}
        onSendMessage={handleSendMessage}
        onMessageInputChange={setMessageInput}
        onCancelReply={() => setReplyingTo(null)}
        onReply={handleReply}
        onForward={handleForward}
        onDelete={handleDelete}
        onDeleteChat={handleDeleteChat}
        onArchiveChat={handleArchiveChat}
        onCheckConsistency={handleCheckConsistency}
        onCopy={handleCopy}
        onStar={handleStar}
        onMediaClick={(type, url, caption) => {
          setMediaModal({ isOpen: true, type, url, caption: caption || null });
        }}
        activeSession={activeSession}
        activeSessionId={activeSession?.session_id}
        activeSessionCode={activeSession?.session_code}
        onMediaSendSuccess={() => selectedChat && loadMessages(selectedChat, 0, false)}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMoreMessages={handleLoadMoreMessages}
        isVisible={selectedChat ? !isMobileSidebarOpen : false}
        messagesContainerRef={messagesContainerRef}
        messagesEndRef={messagesEndRef}
      />

      <AlertDialog open={deleteChatDialogOpen} onOpenChange={setDeleteChatDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus chat ini?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteFromWAChoice
                ? 'Chat akan dihapus dari database dan dicoba hapus di WhatsApp. Jika tidak didukung API, hanya data lokal yang dihapus.'
                : 'Semua riwayat chat akan dihapus dari database lokal dan tidak bisa dikembalikan.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteChat}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ForwardDialog
        open={!!forwardingMessage}
        onClose={() => setForwardingMessage(null)}
        message={forwardingMessage}
        chats={chats}
        onForward={handleForwardToChat}
      />

      <MediaModal
        isOpen={mediaModal.isOpen}
        onClose={() => setMediaModal({ ...mediaModal, isOpen: false })}
        type={mediaModal.type}
        url={mediaModal.url}
        caption={mediaModal.caption ?? undefined}
      />

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
