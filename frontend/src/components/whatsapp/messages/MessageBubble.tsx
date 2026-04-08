import React, { useState } from 'react';
import { Check, CheckCheck, MoreVertical, Reply, Forward, Copy, Trash2, Star, Info } from 'lucide-react';
import { QuotedMessage } from '../QuotedMessage';
import { formatWhatsAppTime } from '@/utils/timeFormat';
import { useContactName } from '@/contexts/ContactsContext';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface Message {
    id: string;
    isFromMe: boolean;
    status?: string;
    timestamp?: string;
    message?: string;  // Make optional to match ChatManagement
    content?: string;   // Add content field
    sender?: string;    // Add sender field
    quoted?: {
        id: string;
        message: string;
        sender?: string;
    } | null;
}

interface MessageBubbleProps {
    message: Message;
    children: React.ReactNode;
    onQuoteClick?: (id: string) => void;
    onReply?: (message: any) => void;
    onForward?: (message: any) => void;
    onDelete?: (messageId: string, deleteForEveryone: boolean) => void;
    onCopy?: (text: string) => void;
    onStar?: (messageId: string) => void;
    // contactMap removed
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
    message,
    children,
    onQuoteClick,
    onReply,
    onForward,
    onDelete,
    onCopy,
    onStar,
}) => {
    const [showMenu, setShowMenu] = useState(false);

    // Resolve names using global context hook
    const senderName = useContactName(message.sender);
    const quotedSenderName = useContactName(message.quoted?.sender);

    const handleCopy = () => {
        const text = message.message || message.content || '';
        if (text && onCopy) {
            onCopy(text);
        }
    };

    const handleDelete = (forEveryone: boolean) => {
        if (onDelete) {
            onDelete(message.id, forEveryone);
        }
    };

    const getSenderName = () => {
        if (message.isFromMe) return "You";

        // 1. Try Contact Name (Resolved by Hook)
        if (senderName && senderName !== message.sender) return senderName;

        // 2. Fallback
        const senderJid = message.sender || "";
        const phoneNumber = senderJid.split('@')[0];
        return phoneNumber || "Unknown";
    };

    return (
        <div
            className={`flex flex-col ${message.isFromMe ? 'items-end' : 'items-start'} mb-2 group`}
            onContextMenu={(e) => {
                e.preventDefault();
                setShowMenu(true);
            }}
        >
            {/* Sender Name for Groups or Receive - Optionally show for all received if desired, 
                but WhatsApp usually only shows inside groups. 
                For 1:1, the header handles it. 
                However, for "Bubble Consistency" request, let's enable it if it's a group or user asks.
                Assuming 1:1 chat for now, usually name is in header.
                BUT, if this is a GROUP chat, we MUST show the name.
                For now, we don't know if it's a group easily from message prop alone without context.
                SAFE BET: Only show if !isFromMe and we have a name different from header?
                Actually, simpler: Just show it for now to prove it works, or maybe only if it's not from me.
            */}
            {!message.isFromMe && (
                <span className="text-[10px] text-gray-500 mb-0.5 ml-1">
                    {getSenderName()}
                </span>
            )}

            <div
                className={`relative max-w-[75%] sm:max-w-[65%] rounded-lg px-3 py-2 shadow-md ${message.isFromMe
                    ? 'bg-[#d9fdd3] text-gray-900 dark:bg-[#005c4b] dark:text-white rounded-tr-sm'
                    : 'bg-white dark:bg-[#202c33] text-gray-900 dark:text-white border border-gray-100 dark:border-gray-700 rounded-tl-sm'
                    }`}
            >
                {/* Context Menu Trigger Button */}
                <div className="absolute -top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <DropdownMenu open={showMenu} onOpenChange={setShowMenu}>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 bg-background shadow-md hover:bg-muted"
                            >
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => onReply?.(message)}>
                                <Reply className="h-4 w-4 mr-2" />
                                Reply
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onForward?.(message)}>
                                <Forward className="h-4 w-4 mr-2" />
                                Forward
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onStar?.(message.id)}>
                                <Star className="h-4 w-4 mr-2" />
                                Star
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleCopy}>
                                <Copy className="h-4 w-4 mr-2" />
                                Copy
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDelete(false)}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete for me
                            </DropdownMenuItem>
                            {message.isFromMe && (
                                <DropdownMenuItem
                                    onClick={() => handleDelete(true)}
                                    className="text-red-600 dark:text-red-400"
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete for everyone
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                                <Info className="h-4 w-4 mr-2" />
                                Message info
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Quoted/Reply Message */}
                {message.quoted && (
                    <div className="mb-2">
                        <QuotedMessage
                            sender={quotedSenderName || message.quoted.sender}
                            message={message.quoted.message}
                            onClick={() => onQuoteClick?.(message.quoted!.id)}
                        />
                    </div>
                )}

                {/* Message Content */}
                <div className="pb-5 text-sm">
                    {children}
                </div>

                {/* Timestamp & Status */}
                <div className="absolute right-2 bottom-1 flex items-center gap-1 min-w-[60px]">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {message.timestamp ? formatWhatsAppTime(message.timestamp) : ''}
                    </span>
                    {message.isFromMe && (
                        <span>
                            {message.status === 'read' ? (
                                <CheckCheck className="h-3 w-3 text-blue-500" />
                            ) : message.status === 'delivered' ? (
                                <CheckCheck className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                            ) : (
                                <Check className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                            )}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};
