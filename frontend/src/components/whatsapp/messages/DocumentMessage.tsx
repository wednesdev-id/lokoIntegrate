import React from 'react';
import { FileText, Download } from 'lucide-react';

interface DocumentMessageProps {
    url?: string;
    filename?: string;
    filesize?: string;
}

export const DocumentMessage: React.FC<DocumentMessageProps> = ({ url, filename, filesize }) => {
    return (
        <div className="flex items-center gap-3 p-2 rounded-md bg-black/5 dark:bg-white/5 max-w-sm">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30">
                <FileText className="h-5 w-5 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0 pr-2">
                <p className="text-sm font-medium truncate">{filename || 'Document'}</p>
                <p className="text-xs text-muted-foreground uppercase">{filesize || 'PDF'}</p>
            </div>
            {url && (
                <a
                    href={url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition"
                >
                    <Download className="h-5 w-5" />
                </a>
            )}
        </div>
    );
};
