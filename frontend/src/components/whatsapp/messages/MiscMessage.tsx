import React from 'react';
import { User, MapPin, Smile, AlertCircle } from 'lucide-react';

interface MiscMessageProps {
    type: string;
    content?: string;
    url?: string;
}

export const MiscMessage: React.FC<MiscMessageProps> = ({ type, content, url }) => {
    switch (type.toLowerCase()) {
        case 'sticker':
            return url ? (
                <img src={url} alt="Sticker" className="w-32 h-32 object-contain" />
            ) : (
                <div className="flex items-center gap-2 p-2 text-sm italic">
                    <Smile className="h-4 w-4" />
                    <span>Sticker</span>
                </div>
            );

        case 'location':
            return (
                <div className="flex items-center gap-3 p-3 rounded-md bg-black/5 dark:bg-white/5">
                    <MapPin className="h-6 w-6 text-red-500" />
                    <div>
                        <p className="text-sm font-medium">Location</p>
                        {content && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{content}</p>}
                    </div>
                </div>
            );

        case 'contact':
            return (
                <div className="flex items-center gap-3 p-3 rounded-md bg-black/5 dark:bg-white/5">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <User className="h-5 w-5 text-gray-500" />
                    </div>
                    <div>
                        <p className="text-sm font-medium">{content || 'Contact'}</p>
                        <p className="text-xs text-blue-500 cursor-pointer hover:underline">View contact</p>
                    </div>
                </div>
            );

        default:
            return (
                <div className="flex items-center gap-2 p-2 text-sm italic text-gray-500">
                    <AlertCircle className="h-4 w-4" />
                    <span>Unsupported message type: {type}</span>
                </div>
            );
    }
};
