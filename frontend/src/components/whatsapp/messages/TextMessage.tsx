import React from 'react';

interface TextMessageProps {
    text: string;
}

export const TextMessage: React.FC<TextMessageProps> = ({ text }) => {
    // Simple URL detection regex
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    if (!text) return null;

    // Split text by URLs to render links
    const parts = text.split(urlRegex);

    return (
        <p className="text-sm whitespace-pre-wrap break-words leading-5">
            {parts.map((part, i) => {
                if (part.match(urlRegex)) {
                    return (
                        <a
                            key={i}
                            href={part}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {part}
                        </a>
                    );
                }
                return part;
            })}
        </p>
    );
};
