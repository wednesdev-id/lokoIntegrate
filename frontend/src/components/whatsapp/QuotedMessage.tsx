import React from 'react';

interface QuotedMessageProps {
    sender?: string;
    message?: string;
    onClick?: () => void;
}

export const QuotedMessage: React.FC<QuotedMessageProps> = ({
    sender,
    message,
    onClick
}) => {
    return (
        <div
            className="mb-2 pl-3 py-2 border-l-4 border-green-500 bg-black/5 dark:bg-white/5 rounded-r cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition"
            onClick={onClick}
        >
            <p className="text-xs font-semibold text-green-600 dark:text-green-400">
                {sender || 'Unknown'}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                {message || '[Media]'}
            </p>
        </div>
    );
};
