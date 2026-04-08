import React, { useEffect, useState } from 'react';
import { useSession, Session } from '@/contexts/SessionContext';
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { CheckCircle, Circle, AlertCircle, Star, Clock, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const QuickSessionSwitcher: React.FC = () => {
    const [open, setOpen] = useState(false);
    const { sessions, activeSession, setActiveSession } = useSession();
    const [favorites, setFavorites] = useState<string[]>([]);
    const [recentSessions, setRecentSessions] = useState<string[]>([]);

    // Load favorites and recent from localStorage
    useEffect(() => {
        const savedFavorites = localStorage.getItem('session_favorites');
        if (savedFavorites) {
            setFavorites(JSON.parse(savedFavorites));
        }

        const savedRecent = localStorage.getItem('session_recent');
        if (savedRecent) {
            setRecentSessions(JSON.parse(savedRecent));
        }
    }, []);

    // Keyboard shortcut
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };

        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    // Track recent sessions
    const handleSelectSession = (session: Session) => {
        setActiveSession(session);

        // Update recent sessions
        const updated = [
            session.session_id,
            ...recentSessions.filter(id => id !== session.session_id)
        ].slice(0, 5);

        setRecentSessions(updated);
        localStorage.setItem('session_recent', JSON.stringify(updated));

        setOpen(false);
    };

    // Toggle favorite
    const toggleFavorite = (sessionId: string, e: React.MouseEvent) => {
        e.stopPropagation();

        const updated = favorites.includes(sessionId)
            ? favorites.filter(id => id !== sessionId)
            : [...favorites, sessionId];

        setFavorites(updated);
        localStorage.setItem('session_favorites', JSON.stringify(updated));
    };

    const getStatusConfig = (status: string) => {
        const configs = {
            connected: { icon: CheckCircle, color: 'text-green-600', label: 'Connected' },
            qr_ready: { icon: Circle, color: 'text-yellow-600', label: 'QR Ready' },
            connecting: { icon: Clock, color: 'text-blue-600', label: 'Connecting' },
            disconnected: { icon: AlertCircle, color: 'text-red-600', label: 'Disconnected' },
            created: { icon: Circle, color: 'text-gray-600', label: 'Created' }
        };
        return configs[status as keyof typeof configs] || configs.created;
    };

    // Group sessions
    const favoriteSessions = sessions.filter(s => favorites.includes(s.session_id));
    const recentSessionList = recentSessions
        .map(id => sessions.find(s => s.session_id === id))
        .filter(Boolean) as Session[];
    const otherSessions = sessions.filter(
        s => !favorites.includes(s.session_id) && !recentSessions.includes(s.session_id)
    );

    return (
        <>
            <CommandDialog open={open} onOpenChange={setOpen}>
                <CommandInput placeholder="Search sessions..." />
                <CommandList>
                    <CommandEmpty>
                        <div className="py-6 text-center">
                            <Search className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                            <p className="text-sm text-gray-500">No sessions found</p>
                        </div>
                    </CommandEmpty>

                    {/* Favorites */}
                    {favoriteSessions.length > 0 && (
                        <CommandGroup heading="⭐ Favorites">
                            {favoriteSessions.map((session) => {
                                const statusConfig = getStatusConfig(session.status);
                                const StatusIcon = statusConfig.icon;
                                const isActive = activeSession?.session_id === session.session_id;

                                return (
                                    <CommandItem
                                        key={session.session_id}
                                        onSelect={() => handleSelectSession(session)}
                                        className="flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-3 flex-1">
                                            <StatusIcon className={`h-4 w-4 ${statusConfig.color}`} />
                                            <div className="flex-1">
                                                <div className="font-medium">{session.session_name}</div>
                                                {session.phone_number && (
                                                    <div className="text-xs text-gray-500">{session.phone_number}</div>
                                                )}
                                            </div>
                                            {isActive && (
                                                <Badge variant="outline" className="text-xs">Active</Badge>
                                            )}
                                        </div>
                                        <button
                                            onClick={(e) => toggleFavorite(session.session_id, e)}
                                            className="ml-2 text-yellow-500 hover:text-yellow-600"
                                        >
                                            <Star className="h-4 w-4 fill-current" />
                                        </button>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    )}

                    {/* Recent */}
                    {recentSessionList.length > 0 && (
                        <CommandGroup heading="🕒 Recent">
                            {recentSessionList.map((session) => {
                                const statusConfig = getStatusConfig(session.status);
                                const StatusIcon = statusConfig.icon;
                                const isActive = activeSession?.session_id === session.session_id;
                                const isFavorite = favorites.includes(session.session_id);

                                return (
                                    <CommandItem
                                        key={session.session_id}
                                        onSelect={() => handleSelectSession(session)}
                                        className="flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-3 flex-1">
                                            <StatusIcon className={`h-4 w-4 ${statusConfig.color}`} />
                                            <div className="flex-1">
                                                <div className="font-medium">{session.session_name}</div>
                                                {session.phone_number && (
                                                    <div className="text-xs text-gray-500">{session.phone_number}</div>
                                                )}
                                            </div>
                                            {isActive && (
                                                <Badge variant="outline" className="text-xs">Active</Badge>
                                            )}
                                        </div>
                                        <button
                                            onClick={(e) => toggleFavorite(session.session_id, e)}
                                            className={`ml-2 hover:text-yellow-600 ${isFavorite ? 'text-yellow-500' : 'text-gray-300'
                                                }`}
                                        >
                                            <Star className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
                                        </button>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    )}

                    {/* All Sessions */}
                    {otherSessions.length > 0 && (
                        <CommandGroup heading="All Sessions">
                            {otherSessions.map((session) => {
                                const statusConfig = getStatusConfig(session.status);
                                const StatusIcon = statusConfig.icon;
                                const isActive = activeSession?.session_id === session.session_id;
                                const isFavorite = favorites.includes(session.session_id);

                                return (
                                    <CommandItem
                                        key={session.session_id}
                                        onSelect={() => handleSelectSession(session)}
                                        className="flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-3 flex-1">
                                            <StatusIcon className={`h-4 w-4 ${statusConfig.color}`} />
                                            <div className="flex-1">
                                                <div className="font-medium">{session.session_name}</div>
                                                {session.phone_number && (
                                                    <div className="text-xs text-gray-500">{session.phone_number}</div>
                                                )}
                                            </div>
                                            {isActive && (
                                                <Badge variant="outline" className="text-xs">Active</Badge>
                                            )}
                                        </div>
                                        <button
                                            onClick={(e) => toggleFavorite(session.session_id, e)}
                                            className={`ml-2 hover:text-yellow-600 ${isFavorite ? 'text-yellow-500' : 'text-gray-300'
                                                }`}
                                        >
                                            <Star className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
                                        </button>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    )}
                </CommandList>

                <div className="border-t p-2 text-center">
                    <p className="text-xs text-gray-500">
                        Press <kbd className="px-2 py-1 bg-gray-100 rounded border text-[10px]">Ctrl+K</kbd> or{' '}
                        <kbd className="px-2 py-1 bg-gray-100 rounded border text-[10px]">⌘K</kbd> to toggle
                    </p>
                </div>
            </CommandDialog>
        </>
    );
};

export default QuickSessionSwitcher;
