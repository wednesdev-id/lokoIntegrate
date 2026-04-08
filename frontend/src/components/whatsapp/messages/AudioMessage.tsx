import React, { useState } from 'react';
import { Music, AlertCircle, Volume2 } from 'lucide-react';

interface AudioMessageProps {
    url?: string;
    caption?: string;
    mimetype?: string;
    seconds?: number;
    ptt?: boolean; // Voice note (Push To Talk)
}

export const AudioMessage: React.FC<AudioMessageProps> = ({
    url,
    caption,
    mimetype = 'audio/ogg',
    seconds,
    ptt = false
}) => {
    const [error, setError] = useState(false);

    const formatDuration = (sec?: number) => {
        if (!sec) return '';
        const mins = Math.floor(sec / 60);
        const secs = Math.floor(sec % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (error) {
        return (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg max-w-xs">
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                <div>
                    <p className="text-sm font-medium text-red-900">Failed to load audio</p>
                    <p className="text-xs text-red-700">Audio may have expired</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {url ? (
                <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-lg max-w-sm">
                    {ptt ? (
                        <Volume2 className="h-6 w-6 text-blue-600 shrink-0" />
                    ) : (
                        <Music className="h-6 w-6 text-blue-600 shrink-0" />
                    )}

                    <div className="flex-1 min-w-0">
                        <audio
                            src={url}
                            controls
                            className="w-full h-8"
                            onError={() => setError(true)}
                            controlsList="nodownload"
                        >
                            <source src={url} type={mimetype} />
                            Your browser does not support audio playback.
                        </audio>
                        {seconds && (
                            <p className="text-xs text-gray-500 mt-1">
                                {ptt ? 'Voice message' : 'Audio'} • {formatDuration(seconds)}
                            </p>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-2 p-3 bg-gray-100 rounded-lg w-48">
                    <Music className="h-5 w-5 text-gray-400" />
                    <span className="text-sm text-gray-600">Processing audio...</span>
                </div>
            )}

            {caption && caption !== '[Audio]' && (
                <p className="text-sm whitespace-pre-wrap break-words px-1">{caption}</p>
            )}
        </div>
    );
};
