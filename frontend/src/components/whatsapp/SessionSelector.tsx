import React, { useState } from 'react';
import { useSession, Session } from '@/contexts/SessionContext';
import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Smartphone,
    ChevronDown,
    Plus,
    Power,
    PowerOff,
    CheckCircle2,
    Circle,
    AlertCircle,
    QrCode,
    Trash2,
    RefreshCw,
    Clock
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { QRCodeSVG } from 'qrcode.react';

interface SessionSelectorProps {
    variant?: 'navbar' | 'dropdown' | 'compact';
    showCreateButton?: boolean;
    onCreateClick?: () => void;
    className?: string;
}

const SessionSelector: React.FC<SessionSelectorProps> = ({
    variant = 'navbar',
    showCreateButton = true,
    onCreateClick,
    className = ''
}) => {
    const {
        activeSession,
        setActiveSession,
        sessions,
        loading,
        connectSession,
        disconnectSession,
        deleteSession,
        refreshSessions
    } = useSession();

    const { user } = useUser();
    const maxSessions = user?.max_sessions || 1;
    const sessionCount = sessions.length;
    const isLimitReached = sessionCount >= maxSessions;

    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [showQRModal, setShowQRModal] = useState(false);
    const [qrSession, setQrSession] = useState<Session | null>(null);
    const [qrCodeString, setQrCodeString] = useState('');
    const [qrLoading, setQrLoading] = useState(false);
    const [qrExpiry, setQrExpiry] = useState(60);

    // Get status icon and color
    const getStatusIcon = (status: Session['status']) => {
        switch (status) {
            case 'connected':
                return <CheckCircle2 className="h-4 w-4 text-green-500" />;
            case 'qr_ready':
            case 'connecting':
                return <AlertCircle className="h-4 w-4 text-yellow-500" />;
            case 'disconnected':
            case 'created':
                return <Circle className="h-4 w-4 text-gray-400" />;
            default:
                return <Circle className="h-4 w-4 text-gray-400" />;
        }
    };

    // Get status badge
    const getStatusBadge = (status: Session['status']) => {
        const statusConfig = {
            connected: { label: 'Connected', className: 'bg-green-500/10 text-green-700 border-green-500/20' },
            qr_ready: { label: 'QR Ready', className: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20' },
            connecting: { label: 'Connecting', className: 'bg-blue-500/10 text-blue-700 border-blue-500/20' },
            disconnected: { label: 'Disconnected', className: 'bg-red-500/10 text-red-700 border-red-500/20' },
            created: { label: 'Created', className: 'bg-gray-500/10 text-gray-700 border-gray-500/20' }
        };

        const config = statusConfig[status] || statusConfig.created;

        return (
            <Badge variant="outline" className={`${config.className} text-xs`}>
                {config.label}
            </Badge>
        );
    };

    // Handle session selection
    const handleSelectSession = (session: Session) => {
        setActiveSession(session);
    };

    // Handle connect
    const handleConnect = async (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        setActionLoading(sessionId);

        try {
            const result: any = await connectSession(sessionId);
            // If connection requires QR, show modal automatically
            if (result && (result.status === 'qr_ready' || result.data?.status === 'qr_ready')) {
                setQrSession(sessions.find(s => s.session_id === sessionId) || null);
                setShowQRModal(true);
            }
        } catch (error) {
            console.error('Connect error:', error);
        } finally {
            setActionLoading(null);
        }
    };

    // Handle disconnect
    const handleDisconnect = async (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        setActionLoading(sessionId);

        try {
            await disconnectSession(sessionId);
        } catch (error) {
            console.error('Disconnect error:', error);
        } finally {
            setActionLoading(null);
        }
    };

    const [qrExpired, setQrExpired] = React.useState(false);

    // Handle session deletion
    const handleDelete = async (e: React.MouseEvent, session: Session) => {
        e.stopPropagation();
        if (!confirm(`Are you sure you want to delete session "${session.session_name}"?`)) return;

        setActionLoading(session.session_id);
        try {
            await deleteSession(session.session_id);
        } catch (error) {
            console.error('Delete error:', error);
        } finally {
            setActionLoading(null);
        }
    };

    // Handle show QR
    const handleShowQR = (e: React.MouseEvent, session: Session) => {
        e.stopPropagation();
        setQrSession(session);
        setQrCodeString('');
        setQrExpired(false);
        setQrExpiry(60);
        setShowQRModal(true);
    };

    // Handle explicitly refreshing a QR code
    const handleRefreshQR = async () => {
        if (!qrSession) return;
        setQrLoading(true);
        setQrCodeString(''); // clear old QR
        setQrExpired(false); // Restarts the polling due to dependencies
        setQrExpiry(60);
        try {
            await connectSession(qrSession.session_id);
            refreshSessions();
        } catch (error) {
            console.error('Failed to refresh QR:', error);
            setQrExpired(true); // If it failed to connect, mark as expired to allow retry
        } finally {
            // We do NOT set qrLoading to false here; the polling will pick up the new QR 
            // and handle turning off the loading state.
        }
    };

    // Poll for QR updates while modal is open
    React.useEffect(() => {
        if (!showQRModal || !qrSession || qrExpired) return;

        let isSubscribed = true;
        setQrLoading(true);

        const fetchQR = async () => {
            try {
                const res = await fetch(`/api/whatsapp/v1/sessions/${qrSession.session_id}/qr`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}` }
                });

                // Read response data
                const data = await res.json().catch(() => ({}));

                // Handle 404 (Session deleted or QR expired/not available)
                if (res.status === 404) {
                    if (data?.error?.includes('QR code not available')) {
                        // If we already had a QR code and it disappeared, it implies expiration
                        setQrCodeString(prev => {
                            if (prev) {
                                setQrExpired(true);
                            }
                            return prev;
                        });
                    } else {
                        console.warn('Session not found (404), likely deleted. Stopping polling.');
                        setShowQRModal(false);
                        refreshSessions(); // Refresh list to remove stale session
                    }
                    return;
                }

                if (isSubscribed && data.success && data.data?.qr_code) {
                    setQrCodeString(prev => {
                        if (prev !== data.data.qr_code) {
                            // Reset expiry on new QR
                            setQrExpiry(60);
                            return data.data.qr_code;
                        }
                        return prev;
                    });
                    setQrLoading(false);
                }
            } catch (error) {
                console.error('Failed to fetch QR:', error);
            }
        };

        // Initial fetch
        fetchQR();

        // Poll every 3 seconds for updates (QR rotates every ~20s)
        const pollInterval = setInterval(fetchQR, 3000);

        return () => {
            isSubscribed = false;
            clearInterval(pollInterval);
        };
    }, [showQRModal, qrSession?.session_id, qrExpired]);

    // QR expiry countdown
    React.useEffect(() => {
        if (!showQRModal || qrExpired) return;

        const interval = setInterval(() => {
            setQrExpiry(prev => {
                if (prev <= 1) {
                    setQrExpired(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [showQRModal, qrExpired]);

    // Navbar variant
    if (variant === 'navbar') {
        return (
            <>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            className={`flex items-center gap-2 px-3 py-2 h-auto backdrop-blur-sm bg-white/60 hover:bg-white/80 border border-white/50 transition-all ${className}`}
                        >
                            <Smartphone className="h-4 w-4 text-blue-600" />

                            {activeSession ? (
                                <>
                                    <div className="flex flex-col items-start">
                                        <span className="font-medium text-sm">{activeSession.session_name}</span>
                                        {activeSession.phone_number && (
                                            <span className="text-xs text-gray-500">{activeSession.phone_number}</span>
                                        )}
                                    </div>
                                    {getStatusBadge(activeSession.status)}
                                </>
                            ) : (
                                <span className="text-sm text-gray-600">Select Session</span>
                            )}

                            <ChevronDown className="h-4 w-4 text-gray-500" />
                        </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end" className="w-80 backdrop-blur-xl bg-white/90 border-white/50">
                        <DropdownMenuLabel className="flex items-center justify-between">
                            <span className="text-xs text-gray-500 uppercase">
                                WhatsApp Sessions ({sessions.length}/{maxSessions})
                            </span>
                            {isLimitReached && (
                                <Badge variant="outline" className="text-[10px] text-red-600 border-red-200 bg-red-50">
                                    Limit Reached
                                </Badge>
                            )}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />

                        {loading ? (
                            <div className="p-4 text-center text-sm text-gray-500">
                                Loading sessions...
                            </div>
                        ) : sessions.length === 0 ? (
                            <div className="p-4 text-center">
                                <p className="text-sm text-gray-600 mb-2">No sessions yet</p>
                                {showCreateButton && onCreateClick && (
                                    <Button onClick={onCreateClick} size="sm" className="w-full">
                                        <Plus className="h-4 w-4 mr-2" />
                                        Create First Session
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="max-h-64 overflow-y-auto">
                                    {sessions.map((session) => (
                                        <DropdownMenuItem
                                            key={session.session_id}
                                            onClick={() => handleSelectSession(session)}
                                            className={`flex items-center justify-between p-3 cursor-pointer ${activeSession?.session_id === session.session_id
                                                ? 'bg-blue-50 border-l-2 border-l-blue-500'
                                                : ''
                                                }`}
                                        >
                                            <div className="flex items-center gap-3 flex-1">
                                                {getStatusIcon(session.status)}

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-medium text-sm truncate">
                                                            {session.session_name}
                                                        </p>
                                                        {activeSession?.session_id === session.session_id && (
                                                            <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-500/20 text-xs">
                                                                Active
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-gray-500 truncate">
                                                        {session.phone_number || 'Not connected'}
                                                    </p>
                                                </div>

                                                {getStatusBadge(session.status)}
                                            </div>

                                            {/* Quick actions */}
                                            <div className="flex items-center gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                                                {session.status === 'connected' ? (
                                                    <>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 w-7 p-0"
                                                            onClick={(e) => handleDisconnect(e, session.session_id)}
                                                            disabled={actionLoading === session.session_id}
                                                            title="Disconnect"
                                                        >
                                                            <PowerOff className="h-3.5 w-3.5 text-red-600" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 w-7 p-0"
                                                            onClick={(e) => handleDelete(e, session)}
                                                            disabled={actionLoading === session.session_id}
                                                            title="Delete Session"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5 text-gray-600" />
                                                        </Button>
                                                    </>
                                                ) : session.status === 'qr_ready' ? (
                                                    <>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 w-7 p-0"
                                                            onClick={(e) => handleShowQR(e, session)}
                                                            disabled={actionLoading === session.session_id}
                                                            title="Scan QR Code"
                                                        >
                                                            <QrCode className="h-3.5 w-3.5 text-orange-600" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 w-7 p-0"
                                                            onClick={(e) => handleDelete(e, session)}
                                                            disabled={actionLoading === session.session_id}
                                                            title="Delete Session"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5 text-gray-600" />
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 w-7 p-0"
                                                            onClick={(e) => handleConnect(e, session.session_id)}
                                                            disabled={actionLoading === session.session_id}
                                                            title="Connect"
                                                        >
                                                            <Power className="h-3.5 w-3.5 text-green-600" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 w-7 p-0"
                                                            onClick={(e) => handleDelete(e, session)}
                                                            disabled={actionLoading === session.session_id}
                                                            title="Delete Session"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5 text-gray-600" />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </DropdownMenuItem>
                                    ))}
                                </div>

                                {showCreateButton && onCreateClick && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem 
                                            onClick={onCreateClick} 
                                            className="p-3"
                                            disabled={isLimitReached}
                                        >
                                            <Plus className="h-4 w-4 mr-2 text-blue-600" />
                                            <span className="text-sm font-medium text-blue-600">
                                                {isLimitReached ? `Limit Reached (${maxSessions}/${maxSessions})` : 'Create New Session'}
                                            </span>
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* QR Code Modal */}
                <Dialog open={showQRModal} onOpenChange={setShowQRModal}>
                    <DialogContent className="backdrop-blur-xl bg-white/90 border-white/50 max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <QrCode className="h-5 w-5 text-blue-600" />
                                Scan QR Code
                            </DialogTitle>
                            <DialogDescription>
                                {qrSession?.session_name || 'Session'}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="py-6">
                            {qrLoading ? (
                                <div className="flex flex-col items-center justify-center h-64 gap-4">
                                    <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
                                    <p className="text-sm text-gray-500">Generating secure QR code...</p>
                                </div>
                            ) : qrExpired ? (
                                <div className="flex flex-col items-center justify-center py-8">
                                    <div className="bg-red-50 p-4 rounded-full mb-4">
                                        <AlertCircle className="h-10 w-10 text-red-500" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">QR Code Expired</h3>
                                    <p className="text-center text-sm text-gray-600 mb-6 px-4">
                                        For security reasons, the QR code has expired. Please refresh to generate a new one.
                                    </p>
                                    <Button onClick={handleRefreshQR} className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2">
                                        <RefreshCw className="h-4 w-4" />
                                        Refresh QR Code
                                    </Button>
                                </div>
                            ) : qrCodeString ? (
                                <>
                                    <div className="bg-white p-6 rounded-lg shadow-inner flex items-center justify-center">
                                        <QRCodeSVG value={qrCodeString} size={256} level="H" />
                                    </div>

                                    <div className="mt-4 text-center">
                                        <p className="text-sm text-gray-600 mb-2">
                                            Open WhatsApp → Settings → Linked Devices → Link a Device
                                        </p>
                                        <div className="flex items-center justify-center gap-2">
                                            <Clock className="h-4 w-4 text-gray-500" />
                                            <p className="text-xs text-gray-500">
                                                Expires in {qrExpiry}s
                                            </p>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-12">
                                    <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                    <p className="text-gray-600">QR code not available yet</p>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            </>
        );
    }

    // Compact variant (for inline use)
    if (variant === 'compact') {
        return (
            <div className={`flex items-center gap-2 ${className}`}>
                {activeSession ? (
                    <>
                        {getStatusIcon(activeSession.status)}
                        <span className="text-sm font-medium">{activeSession.session_name}</span>
                        {getStatusBadge(activeSession.status)}
                    </>
                ) : (
                    <span className="text-sm text-gray-500">No session selected</span>
                )}
            </div>
        );
    }

    // Default dropdown variant
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className={className}>
                    <Smartphone className="h-4 w-4 mr-2" />
                    {activeSession ? activeSession.session_name : 'Select Session'}
                    <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-64">
                {sessions.map((session) => (
                    <DropdownMenuItem
                        key={session.session_id}
                        onClick={() => handleSelectSession(session)}
                    >
                        <div className="flex items-center gap-2 w-full">
                            {getStatusIcon(session.status)}
                            <span className="flex-1">{session.session_name}</span>
                            {getStatusBadge(session.status)}
                        </div>
                    </DropdownMenuItem>
                ))}

                {showCreateButton && onCreateClick && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={onCreateClick}>
                            <Plus className="h-4 w-4 mr-2" />
                            Create New Session
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export default SessionSelector;
