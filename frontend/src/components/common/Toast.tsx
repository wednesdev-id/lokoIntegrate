import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export interface ToastProps {
    title: string;
    message: string;
    timestamp?: string;
    onClose: () => void;
    onClick?: () => void;
    duration?: number; // Auto-dismiss duration in ms (default: 5000)
}

export const Toast: React.FC<ToastProps> = ({
    title,
    message,
    timestamp,
    onClose,
    onClick,
    duration = 5000,
}) => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        // Auto-dismiss after duration
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(onClose, 300); // Wait for fade-out animation
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const handleClick = () => {
        if (onClick) {
            onClick();
            setIsVisible(false);
            setTimeout(onClose, 300);
        }
    };

    return (
        <div
            className={`fixed top-4 right-4 z-50 max-w-sm bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 transition-all duration-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
                } ${onClick ? 'cursor-pointer hover:shadow-xl' : ''}`}
            onClick={handleClick}
        >
            <div className="p-4 flex items-start gap-3">
                {/* WhatsApp-style icon */}
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                {title}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mt-1">
                                {message}
                            </p>
                            {timestamp && (
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                    {timestamp}
                                </p>
                            )}
                        </div>

                        {/* Close button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsVisible(false);
                                setTimeout(onClose, 300);
                            }}
                            className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-gray-100 dark:bg-gray-700 rounded-b-lg overflow-hidden">
                <div
                    className="h-full bg-green-500 transition-all ease-linear"
                    style={{
                        animation: `shrink ${duration}ms linear`,
                    }}
                />
            </div>

            <style>{`
        @keyframes shrink {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
        </div>
    );
};

// Toast container for managing multiple toasts
export interface ToastContainerProps {
    toasts: Array<Omit<ToastProps, 'onClose'> & { id: string }>;
    removeToast: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
    return (
        <div className="fixed top-0 right-0 z-50 pointer-events-none">
            <div className="pointer-events-auto space-y-2 p-4">
                {toasts.map((toast, index) => (
                    <div
                        key={toast.id}
                        style={{
                            marginTop: index > 0 ? '-8px' : '0',
                            transform: `translateY(${index * 4}px)`,
                        }}
                    >
                        <Toast
                            {...toast}
                            onClose={() => removeToast(toast.id)}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};
