import React, { useState } from 'react';
import { Circle, Eye, Clock, Plus, ArrowLeft } from 'lucide-react';
import { useSession } from '../../contexts/SessionContext';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import whatsappService from '../../services/whatsapp.service';
import { ScrollArea } from '../ui/scroll-area';
import { Dialog, DialogContent, DialogTrigger } from '../ui/dialog';
// Import SendStatus component
import SendStatusModal from './SendStatusModal';

interface StatusListProps {
    isSidebar?: boolean;
}

const StatusList: React.FC<StatusListProps> = ({ isSidebar = false }) => {
    const { activeSession } = useSession();
    const [selectedStatus, setSelectedStatus] = useState<any | null>(null);

    // Fetch statuses
    const {
        data: statusData,
        isLoading,
        refetch
    } = useQuery({
        queryKey: ['statuses', activeSession?.session_id],
        queryFn: async () => {
            // Note: Backend might need to be updated to accept session_id if filtering by session is required
            // Currently GetStatus uses global client which is fine for single user
            return await whatsappService.getStatuses();
        },
        enabled: !!activeSession,
        refetchInterval: 30000 // Refresh every 30s
    });

    const statuses = statusData?.data || [];

    if (!activeSession) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500">
                Please select a session to view statuses.
            </div>
        );
    }

    return (
        <div className={`flex h-full bg-gray-50/50 ${isSidebar ? 'w-full' : ''}`}>
            {/* Left Side: Status List */}
            <div className={`${isSidebar ? 'w-full flex-1' : 'w-full md:w-1/3 lg:w-1/4 min-w-[300px] border-r'} border-gray-200 bg-white flex flex-col`}>
                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <h2 className="text-xl font-bold text-gray-800">Status</h2>
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-gray-500 hover:text-green-600">
                                <Plus className="h-6 w-6" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <SendStatusModal onSuccess={() => refetch()} />
                        </DialogContent>
                    </Dialog>
                </div>

                <ScrollArea className="flex-1">
                    <div className="p-2 space-y-1">
                        {/* My Status Section (Placeholder for now) */}
                        <div className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group">
                            <div className="relative">
                                <Avatar className="h-12 w-12 border-2 border-dashed border-gray-300 group-hover:border-green-500 transition-colors">
                                    <AvatarImage src="" />
                                    <AvatarFallback>Me</AvatarFallback>
                                </Avatar>
                                <div className="absolute bottom-0 right-0 bg-green-500 rounded-full p-0.5 border-2 border-white">
                                    <Plus className="h-3 w-3 text-white" />
                                </div>
                            </div>
                            <div>
                                <h4 className="font-semibold text-gray-900">My Status</h4>
                                <p className="text-sm text-gray-500">Click to add status updates</p>
                            </div>
                        </div>

                        <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                            Recent updates
                        </div>

                        {isLoading ? (
                            <div className="text-center p-4 text-gray-400">Loading statuses...</div>
                        ) : statuses.length === 0 ? (
                            <div className="text-center p-8 text-gray-400 text-sm">
                                No recent updates
                            </div>
                        ) : (
                            statuses.map((status: any) => (
                                <div
                                    key={status.id}
                                    onClick={() => setSelectedStatus(status)}
                                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selectedStatus?.id === status.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                                        }`}
                                >
                                    <div className="relative">
                                        {/* Circular indicator for status ring */}
                                        <div className="absolute -inset-0.5 border-2 border-green-500 rounded-full"></div>
                                        <Avatar className="h-12 w-12 border-2 border-white relative">
                                            {/* Use media URL if video/image status, otherwise default user avatar */}
                                            <AvatarImage
                                                src={status.media_url && status.type === 'image'
                                                    ? whatsappService.getMediaUrl(status.media_url, activeSession?.session_id || '', 'image')
                                                    : undefined}
                                                className="object-cover"
                                            />
                                            <AvatarFallback className="bg-gray-100 text-gray-500">
                                                {status.jid?.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold text-gray-900 truncate">
                                            {status.jid?.split('@')[0]}
                                        </h4>
                                        <div className="flex items-center text-xs text-gray-500">
                                            <Clock className="h-3 w-3 mr-1" />
                                            {status.timestamp ? formatDistanceToNow(new Date(status.timestamp), { addSuffix: true }) : 'Just now'}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </div>

            {/* Right Side: Status Viewer (Conditional based on isSidebar) */}
            {isSidebar ? (
                // Sidebar Mode: Render as Overlay/Dialog
                selectedStatus && (
                    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center animate-in fade-in duration-200">
                        {/* Pass close handler */}
                        {renderViewer(selectedStatus, () => setSelectedStatus(null))}
                    </div>
                )
            ) : (
                // Full Page Mode: Render as Split Pane
                <div className="flex-1 bg-gray-900 flex items-center justify-center relative overflow-hidden">
                    {selectedStatus ? renderViewer(selectedStatus, () => setSelectedStatus(null)) : (
                        <div className="text-center text-gray-500">
                            <Circle className="h-16 w-16 mx-auto mb-4 opacity-20" />
                            <p className="text-xl font-medium text-gray-400">Click on a contact to view their status update</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    // Helper function moved inside to access activeSession
    function renderViewer(selectedStatus: any, onClose: () => void) {
        // Use proxy URL for persistent storage
        const mediaSrc = whatsappService.getMediaUrl(
            selectedStatus.media_url,
            activeSession?.session_id || '',
            selectedStatus.type
        );

        return (
            <div className="w-full h-full max-w-md mx-auto relative flex flex-col bg-black">
                {/* Status Header */}
                <div className="absolute top-0 left-0 right-0 p-4 z-20 flex items-center justify-between text-white bg-gradient-to-b from-black/50 to-transparent">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost" size="icon" className="text-white"
                            onClick={onClose}
                        >
                            <ArrowLeft className="h-6 w-6" />
                        </Button>
                        <Avatar className="h-10 w-10 border-2 border-white/20">
                            <AvatarFallback>{selectedStatus.jid?.substring(0, 1)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <h3 className="font-medium">{selectedStatus.jid?.split('@')[0]}</h3>
                            <p className="text-xs text-white/70">
                                {formatDistanceToNow(new Date(selectedStatus.timestamp), { addSuffix: true })}
                            </p>
                        </div>
                    </div>
                    {/* Close Button Top Right */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-white/50 hover:text-white"
                        onClick={onClose}
                    >
                        <Eye className="h-5 w-5" />
                    </Button>
                </div>

                {/* Status Content */}
                <div className="flex-1 flex items-center justify-center relative">
                    {selectedStatus.type === 'image' ? (
                        <img
                            src={mediaSrc}
                            alt="Status"
                            className="max-w-full max-h-full object-contain"
                            onError={(e) => {
                                // Fallback to raw URL if proxy fails (though proxy handles download)
                                console.error('Proxy load failed, trying raw URL');
                                e.currentTarget.src = selectedStatus.media_url;
                            }}
                        />
                    ) : selectedStatus.type === 'video' ? (
                        <video
                            src={mediaSrc}
                            controls
                            autoPlay
                            className="max-w-full max-h-full"
                        />
                    ) : (
                        <div className="p-8 text-center text-white text-xl md:text-2xl font-medium bg-purple-600 w-full h-full flex items-center justify-center">
                            {selectedStatus.content}
                        </div>
                    )}
                </div>
            </div>
        );
    }
};

export default StatusList;
