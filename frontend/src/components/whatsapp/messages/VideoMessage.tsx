import React from 'react';
import { Video, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { useMediaRetry } from '../../../hooks/useMediaRetry';

interface VideoMessageProps {
    url?: string;
    caption?: string;
    thumbnail?: string;
    mimetype?: string;
}

export const VideoMessage: React.FC<VideoMessageProps> = ({
    url,
    caption,
    thumbnail,
    mimetype = 'video/mp4'
}) => {
    const {
        mediaUrl,
        isLoading,
        hasError,
        retryCount,
        canRetry,
        handleRetry,
        handleLoad,
        handleError
    } = useMediaRetry({ url });

    if (canRetry) {
        return (
            <div className="flex flex-col items-center justify-center p-4 bg-red-50 border border-red-200 rounded-lg min-h-[150px] space-y-2 max-w-sm">
                <AlertCircle className="h-8 w-8 text-red-500" />
                <p className="text-sm text-red-600 font-medium">Failed to load video</p>
                <div className="text-center">
                    <p className="text-xs text-red-500 mb-2">Maximum retry attempts reached</p>
                    <button
                        onClick={handleRetry}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-red-200 text-red-600 text-sm rounded shadow-sm hover:bg-red-50 transition-colors mx-auto"
                    >
                        <RefreshCw className="h-3 w-3" />
                        Retry Manual
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {mediaUrl ? (
                <div className="relative rounded-lg overflow-hidden bg-gray-900 max-w-sm min-h-[200px] flex items-center justify-center">
                    {/* Loading Overlay */}
                    {isLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800/80 z-20 backdrop-blur-sm">
                            <Loader2 className="h-8 w-8 text-green-500 animate-spin" />
                            <span className="text-xs text-white mt-2 font-medium">
                                {retryCount > 0 ? `Retrying... (${retryCount})` : 'Loading video...'}
                            </span>
                        </div>
                    )}

                    <video
                        src={mediaUrl}
                        controls
                        preload="metadata"
                        poster={thumbnail}
                        className="w-full max-h-96 rounded"
                        onError={handleError}
                        onLoadedMetadata={handleLoad}
                        onLoadedData={handleLoad} // Extra safety check
                        controlsList="nodownload"
                    >
                        <source src={mediaUrl} type={mimetype} />
                        Your browser does not support the video tag.
                    </video>

                    {!isLoading && !hasError && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            {/* Play button overlay (helper) if needed, but native controls are usually better */}
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex items-center justify-center p-6 bg-gray-100 rounded-lg h-40 w-64">
                    <Video className="h-10 w-10 text-gray-400" />
                    <span className="ml-3 text-sm text-gray-600">Video processing...</span>
                </div>
            )}

            {caption && caption !== '[Video]' && (
                <p className="text-sm whitespace-pre-wrap break-words px-1">{caption}</p>
            )}
        </div>
    );
};
