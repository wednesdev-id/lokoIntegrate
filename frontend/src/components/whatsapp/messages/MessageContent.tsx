import React from 'react';
import { TextMessage } from './TextMessage';
import { ImageMessage } from './ImageMessage';
import { VideoMessage } from './VideoMessage';
import { AudioMessage } from './AudioMessage';
import { DocumentMessage } from './DocumentMessage';
import { MiscMessage } from './MiscMessage';
import { getProxiedMediaUrl } from '../../../utils/mediaProxy';

export interface MessageProps {
    message: {
        type?: string;
        message_type?: string;
        content?: string; // fallback
        message?: string; // Text content
        media_url?: string;
        mediaURL?: string;
        session_id?: string;
    };
    sessionId?: string; // Pass from parent for media proxy
    sessionCode?: string; // Session code for authentication
    onMediaClick?: (type: 'image' | 'video' | 'audio', url: string, caption?: string) => void;
}

export const MessageContent: React.FC<MessageProps> = ({ message, sessionId, sessionCode, onMediaClick }) => {
    // Normalize data
    const type = (message.type || message.message_type || 'text').toLowerCase();
    const text = message.message || message.content || '';
    const rawUrl = message.media_url || message.mediaURL;

    // Get session ID from message or prop
    const msgSessionId = message.session_id || sessionId || '';

    // Transform WhatsApp URLs to use authenticated proxy
    const getProxiedUrl = (mediaType: 'image' | 'video' | 'audio' | 'document' | 'sticker') => {
        return getProxiedMediaUrl(rawUrl, msgSessionId, mediaType, sessionCode);
    };

    switch (type) {
        case 'text':
            return <TextMessage text={text} />;

        case 'image':
            return (
                <ImageMessage
                    url={getProxiedUrl('image')}
                    caption={text}
                    onImageClick={(url) => onMediaClick?.('image', url, text)}
                />
            );

        case 'video':
            return (
                <VideoMessage
                    url={getProxiedUrl('video')}
                    caption={text}
                />
            );

        case 'audio':
            return (
                <AudioMessage
                    url={getProxiedUrl('audio')}
                    caption={text}
                />
            );

        case 'document':
        case 'pdf':
            return <DocumentMessage url={getProxiedUrl('document')} filename={text} />;

        default:
            return <MiscMessage type={type} content={text} url={rawUrl} />;
    }
};
