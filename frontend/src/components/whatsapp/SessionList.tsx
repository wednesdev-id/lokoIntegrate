import React, { useState, useEffect } from 'react';
import {
    Plus,
    QrCode,
    Trash2,
    Power,
    PowerOff,
    RefreshCw,
    Sparkles,
    CheckCircle,
    XCircle,
    AlertCircle,
    Clock,
    Smartphone
} from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';

const SessionList: React.FC = () => {
    const {
        sessions,
        activeSession,
        setActiveSession,
        refreshSessions,
        connectSession,
        disconnectSession,
        deleteSession,
        loading
    } = useSession();

    useUser();
    const [showQRModal, setShowQRModal] = useState(false);
    const [qrSession, setQrSession] = useState<any>(null);
    const [qrCodeString, setQrCodeString] = useState('');
    const [qrLoading, setQrLoading] = useState(false);
    const [qrExpiry, setQrExpiry] = useState(60);

    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // QR expiry countdown
    useEffect(() => {
        if (!showQRModal || qrExpiry <= 0) return;

        const interval = setInterval(() => {
            setQrExpiry(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [showQRModal, qrExpiry]);

    // Poll session status while QR modal is open
    useEffect(() => {
        if (!showQRModal || !qrSession) return;

        const interval = setInterval(async () => {
            try {
                // Fetch the latest session status to see if it's connected
                const response = await axios.get(`/api/whatsapp/v1/sessions/${qrSession.session_id}`);
                const sessionData = response.data?.data;

                if (sessionData && sessionData.status === 'connected') {
                    // It's connected! Close the modal and refresh the list
                    setShowQRModal(false);
                    refreshSessions();
                }
            } catch (error) {
                console.error('Failed to poll session status:', error);
            }
        }, 3000); // Check every 3 seconds

        return () => clearInterval(interval);
    }, [showQRModal, qrSession, refreshSessions]);

    // Status configuration
    const getStatusConfig = (status: string) => {
        const configs = {
            connected: {
                icon: CheckCircle,
                color: 'text-green-600',
                bgColor: 'bg-green-500/10',
                borderColor: 'border-green-500/20',
                textColor: 'text-green-700',
                glowClass: 'shadow-lg shadow-green-500/30',
                label: 'Connected'
            },
            qr_ready: {
                icon: QrCode,
                color: 'text-yellow-600',
                bgColor: 'bg-yellow-500/10',
                borderColor: 'border-yellow-500/20',
                textColor: 'text-yellow-700',
                glowClass: 'shadow-lg shadow-yellow-500/30',
                label: 'QR Ready'
            },
            connecting: {
                icon: Clock,
                color: 'text-blue-600',
                bgColor: 'bg-blue-500/10',
                borderColor: 'border-blue-500/20',
                textColor: 'text-blue-700',
                glowClass: 'shadow-lg shadow-blue-500/30',
                label: 'Connecting'
            },
            disconnected: {
                icon: XCircle,
                color: 'text-red-600',
                bgColor: 'bg-red-500/10',
                borderColor: 'border-red-500/20',
                textColor: 'text-red-700',
                glowClass: '',
                label: 'Disconnected'
            },
            created: {
                icon: AlertCircle,
                color: 'text-gray-600',
                bgColor: 'bg-gray-500/10',
                borderColor: 'border-gray-500/20',
                textColor: 'text-gray-700',
                glowClass: '',
                label: 'Created'
            }
        };

        return configs[status as keyof typeof configs] || configs.created;
    };

    // Handle show QR with retry logic
    const handleShowQR = async (session: any) => {
        setQrSession(session);
        setQrCodeString('');
        setQrLoading(true);
        setQrExpiry(60);
        setShowQRModal(true);

        let retryCount = 0;
        const maxRetries = 8;

        const fetchQR = async (): Promise<boolean> => {
            try {
                const response = await axios.get(`/api/whatsapp/v1/sessions/${session.session_id}/qr`);

                if (response.data.success && response.data.data?.qr_code) {
                    setQrCodeString(response.data.data.qr_code);
                    setQrLoading(false);
                    return true;
                }
                return false;
            } catch (error) {
                console.error('Failed to get QR code:', error);
                return false;
            }
        };

        const pollQR = async () => {
            const success = await fetchQR();

            if (!success && retryCount < maxRetries) {
                retryCount++;
                const delay = 500 + (retryCount * 500);
                setTimeout(pollQR, delay);
            } else if (!success) {
                setQrLoading(false);
                setQrCodeString('');
            }
        };

        pollQR();
    };

    // Handle refresh QR
    const handleRefreshQR = () => {
        if (qrSession) {
            handleShowQR(qrSession);
        }
    };

    // Handle connect
    const handleConnect = async (sessionId: string) => {
        setActionLoading(sessionId);
        try {
            await connectSession(sessionId);

            // Wait for session status to update and QR to be generated
            // The backend generates QR asynchronously, so we need to wait
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Refresh sessions to get latest status
            await refreshSessions();

            // Now show QR
            const session = sessions.find(s => s.session_id === sessionId);
            if (session && session.status === 'qr_ready') {
                handleShowQR(session);
            }
        } catch (error) {
            console.error('Connect error:', error);
        } finally {
            setActionLoading(null);
        }
    };

    // Handle disconnect
    const handleDisconnect = async (sessionId: string) => {
        setActionLoading(sessionId);
        try {
            await disconnectSession(sessionId);
        } catch (error) {
            console.error('Disconnect error:', error);
        } finally {
            setActionLoading(null);
        }
    };

    // Handle delete
    const handleDeleteClick = (sessionId: string) => {
        setSessionToDelete(sessionId);
        setShowDeleteDialog(true);
    };

    const confirmDelete = async () => {
        if (!sessionToDelete) return;

        setActionLoading(sessionToDelete);
        try {
            await deleteSession(sessionToDelete);
            setShowDeleteDialog(false);
            setSessionToDelete(null);
        } catch (error) {
            console.error('Delete error:', error);
        } finally {
            setActionLoading(null);
        }
    };

    // Handle set active
    const handleSetActive = (session: any) => {
        setActiveSession(session);
    };

    if (loading) {
        return (
            <Card className="backdrop-blur-xl bg-white/70 border-white/50">
                <CardContent className="p-12">
                    <div className="text-center">
                        <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                        <p className="text-gray-600">Loading sessions...</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (sessions.length === 0) {
        return (
            <Card className="backdrop-blur-xl bg-white/70 border-white/50">
                <CardContent className="p-12">
                    <div className="text-center">
                        <div className="mb-4 relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full blur-xl opacity-20"></div>
                            <div className="relative bg-gradient-to-r from-blue-500 to-indigo-600 w-16 h-16 rounded-full mx-auto flex items-center justify-center">
                                <Smartphone className="h-8 w-8 text-white" />
                            </div>
                        </div>
                        <h3 className="text-xl font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                            No WhatsApp Sessions Yet
                        </h3>
                        <p className="text-gray-600 mb-6">
                            Create your first WhatsApp session to start managing messages
                        </p>
                        <Button
                            onClick={() => {/* Will be handled by parent */ }}
                            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Create First Session
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Sparkles className="h-6 w-6 text-blue-600" />
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        WhatsApp Sessions
                    </h2>
                </div>

                <Button
                    onClick={refreshSessions}
                    variant="outline"
                    className="backdrop-blur-sm bg-white/60 hover:bg-white/80 border-white/50"
                >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </div>

            {/* Sessions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sessions.map((session) => {
                    const statusConfig = getStatusConfig(session.status);
                    const StatusIcon = statusConfig.icon;
                    const isActive = activeSession?.session_id === session.session_id;

                    return (
                        <Card
                            key={session.session_id}
                            className={`
                backdrop-blur-xl bg-white/70 border-white/50 
                transition-all duration-300 hover:scale-105
                ${isActive ? 'ring-2 ring-blue-500 shadow-xl shadow-blue-500/20' : 'shadow-xl hover:shadow-2xl'}
                ${session.status === 'connected' ? statusConfig.glowClass : ''}
              `}
                        >
                            <CardContent className="p-5">
                                {/* Header */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className={`${statusConfig.color}`}>
                                            <StatusIcon className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-gray-900 truncate">
                                                {session.session_name}
                                            </h3>
                                            {session.phone_number && (
                                                <p className="text-sm text-gray-500 truncate">
                                                    {session.phone_number}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Connection Status Indicator */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        {session.status === 'connected' ? (
                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-green-100 rounded-full">
                                                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                                <span className="text-xs font-medium text-green-700">Connected</span>
                                            </div>
                                        ) : session.status === 'qr_ready' ? (
                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-orange-100 rounded-full">
                                                <Clock className="h-3 w-3 text-orange-600" />
                                                <span className="text-xs font-medium text-orange-700">Waiting Scan</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded-full">
                                                <AlertCircle className="h-3 w-3 text-gray-600" />
                                                <span className="text-xs font-medium text-gray-700">Not Connected</span>
                                            </div>
                                        )}

                                        {isActive && (
                                            <Badge className="bg-blue-500/10 text-blue-700 border-blue-500/20">
                                                Active
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                                {/* Status Badge */}
                                <div className="mb-4">
                                    <Badge
                                        variant="outline"
                                        className={`${statusConfig.bgColor} ${statusConfig.textColor} ${statusConfig.borderColor} w-full justify-center`}
                                    >
                                        <StatusIcon className="h-3 w-3 mr-1.5" />
                                        {statusConfig.label}
                                    </Badge>
                                </div>

                                {/* Info */}
                                {session.last_connected && (
                                    <div className="bg-white/50 backdrop-blur-sm rounded-lg p-3 mb-4 border border-white/50">
                                        <p className="text-xs text-gray-600">
                                            Last connected: {new Date(session.last_connected).toLocaleString()}
                                        </p>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex flex-col gap-2">
                                    {/* Primary Action - Single Prominent Button */}
                                    {session.status === 'connected' ? (
                                        // Connected: Show success card
                                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
                                            <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-green-900">WhatsApp Connected</p>
                                                {session.phone_number && (
                                                    <p className="text-xs text-green-700 truncate">{session.phone_number}</p>
                                                )}
                                            </div>
                                        </div>
                                    ) : session.status === 'qr_ready' ? (
                                        // QR Ready: Big Scan QR button
                                        <Button
                                            onClick={() => handleShowQR(session)}
                                            className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg h-12"
                                        >
                                            <QrCode className="h-5 w-5 mr-2" />
                                            Scan QR Code to Connect
                                        </Button>
                                    ) : (
                                        // Not connected: Connect button
                                        <Button
                                            onClick={() => handleConnect(session.session_id)}
                                            disabled={actionLoading === session.session_id}
                                            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg h-12"
                                        >
                                            {actionLoading === session.session_id ? (
                                                <>
                                                    <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                                                    Generating QR...
                                                </>
                                            ) : (
                                                <>
                                                    <Power className="h-5 w-5 mr-2" />
                                                    Connect WhatsApp
                                                </>
                                            )}
                                        </Button>
                                    )}

                                    {/* Set Active Button */}
                                    {!isActive && session.status === 'connected' && (
                                        <Button
                                            onClick={() => handleSetActive(session)}
                                            variant="outline"
                                            size="sm"
                                            className="w-full bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700"
                                        >
                                            Set as Active
                                        </Button>
                                    )}

                                    {/* Secondary Actions */}
                                    <div className="flex gap-2">
                                        {session.status === 'connected' && (
                                            <>
                                                <Button
                                                    onClick={() => handleDisconnect(session.session_id)}
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={actionLoading === session.session_id}
                                                    className="flex-1 text-gray-600 hover:bg-red-50 hover:text-red-700"
                                                >
                                                    <PowerOff className="h-3.5 w-3.5 mr-1" />
                                                    Disconnect
                                                </Button>
                                                <Button
                                                    onClick={() => handleDeleteClick(session.session_id)}
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={actionLoading === session.session_id}
                                                    className="flex-1 text-red-600 hover:bg-red-50"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                                                    Delete
                                                </Button>
                                            </>
                                        )}

                                        {(session.status === 'qr_ready' || session.status === 'created') && (
                                            <Button
                                                onClick={() => handleDeleteClick(session.session_id)}
                                                variant="outline"
                                                size="sm"
                                                disabled={actionLoading === session.session_id}
                                                className="w-full text-gray-600 hover:bg-red-50 hover:text-red-700"
                                            >
                                                <Trash2 className="h-3.5 w-3.5 mr-1" />
                                                Cancel & Delete
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

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
                            <div className="flex items-center justify-center h-64">
                                <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
                            </div>
                        ) : qrCodeString ? (
                            <>
                                <div className="bg-white p-6 rounded-lg shadow-inner flex items-center justify-center">
                                    <QRCodeSVG value={qrCodeString} size={256} level="H" />
                                </div>

                                <div className="mt-4 text-center">
                                    <p className="text-sm text-gray-600 mb-2">
                                        Open WhatsApp on your phone → Settings → Linked Devices → Link a Device
                                    </p>
                                    <div className="flex items-center justify-center gap-2">
                                        <Clock className="h-4 w-4 text-gray-500" />
                                        <p className="text-xs text-gray-500">
                                            Expires in {qrExpiry}s
                                        </p>
                                    </div>
                                </div>

                                {qrExpiry === 0 && (
                                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                        <p className="text-sm text-yellow-700">QR code expired. Click refresh to generate a new one.</p>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-center py-12">
                                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-600">QR code not available yet</p>
                                <p className="text-sm text-gray-500 mt-2">The session may still be initializing</p>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="flex gap-2">
                        <Button
                            onClick={handleRefreshQR}
                            variant="outline"
                            disabled={qrLoading}
                        >
                            <RefreshCw className={`h-4 w-4 mr-2 ${qrLoading ? 'animate-spin' : ''}`} />
                            Refresh QR
                        </Button>
                        <Button
                            onClick={() => setShowQRModal(false)}
                            className="bg-gradient-to-r from-blue-500 to-indigo-600"
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent className="backdrop-blur-xl bg-white/90">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete WhatsApp Session?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the session and disconnect the device. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={actionLoading === sessionToDelete}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            disabled={actionLoading === sessionToDelete}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {actionLoading === sessionToDelete ? 'Deleting...' : 'Delete Session'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

export default SessionList;
