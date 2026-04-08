import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
    Search,
    MoreVertical,
    User,
    Users,
    Eye,
    MessageCircle,
    AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { jidToPhoneNumber } from '@/utils/whatsappParser';
import StatusList from './StatusList';
import { useContactName } from '@/contexts/ContactsContext';

interface Chat {
    jid: string;
    name: string; // This might be JID or PushName or Group Subject
    lastMessage?: string;
    lastMessageTime?: string;
    unreadCount?: number;
    avatar?: string;
    isGroup: boolean;
    isInconsistent?: boolean;
}

interface ContactListSidebarProps {
    chats: Chat[];
    selectedChat: Chat | null;
    searchQuery: string;
    onChatSelect: (chat: Chat) => void;
    onSearchChange: (query: string) => void;
    onRefreshChats: () => void;
    onRefreshSessions: () => void;
    isVisible: boolean;
    hasMoreChats?: boolean;
    isLoadingMoreChats?: boolean;
    onLoadMoreChats?: () => void;
}

function getAvatarInitials(name: string): string {
    return name
        .split(' ')
        .map((word) => word[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
}

// Extracted Component for Reactivity and Hooks
const ChatListItem = ({ chat, isSelected, onClick }: { chat: Chat; isSelected: boolean; onClick: () => void }) => {
    // Resolve name hook
    // Note: getContactName returns the Name from map, OR the stripped phone number (jid.split('@')[0])
    const resolvedName = useContactName(chat.jid);

    // Logic:
    // 1. If Group, prefer chat.name (Subject) because JID resolution usually just gives numbers for groups unless saved.
    // 2. If Personal, prefer resolvedName (which handles Saved Name > Phone Number Fallback).
    const displayName = chat.isGroup ? chat.name : resolvedName;

    return (
        <button
            onClick={onClick}
            className={`w-full px-3 py-2.5 flex items-center gap-3 rounded-xl border transition-all text-left
                ${isSelected
                    ? 'bg-green-50 border-green-100 shadow-sm'
                    : 'bg-white/70 border-transparent hover:bg-gray-50 hover:border-gray-200'
                }`}
        >
            <Avatar className="h-11 w-11 shrink-0">
                <AvatarImage src={chat.avatar} />
                <AvatarFallback>{getAvatarInitials(displayName)}</AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                        {chat.isInconsistent && (
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        )}
                        <h3 className="font-medium truncate text-sm md:text-[15px]">
                            {displayName}
                        </h3>
                    </div>
                    {chat.lastMessageTime && (
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(chat.lastMessageTime), {
                                addSuffix: false,
                            })}
                        </span>
                    )}
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                        {chat.isInconsistent && (
                            <Badge className="h-4 px-1 border-amber-200 bg-amber-50 text-[10px] text-amber-700">
                                inconsistent
                            </Badge>
                        )}
                        <p className="text-xs md:text-[13px] text-muted-foreground truncate">
                            {chat.lastMessage || 'No messages yet'}
                        </p>
                    </div>
                    {chat.unreadCount !== undefined && chat.unreadCount > 0 && (
                        <Badge className="ml-2 bg-green-500 text-white text-[11px] px-1.5 py-0 h-5 rounded-full">
                            {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                        </Badge>
                    )}
                </div>
            </div>
        </button>
    );
};

export function ContactListSidebar({
    chats,
    selectedChat,
    searchQuery,
    onChatSelect,
    onSearchChange,
    onRefreshChats,
    onRefreshSessions,
    isVisible,
    hasMoreChats = false,
    isLoadingMoreChats = false,
    onLoadMoreChats,
}: ContactListSidebarProps) {
    const [activeTab, setActiveTab] = useState<'chats' | 'groups' | 'status'>('chats');
    const [inconsistentOnly, setInconsistentOnly] = useState(false);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        // Check if we're within 100px of the bottom
        if (target.scrollHeight - target.scrollTop <= target.clientHeight + 100) {
            if (!isLoadingMoreChats && hasMoreChats && onLoadMoreChats) {
                onLoadMoreChats();
            }
        }
    };

    // Note: We need to filter based on RESOLVED names too if possible.
    // However, filtering strictly by props is faster. 
    // To filter by resolved name, we'd need the resolved name at this level.
    // For now, let's keep filtering simple (backend name or JID phone number).

    // Helper to get search targets
    const matchSearch = (chat: Chat) => {
        const q = searchQuery.toLowerCase();
        // Match backend name
        if (chat.name.toLowerCase().includes(q)) return true;
        // Match JID/Phone
        if (jidToPhoneNumber(chat.jid).includes(q)) return true;
        return false;
    };

    const filteredPersonalChats = chats.filter(
        (chat) => {
            if (chat.isGroup) return false;
            if (!matchSearch(chat)) return false;
            return !inconsistentOnly || !!chat.isInconsistent;
        }
    );

    const filteredGroupChats = chats.filter((chat) => {
        if (!chat.isGroup) return false;
        if (!matchSearch(chat)) return false;
        return !inconsistentOnly || !!chat.isInconsistent;
    });

    return (
        <div
            className={`shrink-0 w-full sm:w-[280px] md:w-[320px] lg:w-[360px] border-r flex flex-col bg-slate-50/80 backdrop-blur-sm ${!isVisible ? 'hidden md:flex' : 'flex'
                }`}
            style={{ height: '100%', minHeight: 0 }}
        >
            {/* Header */}
            <div className="px-4 py-3 border-b bg-white/90 sticky top-0 z-20">
                <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center">
                            <MessageCircle className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-slate-900">
                                WhatsApp
                            </h2>
                            <p className="text-[11px] text-slate-500">
                                Chats, groups & status
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={onRefreshChats}>
                                    Refresh chats
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={onRefreshSessions}>
                                    Refresh sessions
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name or number..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="h-9 pl-9 rounded-full bg-slate-50 border-slate-200 text-sm"
                    />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] text-slate-500">
                        Filter
                    </p>
                    <Button
                        size="sm"
                        variant={inconsistentOnly ? 'outline' : 'ghost'}
                        className={inconsistentOnly ? 'border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100' : 'text-slate-600'}
                        onClick={() => setInconsistentOnly((v) => !v)}
                    >
                        Inconsistent saja
                    </Button>
                </div>
            </div>

            {/* Tabs */}
            <Tabs
                value={activeTab}
                onValueChange={(v: string) => setActiveTab(v as 'chats' | 'groups' | 'status')}
                className="flex-1 flex flex-col overflow-hidden"
                style={{ minHeight: 0 }}
            >
                <TabsList className="w-full grid grid-cols-3 rounded-none border-b bg-white/80">
                    <TabsTrigger value="chats" className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4" />
                        <span className="hidden sm:inline">Chats</span>
                        {filteredPersonalChats.length > 0 && (
                            <Badge variant="secondary" className="h-5 px-1.5 ml-1">
                                {filteredPersonalChats.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="groups" className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span className="hidden sm:inline">Groups</span>
                        {filteredGroupChats.length > 0 && (
                            <Badge variant="secondary" className="h-5 px-1.5 ml-1">
                                {filteredGroupChats.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="status" className="flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        <span className="hidden sm:inline">Status</span>
                    </TabsTrigger>
                </TabsList>

                {/* Chats Tab */}
                <TabsContent
                    value="chats"
                    className="flex-1 overflow-y-auto m-0 px-2.5 pt-2 pb-3 space-y-1.5"
                    style={{ minHeight: 0 }}
                    onScroll={handleScroll}
                >
                    {filteredPersonalChats.length > 0 ? (
                        <>
                            {filteredPersonalChats.map((chat) => (
                                <ChatListItem
                                    key={chat.jid}
                                    chat={chat}
                                    isSelected={selectedChat?.jid === chat.jid}
                                    onClick={() => onChatSelect(chat)}
                                />
                            ))}

                            {hasMoreChats && !isLoadingMoreChats && onLoadMoreChats && (
                                <div className="pt-1 flex justify-center">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-xs rounded-full px-3 h-7"
                                        onClick={onLoadMoreChats}
                                    >
                                        Load older chats
                                    </Button>
                                </div>
                            )}

                            {isLoadingMoreChats && (
                                <div className="pt-2 pb-1 text-center text-xs text-muted-foreground">
                                    Loading more chats...
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                            <User className="h-16 w-16 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium mb-2">No personal chats</h3>
                            <p className="text-sm text-muted-foreground">
                                {searchQuery ? 'No chats match your search' : 'Start a conversation'}
                            </p>
                        </div>
                    )}
                </TabsContent>

                {/* Groups Tab */}
                <TabsContent
                    value="groups"
                    className="flex-1 overflow-y-auto m-0 px-2.5 pt-2 pb-3 space-y-1.5"
                    style={{ minHeight: 0 }}
                    onScroll={handleScroll}
                >
                    {filteredGroupChats.length > 0 ? (
                        <div className="pb-4">
                            {filteredGroupChats.map((chat) => (
                                <ChatListItem
                                    key={chat.jid}
                                    chat={chat}
                                    isSelected={selectedChat?.jid === chat.jid}
                                    onClick={() => onChatSelect(chat)}
                                />
                            ))}
                            {isLoadingMoreChats && (
                                <div className="p-4 text-center">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                                    <p className="text-xs text-muted-foreground mt-2">Loading more groups...</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                            <Users className="h-16 w-16 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium mb-2">No groups</h3>
                            <p className="text-sm text-muted-foreground">
                                {searchQuery ? 'No groups match your search' : 'Join or create a group'}
                            </p>
                        </div>
                    )}
                </TabsContent>

                {/* Status Tab */}
                <TabsContent value="status" className="flex-1 overflow-y-auto m-0 p-0" style={{ minHeight: 0 }}>
                    <StatusList isSidebar={true} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
