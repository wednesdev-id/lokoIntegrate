import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import axios from 'axios';

// Session interface
export interface Session {
    id: number;
    session_id: string;
    session_code?: string;
    session_name: string;
    phone_number?: string;
    status: 'created' | 'qr_ready' | 'connecting' | 'connected' | 'disconnected';
    qr_code?: string;
    last_connected?: string;
    ai_auto_reply?: boolean;
    ai_prompt?: string;
    created_at: string;
    updated_at: string;
}

// Context interface
interface SessionContextType {
    // Current active session
    activeSession: Session | null;
    setActiveSession: (session: Session | null) => void;

    // All available sessions
    sessions: Session[];
    refreshSessions: () => Promise<void>;

    // Session operations
    createSession: (name: string) => Promise<Session>;
    deleteSession: (sessionId: string) => Promise<void>;
    connectSession: (sessionId: string) => Promise<void>;
    disconnectSession: (sessionId: string) => Promise<void>;

    // Loading states
    loading: boolean;
    error: string | null;
}

// Create context
const SessionContext = createContext<SessionContextType | undefined>(undefined);

// Provider props
interface SessionProviderProps {
    children: ReactNode;
}

const STORAGE_KEY = 'loko_active_session_id';


// Provider component
export const SessionProvider: React.FC<SessionProviderProps> = ({ children }) => {
    const [activeSession, setActiveSessionState] = useState<Session | null>(null);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Load sessions from API
    const loadSessions = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await axios.get('/api/whatsapp/v1/sessions');
            // API returns: { success, message, data: { sessions: [...], total: N } }
            const rawData = response.data?.data?.sessions || response.data?.data;
            const sessionList = Array.isArray(rawData) ? rawData : [];

            console.log('[SessionContext] Loaded sessions:', sessionList.length, sessionList.map(s => s.session_id));
            setSessions(sessionList);

            // Active Session Resolution Logic:
            // 1. Check local storage
            // 2. Check if the currently selected one still exists
            // 3. Auto-select first connected session
            // 4. Fallback to first session

            let selectedSession: Session | null = null;
            const savedId = localStorage.getItem(STORAGE_KEY);

            if (activeSession && sessionList.find(s => s.session_id === activeSession.session_id)) {
                // Keep the current one if it's still in the list
                selectedSession = activeSession;
            } else if (savedId) {
                const savedSession = sessionList.find(s => s.session_id === savedId);
                if (savedSession) {
                    selectedSession = savedSession;
                }
            }

            if (!selectedSession && sessionList.length > 0) {
                const connectedSession = sessionList.find((s: Session) => s.status === 'connected');
                if (connectedSession) {
                    console.log('[SessionContext] Auto-selecting connected session:', connectedSession.session_name);
                    selectedSession = connectedSession;
                } else {
                    console.log('[SessionContext] Auto-selecting first session:', sessionList[0].session_name);
                    selectedSession = sessionList[0];
                }
            }

            if (selectedSession) {
                setActiveSessionState(selectedSession);
                localStorage.setItem(STORAGE_KEY, selectedSession.session_id);
            } else {
                setActiveSessionState(null);
                localStorage.removeItem(STORAGE_KEY);
            }

        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load sessions');
            console.error('Load sessions error:', err);
        } finally {
            setLoading(false);
        }
    }, []); // Remove activeSession dependency to prevent infinite loop

    // Refresh sessions
    const refreshSessions = useCallback(async () => {
        await loadSessions();
    }, [loadSessions]);

    // Create new session
    const createSession = useCallback(async (name: string): Promise<Session> => {
        try {
            setError(null);

            const response = await axios.post('/api/whatsapp/v1/sessions', {
                session_name: name
            });

            const newSession = response.data.data;

            // Refresh session list
            await refreshSessions();

            // Auto-select new session 
            setActiveSessionState(newSession);
            localStorage.setItem(STORAGE_KEY, newSession.session_id);

            return newSession;

        } catch (err: any) {
            const errorMsg = err.response?.data?.message || 'Failed to create session';
            setError(errorMsg);
            throw new Error(errorMsg);
        }
    }, [sessions.length, refreshSessions]);

    // Delete session
    const deleteSession = useCallback(async (sessionId: string): Promise<void> => {
        try {
            setError(null);

            await axios.delete(`/api/whatsapp/v1/sessions/${sessionId}`);

            // If deleting active session, clear it locally
            if (activeSession?.session_id === sessionId) {
                setActiveSessionState(null);
                localStorage.removeItem(STORAGE_KEY);
            }

            // Refresh session list
            await refreshSessions();

        } catch (err: any) {
            const errorMsg = err.response?.data?.message || 'Failed to delete session';
            setError(errorMsg);
            throw new Error(errorMsg);
        }
    }, [activeSession, refreshSessions]);

    // Connect session
    const connectSession = useCallback(async (sessionId: string): Promise<void> => {
        try {
            setError(null);

            const response = await axios.post(`/api/whatsapp/v1/sessions/${sessionId}/connect`);

            // If connection requires QR, auto-select it so the user sees proper chat feedback once scanned
            if (response.data?.status === 'qr_ready' || response.data?.status === 'connected') {
                const connectedSession = sessions.find(s => s.session_id === sessionId);
                if (connectedSession) {
                    setActiveSessionState(connectedSession);
                    localStorage.setItem(STORAGE_KEY, sessionId);
                }
            }

            // Refresh to get QR code
            await refreshSessions();

        } catch (err: any) {
            // If 404, session was deleted - refresh list to sync
            if (err.response?.status === 404) {
                await refreshSessions();
            }
            const errorMsg = err.response?.data?.message || 'Failed to connect session';
            setError(errorMsg);
            throw new Error(errorMsg);
        }
    }, [sessions, refreshSessions]);

    // Disconnect session
    const disconnectSession = useCallback(async (sessionId: string): Promise<void> => {
        try {
            setError(null);

            await axios.post(`/api/whatsapp/v1/sessions/${sessionId}/disconnect`);

            // Refresh session list
            await refreshSessions();

        } catch (err: any) {
            // If 404, session was deleted - refresh list to sync
            if (err.response?.status === 404) {
                await refreshSessions();
            }
            const errorMsg = err.response?.data?.message || 'Failed to disconnect session';
            setError(errorMsg);
            throw new Error(errorMsg);
        }
    }, [refreshSessions]);

    // Custom setActiveSession with persistence
    const setActiveSession = useCallback((session: Session | null) => {
        console.log('[SessionContext] Manual session set to:', session?.session_name);
        setActiveSessionState(session);
        if (session) {
            localStorage.setItem(STORAGE_KEY, session.session_id);
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    }, []);

    // Load sessions on mount
    useEffect(() => {
        loadSessions();
    }, [loadSessions]);

    // Restore active session from localStorage after sessions load
    // DISABLED - This is now handled in loadSessions() to prevent infinite loop
    // useEffect(() => {
    //     if (sessions.length > 0 && !activeSession) {
    //         const savedId = localStorage.getItem(STORAGE_KEY);
    //         if (savedId) {
    //             const savedSession = sessions.find(s => s.session_id === savedId);
    //             if (savedSession) {
    //                 setActiveSessionState(savedSession);
    //             }
    //         }
    //     }
    // }, [sessions, activeSession]);

    // Poll session status every 30 seconds
    // DISABLED - User will manually refresh instead
    // useEffect(() => {
    //     const interval = setInterval(() => {
    //         refreshSessions();
    //     }, 30000); // 30 seconds

    //     return () => clearInterval(interval);
    // }, [refreshSessions]);

    const value: SessionContextType = {
        activeSession,
        setActiveSession,
        sessions,
        refreshSessions,
        createSession,
        deleteSession,
        connectSession,
        disconnectSession,
        loading,
        error
    };

    return (
        <SessionContext.Provider value={value}>
            {children}
        </SessionContext.Provider>
    );
};

// Custom hook to use session context
export const useSession = (): SessionContextType => {
    const context = useContext(SessionContext);

    if (context === undefined) {
        throw new Error('useSession must be used within a SessionProvider');
    }

    return context;
};

// Export context for testing
export { SessionContext };
