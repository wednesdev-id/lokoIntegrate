import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Send } from 'lucide-react';

interface Chat {
    jid: string;
    name: string;
    avatar?: string;
    isGroup: boolean;
}


interface ForwardDialogProps {
    open: boolean;
    onClose: () => void;
    message: any | null;
    chats: Chat[];
    onForward: (chatJid: string, message: any) => Promise<void> | void;
}

function getAvatarInitials(name: string): string {
    return name
        .split(' ')
        .map((word) => word[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
}

export function ForwardDialog({ open, onClose, message, chats, onForward }: ForwardDialogProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedChats, setSelectedChats] = useState<string[]>([]);

    const filteredChats = chats.filter(chat =>
        chat.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const toggleChat = (jid: string) => {
        setSelectedChats(prev =>
            prev.includes(jid)
                ? prev.filter(id => id !== jid)
                : [...prev, jid]
        );
    };

    const handleForward = () => {
        if (!message) return;

        selectedChats.forEach(chatJid => {
            onForward(chatJid, message);
        });

        setSelectedChats([]);
        setSearchQuery('');
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Forward message to...</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search chats..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>

                    {/* Chat List */}
                    <div className="max-h-[400px] overflow-y-auto space-y-1">
                        {filteredChats.map(chat => (
                            <div
                                key={chat.jid}
                                onClick={() => toggleChat(chat.jid)}
                                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selectedChats.includes(chat.jid)
                                    ? 'bg-green-100 dark:bg-green-900/30'
                                    : 'hover:bg-muted/50'
                                    }`}
                            >
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={chat.avatar} />
                                    <AvatarFallback>{getAvatarInitials(chat.name)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-medium truncate">{chat.name}</h4>
                                    <p className="text-sm text-muted-foreground">
                                        {chat.isGroup ? 'Group' : 'Personal'}
                                    </p>
                                </div>
                                {selectedChats.includes(chat.jid) && (
                                    <div className="h-5 w-5 rounded-full bg-green-600 flex items-center justify-center">
                                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-4 border-t">
                        <p className="text-sm text-muted-foreground">
                            {selectedChats.length} selected
                        </p>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleForward}
                                disabled={selectedChats.length === 0}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                <Send className="h-4 w-4 mr-2" />
                                Forward
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
