import { useState, useLayoutEffect, useRef } from 'react';
import {
    Send,
    Phone,
    Video,
    MoreVertical,
    Smile,
    Mic,
    ArrowLeft,
    Users,
    MessageCircle,
    X,
    Archive,
    Trash2,
    RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageBubble } from '@/components/whatsapp/messages/MessageBubble';
import { MessageContent } from '@/components/whatsapp/messages/MessageContent';
import { MediaAttachmentButton, MediaType } from '@/components/whatsapp/MediaAttachmentButton';
import { MediaUploadDialog } from '@/components/whatsapp/MediaUploadDialog';
import { jidToPhoneNumber } from '@/utils/whatsappParser';
import { useContactName } from '@/contexts/ContactsContext';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Chat {
    jid: string;
    name: string;
    lastMessage?: string;
    lastMessageTime?: string;
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

interface ChatPanelProps {
    selectedChat: Chat | null;
    messages: Message[];
    messageInput: string;
    replyingTo: Message | null;
    activeSession: { session_id: string; session_code?: string } | null;
    activeSessionId?: string;
    activeSessionCode?: string;
    onBack: () => void;
    onSendMessage: () => void;
    onMessageInputChange: (value: string) => void;
    onCancelReply: () => void;
    onReply: (message: any) => void;
    onForward: (message: any) => void;
    onDelete: (messageId: string, deleteForEveryone: boolean) => void;
    onCopy: (text: string) => void;
    onStar: (messageId: string) => void;
    onMediaClick: (type: 'image' | 'video' | 'audio', url: string, caption?: string | null) => void;
    onMediaSendSuccess: () => void;
    onDeleteChat: (deleteFromWA: boolean) => void;
    onArchiveChat: () => void;
    onCheckConsistency: (cleanupIfMissing: boolean) => void;
    hasMore: boolean;
    isLoadingMore: boolean;
    isVisible: boolean;
    onLoadMoreMessages?: () => void;
    messagesContainerRef: React.RefObject<HTMLDivElement>;
    messagesEndRef: React.RefObject<HTMLDivElement>;
}

function getAvatarInitials(name: string): string {
    return name
        .split(' ')
        .map((word) => word[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
}

export function ChatPanel({
    selectedChat,
    messages,
    messageInput,
    replyingTo,
    activeSession,
    activeSessionId,
    activeSessionCode,
    onBack,
    onSendMessage,
    onMessageInputChange,
    onCancelReply,
    onReply,
    onForward,
    onDelete,
    onCopy,
    onStar,
    onMediaClick,
    onMediaSendSuccess,
    onDeleteChat,
    onArchiveChat,
    onCheckConsistency,
    hasMore,
    isLoadingMore,
    isVisible,
    onLoadMoreMessages,
    messagesContainerRef,
    messagesEndRef,
}: ChatPanelProps) {
    // Select media state
    const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
    const [selectedMediaType, setSelectedMediaType] = useState<MediaType>('image');

    // Use hook for reactive name
    const chatName = useContactName(selectedChat?.jid);
    const displayName = chatName || selectedChat?.name || "";

    const handleMediaTypeSelect = (type: MediaType) => {
        setSelectedMediaType(type);
        setMediaDialogOpen(true);
    };

    const previousScrollHeight = useRef<number>(0);
    const previousScrollTop = useRef<number>(0);

    useLayoutEffect(() => {
        if (!messagesContainerRef.current) return;
        const container = messagesContainerRef.current;

        if (isLoadingMore) {
            // Keep track of scroll height *before* new messages render
            previousScrollHeight.current = container.scrollHeight;
            previousScrollTop.current = container.scrollTop;
        } else if (previousScrollHeight.current > 0) {
            // Loading finished, elements were added at the top
            const newScrollHeight = container.scrollHeight;
            const heightDifference = newScrollHeight - previousScrollHeight.current;

            // If new messages came in, adjust scroll so user stays looking at the same message
            if (heightDifference > 0) {
                container.scrollTop = previousScrollTop.current + heightDifference;
            }

            previousScrollHeight.current = 0;
            previousScrollTop.current = 0;
        }
    }, [messages, isLoadingMore, messagesContainerRef]);

    if (!selectedChat) {
        return (
            <div className={`flex-1 min-w-0 flex items-center justify-center bg-muted/20 ${!isVisible ? 'hidden md:flex' : 'flex'}`}>
                <div className="text-center p-8">
                    <MessageCircle className="h-24 w-24 mx-auto text-muted-foreground mb-6" />
                    <h3 className="text-2xl font-medium mb-2">WhatsApp Chat</h3>
                    <p className="text-muted-foreground max-w-md">
                        Send and receive messages without keeping your phone online.
                        <br />
                        Select a chat to get started.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex-1 min-w-0 flex flex-col overflow-hidden ${!isVisible ? 'hidden md:flex' : 'flex'}`} style={{ minHeight: 0 }}>
            {/* Chat Header */}
            <div className="sticky top-0 z-30 flex flex-wrap p-3 md:p-4 border-b items-center gap-2 md:gap-3 bg-background/80 md:bg-muted/60 backdrop-blur-md">
                <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedChat.avatar} />
                    <AvatarFallback>{getAvatarInitials(displayName)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{displayName}</h3>
                    <p className="text-xs text-muted-foreground">
                        {selectedChat.isGroup ? (
                            <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                Group
                            </span>
                        ) : (
                            jidToPhoneNumber(selectedChat.jid)
                        )}
                    </p>
                </div>
                {/* Aksi utama: selalu terlihat (bukan hanya di menu titik tiga) */}
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    title="Arsipkan chat (sembunyikan dari daftar lokal)"
                    aria-label="Arsipkan chat"
                    onClick={onArchiveChat}
                >
                    <Archive className="h-5 w-5" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    title="Hapus chat dari database"
                    aria-label="Hapus chat dari database"
                    onClick={() => onDeleteChat(false)}
                >
                    <Trash2 className="h-5 w-5" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 hidden sm:inline-flex"
                    title="Cek konsistensi WhatsApp vs database"
                    aria-label="Cek konsistensi WA vs DB"
                    onClick={() => onCheckConsistency(false)}
                >
                    <RefreshCw className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" className="shrink-0">
                    <Video className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" className="shrink-0">
                    <Phone className="h-5 w-5" />
                </Button>
                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="shrink-0" title="Menu lainnya" aria-label="Menu lainnya">
                            <MoreVertical className="h-5 w-5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="z-[300] w-56">
                        <DropdownMenuItem className="sm:hidden" onClick={() => onCheckConsistency(false)}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Cek konsistensi WA vs DB
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className="text-blue-700 focus:text-blue-800"
                            onClick={() => onCheckConsistency(true)}
                        >
                            Sinkronkan DB (hapus lokal jika chat WA tidak ada)
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className="text-red-600 focus:text-red-700"
                            onClick={() => onDeleteChat(false)}
                        >
                            Hapus chat dari database
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className="text-amber-700"
                            onClick={() => onDeleteChat(true)}
                        >
                            Hapus dari WA + database (jika didukung)
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div
                ref={messagesContainerRef}
                onScroll={(e) => {
                    const target = e.currentTarget;
                    if (target.scrollTop === 0 && hasMore && !isLoadingMore && onLoadMoreMessages) {
                        onLoadMoreMessages();
                    }
                }}
                className="flex-1 overflow-y-auto p-4 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiPjxwYXRoIGQ9Ik0wIDEwMFYwaDEwMHYxMDB6IiBmaWxsPSJub25lIi8+PHBhdGggZD0iTTAgMTAwVjBoMTAwdjEwMHoiIGZpbGw9Im5vbmUiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjYSkiIG9wYWNpdHk9Ii4wMyIvPjwvc3ZnPg==')]"
                style={{ minHeight: 0 }}
            >
                {/* Loading indicator */}
                {isLoadingMore && (
                    <div className="flex justify-center py-2">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    </div>
                )}

                {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        <p>No messages yet. Start the conversation!</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {messages.map((message) => (
                            <MessageBubble
                                key={message.id}
                                message={message}
                                onQuoteClick={() => console.log('Quote clicked', message.quoted?.id)}
                                onReply={onReply}
                                onForward={onForward}
                                onDelete={onDelete}
                                onCopy={onCopy}
                                onStar={onStar}
                            >
                                <MessageContent
                                    message={message}
                                    sessionId={activeSessionId}
                                    sessionCode={activeSessionCode}
                                    onMediaClick={(type, url, caption) => {
                                        onMediaClick(type, url, caption);
                                    }}
                                />
                            </MessageBubble>
                        ))}
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="sticky bottom-0 border-t bg-background shadow-lg z-10">
                {replyingTo && (
                    <div className="px-4 py-2 bg-muted/50 border-b flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground font-medium">Replying to</p>
                            <p className="text-sm truncate">{replyingTo.message || replyingTo.content}</p>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 flex-shrink-0"
                            onClick={onCancelReply}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                )}

                <div className="p-3 flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="hidden sm:flex flex-shrink-0">
                        <Smile className="h-5 w-5" />
                    </Button>
                    <MediaAttachmentButton
                        onSelectType={handleMediaTypeSelect}
                        disabled={!activeSession}
                    />
                    <Input
                        placeholder="Type a message..."
                        value={messageInput}
                        onChange={(e) => onMessageInputChange(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && onSendMessage()}
                        className="flex-1"
                    />
                    {messageInput.trim() ? (
                        <Button onClick={onSendMessage} size="icon" className="bg-green-500 hover:bg-green-600 flex-shrink-0">
                            <Send className="h-5 w-5" />
                        </Button>
                    ) : (
                        <Button variant="ghost" size="icon" className="flex-shrink-0">
                            <Mic className="h-5 w-5" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Media Upload Dialog */}
            {selectedChat && activeSession && (
                <MediaUploadDialog
                    isOpen={mediaDialogOpen}
                    onClose={() => setMediaDialogOpen(false)}
                    messageType={selectedMediaType}
                    chat={selectedChat}
                    activeSession={activeSession}
                    onSendSuccess={onMediaSendSuccess}
                    replyingTo={replyingTo}
                />
            )}
        </div>
    );
}
