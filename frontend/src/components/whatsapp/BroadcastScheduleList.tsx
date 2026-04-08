import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, CheckCircle, AlertCircle, Loader2, ListChecks, Trash2, Send as SendIcon, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import axios from 'axios';
import { format } from 'date-fns';

interface BroadcastSchedule {
    id: string;
    broadcast_type: string;
    recipients: string[];
    message: string;
    message_type: string;
    scheduled_at: string;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
    sent_count: number;
    failed_count: number;
    error_message?: string;
    created_at: string;
}

interface RecipientHistory {
    id: number;
    recipient_input: string;
    resolved_jid: string;
    message_id?: string;
    rendered_body: string;
    status: 'pending' | 'sent' | 'failed';
    error_message?: string;
    sent_at?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    pending:    { label: 'Terjadwal', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    processing: { label: 'Proses...',  color: 'bg-blue-100 text-blue-800 border-blue-200' },
    completed:  { label: 'Selesai',   color: 'bg-green-100 text-green-800 border-green-200' },
    failed:     { label: 'Gagal',     color: 'bg-red-100 text-red-800 border-red-200' },
    cancelled:  { label: 'Dibatalkan',color: 'bg-gray-100 text-gray-700 border-gray-200' },
};

const BroadcastScheduleList: React.FC = () => {
    const { activeSession } = useSession();
    const [schedules, setSchedules] = useState<BroadcastSchedule[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);
    const [historyMap, setHistoryMap] = useState<Record<string, RecipientHistory[]>>({});

    const loadSchedules = useCallback(async () => {
        if (!activeSession?.session_code) return;
        setLoading(true);
        try {
            const res = await axios.get('/api/whatsapp/v1/broadcasts', {
                params: {
                    session_id: activeSession.session_id,
                    session_code: activeSession.session_code,
                    ...(statusFilter ? { status: statusFilter } : {}),
                },
            });
            if (res.data.success) {
                setSchedules(res.data.data?.schedules || []);
            }
        } catch (err) {
            console.error('Failed to load broadcast schedules:', err);
        } finally {
            setLoading(false);
        }
    }, [activeSession, statusFilter]);

    useEffect(() => {
        loadSchedules();
        // Auto-refresh every 30s while component is mounted
        const interval = setInterval(loadSchedules, 30000);
        return () => clearInterval(interval);
    }, [loadSchedules]);

    const handleCancel = async (id: string) => {
        if (!activeSession?.session_code) return;
        setActionLoading(id);
        try {
            await axios.delete(`/api/whatsapp/v1/broadcasts/${id}`, {
                params: {
                    session_id: activeSession.session_id,
                    session_code: activeSession.session_code,
                },
            });
            await loadSchedules();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to cancel');
        } finally {
            setActionLoading(null);
        }
    };

    const handleSendNow = async (id: string) => {
        if (!activeSession?.session_code) return;
        setActionLoading(id);
        try {
            await axios.post(`/api/whatsapp/v1/broadcasts/${id}/send`, null, {
                params: {
                    session_id: activeSession.session_id,
                    session_code: activeSession.session_code,
                },
            });
            await loadSchedules();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to send');
        } finally {
            setActionLoading(null);
        }
    };

    const loadHistory = async (id: string) => {
        if (!activeSession?.session_code) return;
        setHistoryLoadingId(id);
        try {
            const res = await axios.get(`/api/whatsapp/v1/broadcasts/${id}/history`, {
                params: {
                    session_id: activeSession.session_id,
                    session_code: activeSession.session_code,
                },
            });
            if (res.data.success) {
                setHistoryMap((prev) => ({
                    ...prev,
                    [id]: res.data.data?.items || [],
                }));
            }
        } catch (err) {
            console.error('Failed to load broadcast history:', err);
        } finally {
            setHistoryLoadingId(null);
        }
    };

    const toggleHistory = async (id: string) => {
        if (expandedId === id) {
            setExpandedId(null);
            return;
        }
        setExpandedId(id);
        if (!historyMap[id]) {
            await loadHistory(id);
        }
    };

    const handleRetryFailed = async (id: string) => {
        if (!activeSession?.session_code) return;
        setActionLoading(id);
        try {
            await axios.post(`/api/whatsapp/v1/broadcasts/${id}/retry-failed`, null, {
                params: {
                    session_id: activeSession.session_id,
                    session_code: activeSession.session_code,
                },
            });
            await loadSchedules();
            await loadHistory(id);
            alert('Retry failed recipients berhasil dibuat.');
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to retry failed recipients');
        } finally {
            setActionLoading(null);
        }
    };

    const filters = [
        { value: '', label: 'Semua' },
        { value: 'pending', label: 'Terjadwal' },
        { value: 'processing', label: 'Proses' },
        { value: 'completed', label: 'Selesai' },
        { value: 'failed', label: 'Gagal' },
        { value: 'cancelled', label: 'Dibatalkan' },
    ];

    if (!activeSession?.session_code) {
        return (
            <div className="p-6 text-center text-sm text-yellow-700 bg-yellow-50 rounded-lg border border-yellow-200">
                ⚠️ Session code tidak tersedia — tidak dapat memuat jadwal broadcast
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Filter bar */}
            <div className="flex items-center gap-2 flex-wrap">
                <ListChecks className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Filter:</span>
                {filters.map(f => (
                    <button
                        key={f.value}
                        onClick={() => setStatusFilter(f.value)}
                        className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                            statusFilter === f.value
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
                <Button variant="ghost" size="sm" onClick={loadSchedules} className="ml-auto">
                    {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Refresh'}
                </Button>
            </div>

            {/* Schedule list */}
            {loading && schedules.length === 0 ? (
                <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
            ) : schedules.length === 0 ? (
                <div className="text-center py-10 text-sm text-gray-500">
                    Belum ada jadwal broadcast
                </div>
            ) : (
                <div className="space-y-3">
                    {schedules.map(s => {
                        const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.pending;
                        const isLoading = actionLoading === s.id;
                        const history = historyMap[s.id] || [];
                        const failedRecipients = history.filter((h) => h.status === 'failed').length;
                        return (
                            <Card key={s.id} className="bg-white/70 border-white/50">
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0 space-y-1">
                                            {/* Status + type */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge className={`text-[10px] border ${cfg.color}`}>
                                                    {cfg.label}
                                                </Badge>
                                                <Badge variant="outline" className="text-[10px]">
                                                    {s.broadcast_type === 'group' ? '👥 Group' : '👤 Individual'}
                                                </Badge>
                                                <Badge variant="outline" className="text-[10px]">
                                                    {s.recipients?.length || 0} penerima
                                                </Badge>
                                            </div>

                                            {/* Message preview */}
                                            <p className="text-sm text-gray-800 line-clamp-2">
                                                {s.message || '(media only)'}
                                            </p>

                                            {/* Schedule time */}
                                            <div className="flex items-center gap-3 text-xs text-gray-500">
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" />
                                                    {format(new Date(s.scheduled_at), 'dd MMM yyyy')}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {format(new Date(s.scheduled_at), 'HH:mm')}
                                                </span>
                                            </div>

                                            {/* Progress */}
                                            {(s.status === 'processing' || s.status === 'completed' || s.status === 'failed') && (
                                                <div className="flex items-center gap-3 text-xs">
                                                    <span className="flex items-center gap-1 text-green-700">
                                                        <CheckCircle className="h-3 w-3" />
                                                        {s.sent_count} terkirim
                                                    </span>
                                                    {s.failed_count > 0 && (
                                                        <span className="flex items-center gap-1 text-red-600">
                                                            <AlertCircle className="h-3 w-3" />
                                                            {s.failed_count} gagal
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {s.error_message && (
                                                <p className="text-xs text-red-500">{s.error_message}</p>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-col gap-2 shrink-0">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 text-xs"
                                                onClick={() => toggleHistory(s.id)}
                                                disabled={historyLoadingId === s.id}
                                            >
                                                {historyLoadingId === s.id ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <>
                                                        {expandedId === s.id ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                                                        History
                                                    </>
                                                )}
                                            </Button>
                                            {(s.status === 'pending' || s.status === 'failed') && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 text-xs text-blue-700 border-blue-200 hover:bg-blue-50"
                                                    onClick={() => handleSendNow(s.id)}
                                                    disabled={isLoading}
                                                >
                                                    {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><SendIcon className="h-3 w-3 mr-1" />Kirim Sekarang</>}
                                                </Button>
                                            )}
                                            {s.status === 'pending' && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 text-xs text-red-700 border-red-200 hover:bg-red-50"
                                                    onClick={() => handleCancel(s.id)}
                                                    disabled={isLoading}
                                                >
                                                    {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Trash2 className="h-3 w-3 mr-1" />Batalkan</>}
                                                </Button>
                                            )}
                                            {(s.status === 'failed' || s.failed_count > 0 || failedRecipients > 0) && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 text-xs text-orange-700 border-orange-200 hover:bg-orange-50"
                                                    onClick={() => handleRetryFailed(s.id)}
                                                    disabled={isLoading}
                                                >
                                                    {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><RotateCcw className="h-3 w-3 mr-1" />Retry Gagal</>}
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {expandedId === s.id && (
                                        <div className="mt-4 border-t pt-3">
                                            <p className="text-xs font-medium text-gray-600 mb-2">Status per penerima</p>
                                            {!historyMap[s.id] ? (
                                                <div className="text-xs text-gray-500">Klik refresh jika data belum muncul.</div>
                                            ) : history.length === 0 ? (
                                                <div className="text-xs text-gray-500">Belum ada data penerima untuk broadcast ini.</div>
                                            ) : (
                                                <div className="max-h-56 overflow-y-auto space-y-2">
                                                    {history.map((item) => (
                                                        <div key={item.id} className="rounded-md border border-gray-200 p-2">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <p className="text-xs font-medium text-gray-800 truncate">{item.recipient_input || item.resolved_jid}</p>
                                                                <Badge
                                                                    className={`text-[10px] border ${
                                                                        item.status === 'sent'
                                                                            ? 'bg-green-100 text-green-800 border-green-200'
                                                                            : item.status === 'failed'
                                                                            ? 'bg-red-100 text-red-800 border-red-200'
                                                                            : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                                                                    }`}
                                                                >
                                                                    {item.status}
                                                                </Badge>
                                                            </div>
                                                            {item.error_message && (
                                                                <p className="text-[11px] text-red-600 mt-1">{item.error_message}</p>
                                                            )}
                                                            {item.sent_at && (
                                                                <p className="text-[11px] text-gray-500 mt-1">
                                                                    Sent at {format(new Date(item.sent_at), 'dd MMM yyyy HH:mm')}
                                                                </p>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default BroadcastScheduleList;
