import React from 'react';
import {
    Image,
    Video,
    Mic,
    FileText,
    MapPin,
    Smile,
    File
} from 'lucide-react';

interface MediaMessageProps {
    type: string;
    mediaURL?: string | null;
    messageText?: string;
    onMediaClick?: (type: 'video' | 'audio', url: string, caption?: string) => void;
}

export const MediaMessage: React.FC<MediaMessageProps> = ({
    type,
    mediaURL,
    messageText,
    onMediaClick
}) => {
    switch (type) {
        case 'image':
            return (
                <div className="space-y-2">
                    {mediaURL ? (
                        <img
                            src={mediaURL}
                            alt="Image"
                            className="max-w-full max-h-96 rounded-md object-contain cursor-pointer hover:opacity-90 transition"
                            onClick={() => window.open(mediaURL, '_blank')}
                        />
                    ) : (
                        <div className="flex items-center gap-2 p-2 text-sm">
                            <Image className="h-4 w-4" />
                            <span>Image</span>
                        </div>
                    )}
                    {messageText && <p className="text-sm whitespace-pre-wrap break-words">{messageText}</p>}
                </div>
            );

        case 'video':
            return (
                <div className="space-y-2">
                    {mediaURL ? (
                        <div className="relative group rounded-md overflow-hidden bg-black">
                            <video
                                controls
                                className="max-w-full max-h-64 rounded-md"
                                preload="metadata"
                                poster={mediaURL + '#t=0.1'}
                            >
                                <source src={mediaURL} type="video/mp4" />
                                Your browser doesn't support video.
                            </video>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 p-2 text-sm">
                            <Video className="h-4 w-4" />
                            <span>Video</span>
                        </div>
                    )}
                    {messageText && <p className="text-sm whitespace-pre-wrap break-words">{messageText}</p>}
                </div>
            );

        case 'audio':
        case 'ptt':
            return (
                <div className="space-y-2">
                    {mediaURL ? (
                        <div
                            className="cursor-pointer p-3 rounded-md bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition flex items-center gap-3"
                            onClick={() => onMediaClick?.('audio', mediaURL, messageText)}
                        >
                            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                                <Mic className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium">Audio Message</p>
                                <p className="text-xs text-muted-foreground">Click to play</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 p-2 text-sm">
                            <Mic className="h-4 w-4" />
                            <span>Audio</span>
                        </div>
                    )}
                    {messageText && <p className="text-sm whitespace-pre-wrap break-words">{messageText}</p>}
                </div>
            );

        case 'document':
        case 'pdf':
            return (
                <div className="flex items-center gap-3 p-2 rounded-md bg-black/5 dark:bg-white/5">
                    <FileText className="h-8 w-8 shrink-0 text-blue-500" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{messageText || 'Document'}</p>
                        {mediaURL && (
                            <a
                                href={mediaURL}
                                download
                                className="text-xs text-blue-500 hover:underline"
                                target="_blank"
                                rel="noreferrer"
                            >
                                Download
                            </a>
                        )}
                    </div>
                </div>
            );

        case 'sticker':
            return mediaURL ? (
                <img src={mediaURL} alt="Sticker" className="w-32 h-32 object-contain" />
            ) : (
                <div className="flex items-center gap-2 p-2 text-sm">
                    <Smile className="h-4 w-4" />
                    <span>Sticker</span>
                </div>
            );

        case 'location':
            return (
                <div className="flex items-center gap-3 p-3 rounded-md bg-black/5 dark:bg-white/5">
                    <MapPin className="h-8 w-8 shrink-0 text-red-500" />
                    <div className="flex-1">
                        <p className="text-sm font-medium">Location</p>
                        {messageText && <p className="text-xs text-muted-foreground">{messageText}</p>}
                    </div>
                </div>
            );

        case 'contact':
            return (
                <div className="flex items-center gap-3 p-3 rounded-md bg-black/5 dark:bg-white/5">
                    <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                        👤
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-medium">{messageText || 'Contact'}</p>
                        <p className="text-xs text-muted-foreground">Contact Card</p>
                    </div>
                </div>
            );

        default:
            // Text or unknown message type
            return messageText ? (
                <p className="text-sm whitespace-pre-wrap break-words">{messageText}</p>
            ) : (
                <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
                    <File className="h-4 w-4" />
                    <span>[Unsupported Message Type]</span>
                </div>
            );
    }
};
