import React, { useState } from 'react';
import { useMediaRetry } from '../../../hooks/useMediaRetry';
import { RefreshCw, AlertCircle, Loader2 } from 'lucide-react';

interface ImageMessageProps {
    url?: string;
    caption?: string;
    onImageClick?: (url: string) => void;
}

export const ImageMessage: React.FC<ImageMessageProps> = ({ url, caption, onImageClick }) => {
    const {
        mediaUrl,
        isLoading,
        retryCount,
        canRetry,
        handleRetry,
        handleLoad,
        handleError
    } = useMediaRetry({ url });

    const [isImageLoaded, setIsImageLoaded] = useState(false);

    if (canRetry) {
        return (
            <div className="flex flex-col items-center justify-center p-4 bg-red-50 border border-red-200 rounded-lg min-h-[150px] space-y-2">
                <AlertCircle className="h-8 w-8 text-red-500" />
                <p className="text-sm text-red-600 font-medium">Image failed to load</p>
                <button
                    onClick={handleRetry}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-red-200 text-red-600 text-sm rounded shadow-sm hover:bg-red-50 transition-colors"
                >
                    <RefreshCw className="h-3 w-3" />
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-1 relative group">
            <div className="relative overflow-hidden rounded-lg bg-gray-100 min-h-[200px] flex items-center justify-center">
                {isLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-10 transition-opacity">
                        <Loader2 className="h-8 w-8 text-green-600 animate-spin" />
                        {retryCount > 0 && (
                            <span className="text-xs text-green-600 mt-2 font-medium">
                                Retrying... ({retryCount})
                            </span>
                        )}
                    </div>
                )}

                {mediaUrl && (
                    <img
                        src={mediaUrl}
                        alt="WhatsApp Image"
                        className={`w-full h-auto rounded-lg cursor-pointer transition-opacity duration-300 ${isImageLoaded ? 'opacity-100' : 'opacity-0'
                            }`}
                        onClick={() => onImageClick?.(mediaUrl)}
                        onError={handleError}
                        onLoad={() => {
                            setIsImageLoaded(true);
                            handleLoad();
                        }}
                    />
                )}

                {/* Overlay for success state */}
                {isImageLoaded && !isLoading && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg flex items-center justify-center pointer-events-none">
                        <div className="opacity-0 group-hover:opacity-100 bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm transform translate-y-2 group-hover:translate-y-0 transition-all duration-200">
                            Click to view
                        </div>
                    </div>
                )}
            </div>

            {caption && (
                <p className="text-sm text-gray-700 whitespace-pre-wrap break-words px-1">
                    {caption}
                </p>
            )}
        </div>
    );
};
