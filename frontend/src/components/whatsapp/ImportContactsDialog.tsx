import React, { useState, useMemo } from 'react';
import { Search, Users, Check, Phone, User } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSession } from '@/contexts/SessionContext';
import { useQuery } from '@tanstack/react-query';
import whatsappService from '@/services/whatsapp.service';

interface ImportContactsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (phoneNumbers: string[]) => void;
    existingRecipients?: string[];
}

export const ImportContactsDialog: React.FC<ImportContactsDialogProps> = ({
    open,
    onOpenChange,
    onImport,
    existingRecipients = [],
}) => {
    const { activeSession } = useSession();
    const [searchQuery, setSearchQuery] = useState('');
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const { data: contactsData, isLoading } = useQuery({
        queryKey: ['contacts', activeSession?.session_id],
        queryFn: async () => {
            if (!activeSession) return Promise.reject('No session');
            return whatsappService.getSessionContacts(activeSession.session_id);
        },
        enabled: !!activeSession && activeSession.status === 'connected' && open,
    });

    const contacts = useMemo(() => {
        const all = contactsData?.data || [];
        // Filter out @lid, @g.us, @broadcast
        return all.filter((c: any) => {
            const jid = c.jid || '';
            return (
                jid.includes('@s.whatsapp.net') &&
                !jid.includes('@g.us') &&
                !jid.includes('@broadcast') &&
                c.phone_number
            );
        });
    }, [contactsData]);

    const filtered = useMemo(() => {
        if (!searchQuery.trim()) return contacts;
        const q = searchQuery.toLowerCase();
        return contacts.filter(
            (c: any) =>
                (c.name?.toLowerCase() || '').includes(q) ||
                c.phone_number?.includes(q)
        );
    }, [contacts, searchQuery]);

    const toggleSelect = (phone: string) => {
        const next = new Set(selected);
        if (next.has(phone)) {
            next.delete(phone);
        } else {
            next.add(phone);
        }
        setSelected(next);
    };

    const toggleSelectAll = () => {
        if (selected.size === filtered.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(filtered.map((c: any) => c.phone_number)));
        }
    };

    const handleImport = () => {
        onImport(Array.from(selected));
        setSelected(new Set());
        setSearchQuery('');
        onOpenChange(false);
    };

    const handleClose = () => {
        setSelected(new Set());
        setSearchQuery('');
        onOpenChange(false);
    };

    const alreadyImported = (phone: string) => existingRecipients.includes(phone);

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden bg-white/95 backdrop-blur-xl border-white/40 shadow-2xl rounded-2xl">
                {/* Header */}
                <div className="p-6 pb-4 border-b border-gray-100 bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700">
                            <Users className="h-6 w-6 text-blue-600" />
                            Import Contacts
                        </DialogTitle>
                        <DialogDescription className="text-gray-500 pt-1">
                            Select contacts from your WhatsApp to add as broadcast recipients.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Search Bar */}
                    <div className="mt-5 relative group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-blue-500/50 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <Input
                            type="text"
                            placeholder="Search by name or number..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 h-12 bg-white/80 border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 text-base rounded-xl transition-all shadow-sm"
                            autoFocus
                        />
                    </div>
                </div>

                {/* List Header & Controls */}
                <div className="flex items-center justify-between px-6 py-3 bg-gray-50/80 border-b border-gray-100/50 text-sm">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={toggleSelectAll}
                            disabled={filtered.length === 0}
                            className={`flex items-center justify-center w-5 h-5 rounded border transition-colors ${selected.size === filtered.length && filtered.length > 0
                                    ? 'bg-blue-600 border-blue-600 text-white'
                                    : 'border-gray-300 hover:border-blue-500 bg-white'
                                }`}
                        >
                            {selected.size === filtered.length && filtered.length > 0 && <Check className="h-3.5 w-3.5" />}
                        </button>
                        <span className="font-medium text-gray-700">
                            {filtered.length} contact{filtered.length !== 1 ? 's' : ''} found
                        </span>
                    </div>
                    {selected.size > 0 && (
                        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-none font-semibold px-2.5 py-0.5">
                            {selected.size} selected
                        </Badge>
                    )}
                </div>

                {/* Scrollable List */}
                <div className="max-h-[50vh] min-h-[300px] overflow-y-auto bg-white/50 p-2">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full min-h-[250px] text-blue-600/50 space-y-3">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-current border-t-transparent" />
                            <p className="text-sm font-medium animate-pulse">Syncing contacts...</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full min-h-[250px] text-gray-400 space-y-3">
                            <div className="h-12 w-12 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100">
                                <Search className="h-5 w-5 text-gray-400" />
                            </div>
                            <p className="text-sm font-medium text-gray-500">No contacts matched your search.</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {filtered.map((contact: any) => {
                                const phone = contact.phone_number;
                                const name = contact.name || phone;
                                const isSelected = selected.has(phone);
                                const isDuplicate = alreadyImported(phone);

                                return (
                                    <div
                                        key={contact.jid || phone}
                                        onClick={() => !isDuplicate && toggleSelect(phone)}
                                        className={`group flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 border border-transparent ${isDuplicate
                                                ? 'opacity-40 grayscale cursor-not-allowed bg-gray-50/50'
                                                : isSelected
                                                    ? 'bg-blue-50/80 border-blue-100/50 shadow-sm'
                                                    : 'hover:bg-gray-50 hover:border-gray-100/50'
                                            }`}
                                    >
                                        {/* Fake Checkbox */}
                                        <div
                                            className={`flex-shrink-0 flex items-center justify-center w-5 h-5 rounded border transition-colors ${isSelected
                                                    ? 'bg-blue-600 border-blue-600 text-white'
                                                    : isDuplicate
                                                        ? 'bg-gray-200 border-gray-300'
                                                        : 'border-gray-300 group-hover:border-blue-400 bg-white'
                                                }`}
                                        >
                                            {isSelected && <Check className="h-3.5 w-3.5" />}
                                        </div>

                                        {/* Avatar */}
                                        <div className={`h-10 w-10 flex-shrink-0 rounded-full flex items-center justify-center text-sm font-bold shadow-sm transition-colors ${isSelected ? 'bg-blue-600 text-white' : 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600 group-hover:from-blue-100 group-hover:to-blue-50 group-hover:text-blue-700'
                                            }`}>
                                            {name && name !== phone ? name.substring(0, 2).toUpperCase() : <User className="h-4 w-4" />}
                                        </div>

                                        {/* Contact Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-semibold truncate transition-colors ${isSelected ? 'text-blue-900' : 'text-gray-900 group-hover:text-blue-900'}`}>
                                                {name}
                                            </p>
                                            <p className={`text-xs flex items-center gap-1.5 mt-0.5 transition-colors ${isSelected ? 'text-blue-600/80' : 'text-gray-500'}`}>
                                                <Phone className="h-3 w-3 opacity-70" />
                                                +{phone}
                                            </p>
                                        </div>

                                        {/* Status Badge */}
                                        {isDuplicate && (
                                            <Badge variant="outline" className="bg-white/50 text-[10px] text-gray-500 font-medium px-2 shrink-0">
                                                Added
                                            </Badge>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-gray-50/50">
                    <DialogFooter className="gap-3 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={handleClose}
                            className="h-11 px-6 rounded-xl hover:bg-gray-100 border-gray-200 text-gray-700 font-medium"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleImport}
                            disabled={selected.size === 0}
                            className="h-11 px-8 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg shadow-blue-600/20 disabled:shadow-none transition-all duration-200"
                        >
                            <Check className="h-4 w-4 mr-2" />
                            Import {selected.size || ''} Contact{selected.size !== 1 ? 's' : ''}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ImportContactsDialog;
