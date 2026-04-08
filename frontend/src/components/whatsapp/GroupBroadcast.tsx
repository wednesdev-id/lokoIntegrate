import React, { useState, useEffect } from 'react';
import { useSession } from '@/contexts/SessionContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Search,
    Users,
    Send,
    Loader2,
    Image as ImageIcon,
    X
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';

interface Group {
    id: string;
    name: string;
    participants_count?: number;
}

const GroupBroadcast: React.FC = () => {
    const { activeSession } = useSession();
    const [groups, setGroups] = useState<Group[]>([]);
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);

    // Fetch groups from API
    useEffect(() => {
        if (!activeSession) return;

        const fetchGroups = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/whatsapp/v1/sessions/${activeSession.session_id}/groups`, {
                    params: { session_code: activeSession.session_code }
                });
                if (res.data && res.data.data) {
                    const mappedGroups = res.data.data.map((g: any) => ({
                        id: g.jid,
                        name: g.name || g.subject || 'Unknown Group',
                        participants_count: g.participant_count || 0
                    }));
                    setGroups(mappedGroups);
                }
            } catch (error) {
                console.error('Failed to fetch groups', error);
                toast.error('Failed to load groups');
            } finally {
                setLoading(false);
            }
        };

        fetchGroups();
    }, [activeSession]);

    const filteredGroups = groups.filter(g => 
        g.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleToggleGroup = (id: string) => {
        setSelectedGroups(prev => 
            prev.includes(id) 
                ? prev.filter(gid => gid !== id)
                : [...prev, id]
        );
    };

    const handleSelectAll = () => {
        if (selectedGroups.length === filteredGroups.length) {
            setSelectedGroups([]);
        } else {
            setSelectedGroups(filteredGroups.map(g => g.id));
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 16 * 1024 * 1024) {
            toast.error('File size too large (max 16MB)');
            return;
        }

        setMediaFile(file);
        const reader = new FileReader();
        reader.onload = (e) => setMediaPreview(e.target?.result as string);
        reader.readAsDataURL(file);
    };

    const handleSendBroadcast = async () => {
        if (!activeSession || selectedGroups.length === 0 || (!message.trim() && !mediaFile)) return;

        setSending(true);
        try {
            const formData = new FormData();
            formData.append('session_id', activeSession.session_id);
            formData.append('session_code', activeSession.session_code || '');
            formData.append('message', message);
            formData.append('groups', JSON.stringify(selectedGroups));
            if (mediaFile) {
                formData.append('media', mediaFile);
            }

            // Send broadcast via API
            const res = await api.post('/whatsapp/v1/broadcast/group', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const result = res.data.data;
            toast.success(`Broadcast completed! Sent: ${result.success}, Failed: ${result.failed}`);
            
            setMessage('');
            setMediaFile(null);
            setMediaPreview(null);
            setSelectedGroups([]);
        } catch (error: any) {
            console.error('Broadcast error:', error);
            toast.error(error.response?.data?.message || 'Failed to send broadcast');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
            {/* Left Column: Group Selection */}
            <Card className="lg:col-span-1 flex flex-col h-full border-0 shadow-none bg-gray-50/50">
                <div className="p-4 border-b space-y-3">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                        <Input
                            placeholder="Search groups..."
                            className="pl-9 bg-white"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <Checkbox 
                                id="select-all" 
                                checked={filteredGroups.length > 0 && selectedGroups.length === filteredGroups.length}
                                onCheckedChange={handleSelectAll}
                            />
                            <Label htmlFor="select-all" className="text-sm font-medium text-gray-600 cursor-pointer">
                                Select All
                            </Label>
                        </div>
                        <span className="text-xs text-gray-500">
                            {selectedGroups.length} selected
                        </span>
                    </div>
                </div>
                
                <ScrollArea className="flex-1">
                    <div className="p-2 space-y-1">
                        {loading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                            </div>
                        ) : filteredGroups.length === 0 ? (
                            <div className="text-center py-8 text-gray-500 text-sm">
                                No groups found
                            </div>
                        ) : (
                            filteredGroups.map(group => (
                                <div 
                                    key={group.id}
                                    className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                                        selectedGroups.includes(group.id) ? 'bg-blue-50 border border-blue-100' : 'hover:bg-white'
                                    }`}
                                    onClick={() => handleToggleGroup(group.id)}
                                >
                                    <Checkbox 
                                        checked={selectedGroups.includes(group.id)}
                                        onCheckedChange={() => handleToggleGroup(group.id)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">
                                            {group.name}
                                        </p>
                                        <p className="text-xs text-gray-500 flex items-center gap-1">
                                            <Users className="h-3 w-3" />
                                            {group.participants_count || 0} participants
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </Card>

            {/* Right Column: Message Compose */}
            <Card className="lg:col-span-2 flex flex-col h-full border-0 shadow-none bg-white">
                <div className="p-6 flex-1 flex flex-col space-y-4 overflow-y-auto">
                    <div>
                        <Label className="text-base font-semibold mb-2 block">Message Content</Label>
                        <Textarea
                            placeholder="Type your broadcast message here..."
                            className="min-h-[200px] resize-none text-base p-4 focus-visible:ring-blue-500"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                        />
                    </div>

                    <div>
                        <Label className="text-sm font-medium mb-2 block text-gray-700">Media Attachment (Optional)</Label>
                        {!mediaFile ? (
                            <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 hover:bg-gray-50 transition-colors text-center cursor-pointer relative">
                                <input
                                    type="file"
                                    accept="image/*,video/*"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    onChange={handleFileSelect}
                                />
                                <ImageIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                <p className="text-sm text-gray-600 font-medium">Click to upload image or video</p>
                                <p className="text-xs text-gray-400 mt-1">Max size: 16MB</p>
                            </div>
                        ) : (
                            <div className="relative border rounded-lg overflow-hidden bg-gray-50 inline-block max-w-[300px]">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-1 right-1 h-6 w-6 bg-black/50 hover:bg-black/70 text-white rounded-full z-10"
                                    onClick={() => {
                                        setMediaFile(null);
                                        setMediaPreview(null);
                                    }}
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                                {mediaFile.type.startsWith('image/') ? (
                                    <img src={mediaPreview!} alt="Preview" className="max-h-[200px] object-contain" />
                                ) : (
                                    <video src={mediaPreview!} controls className="max-h-[200px]" />
                                )}
                                <div className="p-2 text-xs text-gray-600 truncate bg-white border-t">
                                    {mediaFile.name}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 border-t bg-gray-50/30 flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                        Broadcasting to <span className="font-semibold text-gray-900">{selectedGroups.length}</span> groups
                    </div>
                    <Button 
                        onClick={handleSendBroadcast} 
                        disabled={sending || selectedGroups.length === 0 || (!message.trim() && !mediaFile)}
                        className="bg-blue-600 hover:bg-blue-700 min-w-[140px]"
                    >
                        {sending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <Send className="mr-2 h-4 w-4" />
                                Send Broadcast
                            </>
                        )}
                    </Button>
                </div>
            </Card>
        </div>
    );
};

export default GroupBroadcast;
