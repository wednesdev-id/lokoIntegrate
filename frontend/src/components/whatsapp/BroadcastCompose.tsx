import React, { useState, useRef, useMemo } from 'react';
import {
    Send,
    Upload,
    Users,
    X,
    CheckCircle,
    AlertCircle,
    Clock,
    Eye,
    UserPlus,
    Sparkles,
    Image as ImageIcon,
    Video,
    Link,
    Calendar,
    Zap,
} from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ImportContactsDialog from './ImportContactsDialog';
import { nanoid } from 'nanoid';
import axios from 'axios';

interface BulkMessageJob {
    id: string;
    sessionId: string;
    sessionName: string;
    total: number;
    sent: number;
    failed: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    startTime: Date;
    endTime?: Date;
}

interface BroadcastComposeProps {
    message: string;
    setMessage: (msg: string) => void;
}

const BroadcastCompose: React.FC<BroadcastComposeProps> = ({ message, setMessage }) => {
    const { activeSession } = useSession();

    const [recipients, setRecipients] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [jobs, setJobs] = useState<BulkMessageJob[]>([]);
    const [recipientInput, setRecipientInput] = useState('');
    const [delayMs, setDelayMs] = useState(1000);
    const [showPreview, setShowPreview] = useState(false);
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [useUniqueCode, setUseUniqueCode] = useState(true);

    // Scheduling
    const [isScheduled, setIsScheduled] = useState(false);
    const [scheduledAt, setScheduledAt] = useState(''); // datetime-local value

    // Media States
    const [mediaType, setMediaType] = useState<'text' | 'image' | 'video'>('text');
    const [mediaUrl, setMediaUrl] = useState('');
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const csvInputRef = useRef<HTMLInputElement>(null);

    // Default preview code that remains stable while typing
    const [previewCode] = useState(() => nanoid(5));

    const availableVariables = useMemo(() => {
        const base = [
            'name',
            'push_name',
            'phone',
            'jid',
            'id',
            'session_id',
            'user_id',
            'phone_number',
            'avatar_url',
            'is_blocked',
            'last_seen',
            'created_at',
            'updated_at',
        ];
        if (useUniqueCode) {
            return [...base, 'code'];
        }
        return base;
    }, [useUniqueCode]);

    const insertVariable = (key: string) => {
        const token = `{{${key}}}`;
        setMessage(message ? `${message}${token}` : token);
    };

    // Handle File Selection
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validation
        if (mediaType === 'image' && !file.type.startsWith('image/')) {
            alert('Please select a valid image file');
            return;
        }
        if (mediaType === 'video' && !file.type.startsWith('video/')) {
            alert('Please select a valid video file');
            return;
        }
        if (file.size > 16 * 1024 * 1024) { // 16MB limit
            alert('File size too large (max 16MB)');
            return;
        }

        setMediaFile(file);
        
        // Create preview URL
        const reader = new FileReader();
        reader.onload = (e) => setMediaPreview(e.target?.result as string);
        reader.readAsDataURL(file);
    };

    const clearMedia = () => {
        setMediaFile(null);
        setMediaPreview(null);
        setMediaUrl('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Generate preview message for a hypothetical recipient
    const previewMessage = useMemo(() => {
        let msg = message;
        if (useUniqueCode) {
            if (msg.includes('{{code}}')) {
                msg = msg.replace(/\{\{code\}\}/g, previewCode);
            } else {
                msg = msg ? `${msg}\n\n#${previewCode}` : '';
            }
        }
        return msg;
    }, [message, previewCode, useUniqueCode]);

    // Add recipient
    const addRecipient = () => {
        const num = recipientInput.trim().replace(/[\s-()]/g, '');
        if (num && !recipients.includes(num)) {
            setRecipients([...recipients, num]);
            setRecipientInput('');
        }
    };

    // Remove recipient
    const removeRecipient = (phone: string) => {
        setRecipients(recipients.filter((n) => n !== phone));
    };

    // Import contacts from dialog
    const handleImportContacts = (phones: string[]) => {
        const unique = [...new Set([...recipients, ...phones])];
        setRecipients(unique);
    };

    // CSV upload
    const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const lines = text.split('\n');
            if (lines.length === 0) return;

            // Proper CSV line parser that handles commas inside quotes and preserves empty columns
            const parseCSVLine = (line: string): string[] => {
                const result: string[] = [];
                let curVal = '';
                let inQuotes = false;

                for (let j = 0; j < line.length; j++) {
                    const char = line[j];
                    if (char === '"') {
                        if (inQuotes && line[j + 1] === '"') {
                            curVal += '"';
                            j++; // Skip escaped quote
                        } else {
                            inQuotes = !inQuotes;
                        }
                    } else if (char === ',' && !inQuotes) {
                        result.push(curVal);
                        curVal = '';
                    } else {
                        curVal += char;
                    }
                }
                result.push(curVal);
                return result;
            };

            // Use the first line to find headers
            const headerRow = parseCSVLine(lines[0]);
            let phoneIdx = -1;

            for (let i = 0; i < headerRow.length; i++) {
                const header = headerRow[i].trim().toLowerCase();
                if (header === 'phone 1 - value' || header === 'phone' || header === 'nomor telepon' || header === 'phone number') {
                    phoneIdx = i;
                    break;
                }
            }

            const phoneNumbers: string[] = [];

            for (let i = 1; i < lines.length; i++) {
                const cols = parseCSVLine(lines[i]);
                if (cols.length === 0) continue;

                let rawPhone = '';

                // If we found a proper phone column, grab it
                if (phoneIdx !== -1 && cols.length > phoneIdx) {
                    rawPhone = cols[phoneIdx].trim();
                } else {
                    // Fallback to the first column that looks like a phone number for un-headered CSVs
                    for (const col of cols) {
                        const trimmed = col.trim();
                        // Allows basic phone numbers, starting with optional +, containing digits, spaces, -, ()
                        if (trimmed && /^\+?[\d\s\-()]+$/.test(trimmed)) {
                            rawPhone = trimmed;
                            break;
                        }
                    }
                }

                if (rawPhone) {
                    const cleanPhone = rawPhone.replace(/[\s-()]/g, '');
                    // Basic sanity check for a complete phone number length
                    if (cleanPhone.length >= 8) {
                        phoneNumbers.push(cleanPhone);
                    }
                }
            }

            const unique = [...new Set([...recipients, ...phoneNumbers])];
            setRecipients(unique);
        };

        reader.readAsText(file);
        // Reset input so same file can be re-uploaded
        event.target.value = '';
    };



    // Send or schedule broadcast via backend
    const sendBroadcast = async () => {
        if (!activeSession || recipients.length === 0) return;
        if (!activeSession.session_code) {
            alert('Session code tidak tersedia. Silakan pilih session yang valid.');
            return;
        }
        if (!message.trim() && !mediaFile && !mediaUrl) {
            alert('Please provide a message or media to send');
            return;
        }
        if (isScheduled && !scheduledAt) {
            alert('Please select a scheduled time');
            return;
        }

        setLoading(true);
        const jobId = Date.now().toString();

        // Determine scheduled_at — send now = 1s from now, scheduled = user selected datetime
        let scheduledAtISO: string;
        if (isScheduled && scheduledAt) {
            scheduledAtISO = new Date(scheduledAt).toISOString();
        } else {
            scheduledAtISO = new Date(Date.now() + 1000).toISOString();
        }

        let mediaBase64: string | undefined;
        if (mediaFile) {
            mediaBase64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target?.result as string);
                reader.readAsDataURL(mediaFile);
            });
        }

        const newJob: BulkMessageJob = {
            id: jobId,
            sessionId: activeSession.session_id,
            sessionName: activeSession.session_name,
            total: recipients.length,
            sent: 0,
            failed: 0,
            status: isScheduled ? 'pending' : 'processing',
            startTime: new Date(),
        };
        setJobs((prev) => [newJob, ...prev]);

        try {
            await axios.post('/api/whatsapp/v1/broadcasts', {
                session_id: activeSession.session_id,
                session_code: activeSession.session_code,
                broadcast_type: 'individual',
                recipients,
                message: message.trim(),
                media_url: mediaBase64 || (mediaUrl || undefined),
                message_type: mediaType,
                delay_ms: delayMs,
                use_unique_code: useUniqueCode,
                scheduled_at: scheduledAtISO,
            });

            setJobs((prev) =>
                prev.map((j) =>
                    j.id === jobId
                        ? {
                            ...j,
                            status: isScheduled ? 'pending' : 'completed',
                            sent: isScheduled ? 0 : recipients.length,
                            failed: 0,
                            endTime: new Date()
                        }
                        : j
                )
            );

            if (!isScheduled) {
                setRecipients([]);
                setMessage('');
                clearMedia();
            }
        } catch (err: any) {
            setJobs((prev) =>
                prev.map((j) =>
                    j.id === jobId ? { ...j, status: 'failed', sent: 0, failed: recipients.length, endTime: new Date() } : j
                )
            );
            alert(err.response?.data?.message || 'Failed to create broadcast');
        }

        setLoading(false);
    };

    const formatDuration = (start: Date, end?: Date) => {
        const d = Math.round(((end || new Date()).getTime() - start.getTime()) / 1000);
        const m = Math.floor(d / 60);
        return m > 0 ? `${m}m ${d % 60}s` : `${d}s`;
    };

    return (
        <div className="space-y-5">
            {/* Recipients Section */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Recipients</label>

                {/* Manual input */}
                <div className="flex gap-2 mb-3">
                    <input
                        type="text"
                        value={recipientInput}
                        onChange={(e) => setRecipientInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addRecipient()}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Enter phone number (e.g., 628123456789)"
                    />
                    <Button onClick={addRecipient} size="sm" className="bg-blue-600 hover:bg-blue-700">
                        Add
                    </Button>
                </div>

                {/* Import buttons */}
                <div className="flex gap-2 mb-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setImportDialogOpen(true)}
                        className="bg-white/60 backdrop-blur-sm"
                    >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Import Contacts
                    </Button>
                    <input
                        ref={csvInputRef}
                        type="file"
                        accept=".csv,.txt"
                        onChange={handleCSVUpload}
                        className="hidden"
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => csvInputRef.current?.click()}
                        className="bg-white/60 backdrop-blur-sm"
                    >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload CSV
                    </Button>
                </div>

                {/* Recipients list */}
                {recipients.length > 0 && (
                    <div className="border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto bg-white/40 backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-2">
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                <Users className="h-3 w-3 mr-1" />
                                {recipients.length} recipient{recipients.length !== 1 ? 's' : ''}
                            </Badge>
                            <button
                                onClick={() => setRecipients([])}
                                className="text-xs text-red-600 hover:text-red-800 font-medium"
                            >
                                Clear all
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {recipients.map((phone) => (
                                <span
                                    key={phone}
                                    className="inline-flex items-center px-2.5 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                                >
                                    {phone}
                                    <button onClick={() => removeRecipient(phone)} className="ml-1.5">
                                        <X className="h-3 w-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Message & Media Section */}
            <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700">Message Content</label>
                
                <Tabs defaultValue="text" value={mediaType} onValueChange={(v) => setMediaType(v as any)} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 bg-white/60 backdrop-blur-sm">
                        <TabsTrigger value="text" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Text Only</TabsTrigger>
                        <TabsTrigger value="image" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Image</TabsTrigger>
                        <TabsTrigger value="video" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Video</TabsTrigger>
                    </TabsList>
                    
                    <div className="mt-4 p-4 border rounded-lg bg-white/60 backdrop-blur-sm">
                        {/* Media Input Area */}
                        {mediaType !== 'text' && (
                            <div className="mb-4 space-y-3">
                                <Label>Media Source</Label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* File Upload */}
                                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50 transition-colors relative">
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept={mediaType === 'image' ? "image/*" : "video/*"}
                                            onChange={handleFileSelect}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                        <div className="flex flex-col items-center gap-2 text-gray-500">
                                            {mediaType === 'image' ? <ImageIcon className="h-8 w-8" /> : <Video className="h-8 w-8" />}
                                            <span className="text-sm font-medium">Click to upload {mediaType}</span>
                                            <span className="text-xs">Max 16MB</span>
                                        </div>
                                    </div>

                                    {/* URL Input */}
                                    <div className="flex flex-col justify-center gap-2">
                                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                                            <Link className="h-4 w-4" />
                                            <span>Or use URL</span>
                                        </div>
                                        <Input 
                                            placeholder={`https://example.com/${mediaType}.mp4`}
                                            value={mediaUrl}
                                            onChange={(e) => setMediaUrl(e.target.value)}
                                            disabled={!!mediaFile}
                                        />
                                    </div>
                                </div>

                                {/* Preview Area */}
                                {(mediaPreview || mediaUrl) && (
                                    <div className="relative mt-2 rounded-lg overflow-hidden border bg-black/5 max-h-48 flex items-center justify-center">
                                        <Button 
                                            variant="destructive" 
                                            size="icon" 
                                            className="absolute top-2 right-2 h-6 w-6 rounded-full"
                                            onClick={clearMedia}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                        
                                        {mediaType === 'image' ? (
                                            <img src={mediaPreview || mediaUrl} alt="Preview" className="h-full object-contain max-h-48" />
                                        ) : (
                                            <video src={mediaPreview || mediaUrl} controls className="h-full max-h-48" />
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Caption / Message Input */}
                        <div className="space-y-2">
                            <Label>{mediaType === 'text' ? 'Message' : 'Caption'}</Label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                rows={5}
                                className="block w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                                placeholder={mediaType === 'text'
                                    ? "Type your message... e.g. Halo {{name}}, nomor {{phone}}"
                                    : "Add a caption..."}
                            />
                            <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <p className="text-xs font-medium text-blue-900">
                                        Available Variables
                                    </p>
                                    <p className="text-[11px] text-blue-700">
                                        Klik variable untuk insert ke pesan
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {availableVariables.map((key) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => insertVariable(key)}
                                            className="px-2 py-1 rounded-full bg-white border border-blue-200 text-blue-700 text-[11px] font-mono hover:bg-blue-100"
                                            title={`Insert {{${key}}}`}
                                        >
                                            {`{{${key}}}`}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[11px] text-blue-800/80 mt-2">
                                    Prioritas nama: <code>{'{{name}}'}</code> → <code>{'{{push_name}}'}</code> → <code>{'{{phone}}'}</code>.
                                </p>
                            </div>
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-gray-500">{message.length} characters</p>
                                <button
                                    onClick={() => setShowPreview(!showPreview)}
                                    className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                                >
                                    <Eye className="h-3 w-3" />
                                    {showPreview ? 'Hide Preview' : 'Show Preview'}
                                </button>
                            </div>
                        </div>

                        {/* Anti-Spam Toggle */}
                        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                            <input
                                type="checkbox"
                                id="useUniqueCode"
                                checked={useUniqueCode}
                                onChange={(e) => setUseUniqueCode(e.target.checked)}
                                className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                            />
                            <label htmlFor="useUniqueCode" className="text-sm font-medium text-gray-700 cursor-pointer flex-1">
                                Append Anti-Spam Suffix
                            </label>
                            <Badge variant="outline" className={`text-[10px] ${useUniqueCode ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                                {useUniqueCode ? 'Enabled' : 'Disabled'}
                            </Badge>
                        </div>
                    </div>
                </Tabs>
            </div>

            {/* Preview */}
            {showPreview && message && (
                <Card className="border-blue-200 bg-blue-50/50">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-900">Message Preview</span>
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                Unique per recipient
                            </Badge>
                        </div>
                        <div className="bg-white rounded-lg p-3 text-sm text-gray-800 whitespace-pre-line shadow-sm">
                            {previewMessage}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Delay */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Delay Between Messages (ms)
                </label>
                <input
                    type="number"
                    value={delayMs}
                    onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setDelayMs(isNaN(val) ? 0 : Math.max(0, val));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    min="0"
                    step="100"
                />
                <p className="text-xs text-gray-500 mt-1">Recommended: 1000ms to avoid rate limiting. 0ms for no delay.</p>
            </div>

            {/* Schedule Section */}
            <div className="border border-gray-200 rounded-xl p-4 bg-gradient-to-r from-indigo-50/50 to-blue-50/50">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-indigo-600" />
                        <span className="text-sm font-medium text-gray-800">Jadwalkan Broadcast</span>
                    </div>
                    <button
                        onClick={() => setIsScheduled(!isScheduled)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            isScheduled ? 'bg-indigo-600' : 'bg-gray-200'
                        }`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            isScheduled ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                    </button>
                </div>

                {isScheduled ? (
                    <div className="space-y-2">
                        <label className="text-xs text-gray-600">Waktu pengiriman</label>
                        <input
                            type="datetime-local"
                            value={scheduledAt}
                            onChange={(e) => setScheduledAt(e.target.value)}
                            min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                            className="w-full px-3 py-2 border border-indigo-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-400 text-sm"
                        />
                        <p className="text-xs text-indigo-600 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Pesan akan dikirim otomatis pada waktu yang dipilih
                        </p>
                    </div>
                ) : (
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        Pesan akan dikirim segera setelah klik tombol broadcast
                    </p>
                )}
            </div>

            {/* Warning for large sends */}
            {recipients.length > 50 && (
                <Alert className="bg-yellow-50/80 border-yellow-200">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-yellow-800">
                        Sending to {recipients.length} recipients. Estimated time:{' '}
                        {Math.ceil((recipients.length * delayMs) / 1000 / 60)} minutes.
                    </AlertDescription>
                </Alert>
            )}

            {/* Send/Schedule button */}
            <Button
                onClick={sendBroadcast}
                disabled={loading || recipients.length === 0 || (!message.trim() && !mediaFile && !mediaUrl) || (isScheduled && !scheduledAt)}
                className={`w-full shadow-lg h-11 ${
                    isScheduled
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700'
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                }`}
            >
                {loading ? (
                    <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        {isScheduled ? 'Menjadwalkan...' : 'Mengirim...'}
                    </>
                ) : isScheduled ? (
                    <>
                        <Calendar className="h-4 w-4 mr-2" />
                        Jadwalkan ke {recipients.length || 0} Penerima
                    </>
                ) : (
                    <>
                        <Send className="h-4 w-4 mr-2" />
                        Broadcast ke {recipients.length || 0} Penerima
                    </>
                )}
            </Button>

            {/* Job History */}
            {jobs.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Broadcast History
                    </h4>
                    {jobs.map((job) => (
                        <div
                            key={job.id}
                            className="flex items-center justify-between p-3 border rounded-lg bg-white/50 backdrop-blur-sm"
                        >
                            <div className="flex items-center gap-3 flex-1">
                                {job.status === 'completed' ? (
                                    <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                                ) : job.status === 'failed' ? (
                                    <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                                ) : job.status === 'pending' ? (
                                    <Clock className="h-5 w-5 text-amber-500 shrink-0" />
                                ) : (
                                    <Clock className="h-5 w-5 text-blue-500 animate-spin shrink-0" />
                                )}
                                <div className="min-w-0">
                                    <span className="text-sm font-medium">
                                        {job.status === 'pending'
                                            ? `scheduled • ${job.total} recipients`
                                            : `${job.sent}/${job.total} sent`}
                                    </span>
                                    {job.failed > 0 && (
                                        <span className="text-xs text-red-500 ml-2">{job.failed} failed</span>
                                    )}
                                    <p className="text-xs text-gray-500">{job.startTime.toLocaleString()}</p>
                                </div>
                            </div>
                            <span className="text-xs text-gray-500 shrink-0">
                                {formatDuration(job.startTime, job.endTime)}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Import dialog */}
            <ImportContactsDialog
                open={importDialogOpen}
                onOpenChange={setImportDialogOpen}
                onImport={handleImportContacts}
                existingRecipients={recipients}
            />
        </div>
    );
};

export default BroadcastCompose;
