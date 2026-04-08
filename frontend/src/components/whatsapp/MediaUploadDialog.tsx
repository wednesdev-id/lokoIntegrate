import React, { useState, useRef } from 'react';
import { X, Send, FileIcon, Music, Image as ImageIcon, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { MediaType } from './MediaAttachmentButton';
import axios from 'axios';

interface Chat {
    jid: string;
    name: string;
}

interface Session {
    session_id: string;
}

interface MediaUploadDialogProps {
    isOpen: boolean;
    onClose: () => void;
    messageType: MediaType;
    chat: Chat;
    activeSession: Session;
    onSendSuccess: () => void;
    replyingTo?: any;
}

const MAX_FILE_SIZE = {
    image: 16 * 1024 * 1024,   // 16MB
    video: 64 * 1024 * 1024,   // 64MB
    audio: 16 * 1024 * 1024,   // 16MB
    document: 100 * 1024 * 1024 // 100MB
};

const ACCEPTED_TYPES = {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    video: ['video/mp4', 'video/webm', 'video/quicktime'],
    audio: ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/aac', 'audio/mp3'],
    document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain', 'application/zip']
};

const TYPE_LABELS = {
    image: 'Image',
    video: 'Video',
    audio: 'Audio',
    document: 'Document'
};

export function MediaUploadDialog({
    isOpen,
    onClose,
    messageType,
    chat,
    activeSession,
    onSendSuccess,
    replyingTo
}: MediaUploadDialogProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [caption, setCaption] = useState('');
    const [uploading, setUploading] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setError(null);

        // Validate file type
        if (!ACCEPTED_TYPES[messageType].includes(file.type)) {
            setError(`Invalid file type. Please select a valid ${TYPE_LABELS[messageType].toLowerCase()} file.`);
            return;
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE[messageType]) {
            const maxSizeMB = MAX_FILE_SIZE[messageType] / (1024 * 1024);
            setError(`File too large. Maximum size is ${maxSizeMB}MB.`);
            return;
        }

        setSelectedFile(file);

        // Generate preview for images and videos
        if (messageType === 'image' || messageType === 'video') {
            const reader = new FileReader();
            reader.onload = (e) => {
                setPreview(e.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const handleSend = async () => {
        if (!selectedFile) return;

        try {
            setUploading(true);
            setError(null);

            // Convert file to base64
            const base64Data = await fileToBase64(selectedFile);

            // Prepare payload
            const payload: any = {
                session_id: activeSession.session_id,
                jid: chat.jid,
                message_type: messageType,
                media_url: base64Data,
            };

            // Add caption if provided
            if (caption.trim()) {
                payload.message = caption.trim();
            }

            // Add file name for documents
            if (messageType === 'document') {
                payload.file_name = selectedFile.name;
            }

            // Add quoted message if replying
            if (replyingTo) {
                payload.quoted_message_id = replyingTo.id;
            }

            // Send to API
            await axios.post('/api/whatsapp/v1/messages/send', payload);

            // Success
            onSendSuccess();
            handleClose();
        } catch (err: any) {
            console.error('Failed to send media:', err);
            setError(err.response?.data?.message || 'Failed to send media. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const handleClose = () => {
        setSelectedFile(null);
        setCaption('');
        setPreview(null);
        setError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        onClose();
    };

    const getTypeIcon = () => {
        switch (messageType) {
            case 'image': return <ImageIcon className="h-12 w-12 text-muted-foreground" />;
            case 'video': return <Video className="h-12 w-12 text-muted-foreground" />;
            case 'audio': return <Music className="h-12 w-12 text-muted-foreground" />;
            case 'document': return <FileIcon className="h-12 w-12 text-muted-foreground" />;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Send {TYPE_LABELS[messageType]}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* File Selection */}
                    {!selectedFile ? (
                        <div
                            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 transition"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <div className="flex flex-col items-center gap-3">
                                {getTypeIcon()}
                                <div>
                                    <p className="text-sm font-medium">Click to select {TYPE_LABELS[messageType].toLowerCase()}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Max size: {MAX_FILE_SIZE[messageType] / (1024 * 1024)}MB
                                    </p>
                                </div>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                className="hidden"
                                accept={ACCEPTED_TYPES[messageType].join(',')}
                                onChange={handleFileSelect}
                            />
                        </div>
                    ) : (
                        <>
                            {/* Preview Area */}
                            <div className="relative border rounded-lg overflow-hidden bg-muted/30">
                                {messageType === 'image' && preview && (
                                    <img src={preview} alt="Preview" className="w-full max-h-[300px] object-contain" />
                                )}
                                {messageType === 'video' && preview && (
                                    <video src={preview} controls className="w-full max-h-[300px]" />
                                )}
                                {messageType === 'audio' && (
                                    <div className="p-8 text-center">
                                        <Music className="h-16 w-16 mx-auto text-muted-foreground mb-2" />
                                        <p className="text-sm font-medium">{selectedFile.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {(selectedFile.size / 1024).toFixed(1)} KB
                                        </p>
                                    </div>
                                )}
                                {messageType === 'document' && (
                                    <div className="p-8 text-center">
                                        <FileIcon className="h-16 w-16 mx-auto text-muted-foreground mb-2" />
                                        <p className="text-sm font-medium">{selectedFile.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {(selectedFile.size / 1024).toFixed(1)} KB
                                        </p>
                                    </div>
                                )}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-2 right-2 bg-background/80 hover:bg-background"
                                    onClick={() => {
                                        setSelectedFile(null);
                                        setPreview(null);
                                        if (fileInputRef.current) fileInputRef.current.value = '';
                                    }}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* Caption Input */}
                            <Input
                                placeholder={`Add a caption... (optional)`}
                                value={caption}
                                onChange={(e) => setCaption(e.target.value)}
                                disabled={uploading}
                            />
                        </>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                            {error}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose} disabled={uploading}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSend}
                        disabled={!selectedFile || uploading}
                        className="bg-green-500 hover:bg-green-600"
                    >
                        {uploading ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <Send className="h-4 w-4 mr-2" />
                                Send
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
