import { Image, Mic, FileText, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type MediaType = 'image' | 'video' | 'audio' | 'document';

interface MediaAttachmentButtonProps {
    onSelectType: (type: MediaType) => void;
    disabled?: boolean;
}

export function MediaAttachmentButton({ onSelectType, disabled }: MediaAttachmentButtonProps) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="hidden sm:flex" disabled={disabled}>
                    <Paperclip className="h-5 w-5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={() => onSelectType('image')}>
                    <Image className="mr-2 h-4 w-4" />
                    <span>Photo or Video</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSelectType('audio')}>
                    <Mic className="mr-2 h-4 w-4" />
                    <span>Audio</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSelectType('document')}>
                    <FileText className="mr-2 h-4 w-4" />
                    <span>Document</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
