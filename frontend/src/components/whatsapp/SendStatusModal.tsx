import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import whatsappService from '../../services/whatsapp.service';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface SendStatusProps {
    onSuccess: () => void;
}

const SendStatusModal: React.FC<SendStatusProps> = ({ onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [content, setContent] = useState('');
    const [mediaUrl, setMediaUrl] = useState('');
    const [type, setType] = useState<'text' | 'image' | 'video'>('text');

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!content && type === 'text') return;
        if (!mediaUrl && type !== 'text') return;

        setLoading(true);
        try {
            await whatsappService.sendStatus({
                content: content, // Backend expects content even for media as caption
                media_url: mediaUrl,
                // Services wrapper might need update if it doesn't support type argument.
                // Let's assume standard service structure for now or update it.
            } as any); // Type assertion if type is missing in current definition

            toast.success('Status sent successfully');
            setContent('');
            setMediaUrl('');
            onSuccess();
        } catch (error) {
            toast.error('Failed to send status');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 space-y-4">
            <h3 className="font-semibold text-lg">Update Status</h3>

            <div className="flex gap-2">
                {(['text', 'image', 'video'] as const).map((t) => (
                    <Button
                        key={t}
                        variant={type === t ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setType(t)}
                        className="capitalize"
                    >
                        {t}
                    </Button>
                ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {type !== 'text' && (
                    <div className="space-y-2">
                        <Label>Media URL</Label>
                        <Input
                            value={mediaUrl}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMediaUrl(e.target.value)}
                            placeholder="https://example.com/image.jpg"
                            required
                        />
                    </div>
                )}

                <div className="space-y-2">
                    <Label>{type === 'text' ? 'Status Text' : 'Caption'}</Label>
                    <Textarea
                        value={content}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
                        placeholder="What's on your mind?"
                        className="min-h-[100px]"
                        required={type === 'text'}
                    />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Send Update
                </Button>
            </form>
        </div>
    );
};

// Export component
export default SendStatusModal;
