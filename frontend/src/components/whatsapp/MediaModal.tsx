import React from 'react';
import { Mic } from 'lucide-react';

interface MediaModalProps {
    isOpen: boolean;
    type: 'image' | 'video' | 'audio' | null;
    url: string | null;
    caption?: string;
    onClose: () => void;
}

export const MediaModal: React.FC<MediaModalProps> = ({
    isOpen,
    type,
    url,
    caption,
    onClose
}) => {
    if (!isOpen || !url) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={onClose}
        >
            <div
                className="relative max-w-4xl w-full max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute -top-10 right-0 text-white hover:text-gray-300 transition"
                    aria-label="Close"
                >
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Media content */}
                <div className="bg-black rounded-lg overflow-hidden">
                    {type === 'image' ? (
                        <img
                            src={url}
                            alt="Full size"
                            className="w-full max-h-[85vh] object-contain mx-auto"
                        />
                    ) : type === 'video' ? (
                        <video
                            controls
                            autoPlay
                            className="w-full max-h-[80vh] mx-auto"
                            src={url}
                        >
                            <source src={url} type="video/mp4" />
                            Your browser doesn't support video playback.
                        </video>
                    ) : type === 'audio' ? (
                        <div className="p-8 flex flex-col items-center gap-6">
                            <div className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center">
                                <Mic className="w-12 h-12 text-white" />
                            </div>
                            <audio
                                controls
                                autoPlay
                                className="w-full max-w-md"
                                src={url}
                            >
                                Your browser doesn't support audio playback.
                            </audio>
                        </div>
                    ) : null}

                    {/* Caption */}
                    {caption && (
                        <div className="p-4 bg-black/50 text-white border-t border-white/10">
                            <p className="text-sm">{caption}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
