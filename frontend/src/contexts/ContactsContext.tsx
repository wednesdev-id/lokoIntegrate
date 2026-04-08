import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useSession } from './SessionContext';

interface ContactsContextType {
    contactMap: Map<string, string>;
    loadContacts: () => Promise<void>;
    getContactName: (jid: string | undefined | null) => string;
}

const ContactsContext = createContext<ContactsContextType | undefined>(undefined);

export function ContactsProvider({ children }: { children: React.ReactNode }) {
    const { activeSession } = useSession();
    const [contactMap, setContactMap] = useState<Map<string, string>>(new Map());

    const loadContacts = useCallback(async () => {
        if (!activeSession) return;
        try {
            const response = await axios.get(`/api/whatsapp/v1/sessions/${activeSession.session_id}/contacts`);
            if (response.data.success) {
                const contacts = response.data.data || [];
                const newMap = new Map<string, string>();
                contacts.forEach((c: any) => {
                    if (c.name) {
                        newMap.set(c.jid, c.name);
                    }
                });
                setContactMap(newMap);
                console.log('👥 ContactsContext: Loaded contact map with', newMap.size, 'entries');
            }
        } catch (error) {
            console.error('Failed to load contact map:', error);
        }
    }, [activeSession]);

    // Load contacts when active session changes
    useEffect(() => {
        if (activeSession) {
            loadContacts();
        } else {
            setContactMap(new Map());
        }
    }, [activeSession, loadContacts]);

    const getContactName = useCallback((jid: string | undefined | null): string => {
        if (!jid) return "";
        // 1. Try exact match
        if (contactMap.has(jid)) return contactMap.get(jid)!;

        // 2. Try partial match (phone number)
        const phone = jid.split('@')[0];
        if (contactMap.has(phone)) return contactMap.get(phone)!;

        // 3. Fallback to phone number formatting
        return phone || jid;
    }, [contactMap]);

    return (
        <ContactsContext.Provider value={{ contactMap, loadContacts, getContactName }}>
            {children}
        </ContactsContext.Provider>
    );
}

export function useContacts() {
    const context = useContext(ContactsContext);
    if (context === undefined) {
        throw new Error('useContacts must be used within a ContactsProvider');
    }
    return context;
}

// Helper hook for individual components
export function useContactName(jid: string | undefined | null) {
    const { getContactName, contactMap } = useContacts();
    // We include contactMap in dependency to trigger re-render when map updates
    return React.useMemo(() => getContactName(jid), [jid, getContactName, contactMap]);
}
