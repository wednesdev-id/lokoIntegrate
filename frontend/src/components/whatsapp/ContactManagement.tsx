import React, { useState, useEffect } from 'react';
import { UserCircle, Smartphone, AlertCircle, Search, RefreshCw, User, MessageCircle, Upload, FileText } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useQuery } from '@tanstack/react-query';
import whatsappService from '@/services/whatsapp.service';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNavigate } from 'react-router-dom';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface CSVContact {
    name: string;
    phone_number: string;
}

const ContactManagement: React.FC = () => {
    const { activeSession } = useSession();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'device' | 'csv'>('device');
    const navigate = useNavigate();

    const [csvContacts, setCsvContacts] = useState<CSVContact[]>([]);
    const [csvFileName, setCsvFileName] = useState<string | null>(null);

    const { data: contactsData, isLoading, refetch } = useQuery({
        queryKey: ['contacts', activeSession?.session_id],
        queryFn: async () => {
            if (!activeSession) return Promise.reject('No session');
            return whatsappService.getSessionContacts(activeSession.session_id);
        },
        enabled: !!activeSession && activeSession.status === 'connected',
    });

    useEffect(() => {
        setSearchQuery('');
        setCsvContacts([]);
        setCsvFileName(null);
    }, [activeSession?.session_id]);

    const filteredContacts = contactsData?.data?.filter(contact => {
        const q = searchQuery.toLowerCase();
        return (contact.name?.toLowerCase() || '').includes(q) || contact.phone_number.includes(q);
    }) || [];

    const filteredCsvContacts = csvContacts.filter(contact => {
        const q = searchQuery.toLowerCase();
        return (contact.name?.toLowerCase() || '').includes(q) || contact.phone_number.includes(q);
    });

    const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setCsvFileName(file.name);

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            if (!text) { return; }
            const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
            if (lines.length < 2) { return; }
            const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
            const fnIdx = headers.findIndex(h => h.toLowerCase() === 'first name');
            const lnIdx = headers.findIndex(h => h.toLowerCase() === 'last name');
            const orgIdx = headers.findIndex(h => h.toLowerCase() === 'organization name');
            let phoneIdx = headers.findIndex(h => h.toLowerCase() === 'phone 1 - value');
            if (phoneIdx === -1) phoneIdx = headers.findIndex(h => h.toLowerCase().includes('phone') && h.toLowerCase().includes('value'));
            if (phoneIdx === -1) phoneIdx = headers.findIndex(h => h.toLowerCase().includes('phone'));
            if (phoneIdx === -1) { alert('Could not find a phone number column in the CSV.'); return; }

            const parseCSVLine = (line: string): string[] => {
                const result: string[] = [];
                let curVal = ''; let inQuotes = false;
                for (let j = 0; j < line.length; j++) {
                    const char = line[j];
                    if (char === '"') { if (inQuotes && line[j + 1] === '"') { curVal += '"'; j++; } else { inQuotes = !inQuotes; } }
                    else if (char === ',' && !inQuotes) { result.push(curVal); curVal = ''; }
                    else { curVal += char; }
                }
                result.push(curVal);
                return result;
            };

            const parsed: CSVContact[] = [];
            for (let i = 1; i < lines.length; i++) {
                const cols = parseCSVLine(lines[i]);
                if (!cols.length) continue;
                const getCol = (idx: number) => idx !== -1 && idx < cols.length ? cols[idx] : '';
                let phone = getCol(phoneIdx).replace(/[\s-]/g, '');
                if (phone.startsWith('0')) phone = '62' + phone.substring(1);
                else if (phone.startsWith('+')) phone = phone.substring(1);
                let name = [getCol(fnIdx), getCol(lnIdx)].filter(Boolean).join(' ') || getCol(orgIdx) || 'Unknown Contact';
                if (phone) parsed.push({ name, phone_number: phone });
            }
            setCsvContacts(parsed);
        };
        reader.readAsText(file);
    };

    const handleStartChat = (contact: any) => {
        // Use JID from contact for proper matching with chat list
        // JID format: 628123456789@s.whatsapp.net
        const jidParam = contact.jid || contact.phone_number;
        console.log('[ContactManagement] handleStartChat called:', {
            contact,
            jidParam,
            navigateUrl: `/whatsapp/chat-management?jid=${jidParam}`,
            activeSession: activeSession?.session_id
        });
        navigate(`/whatsapp/chat-management?jid=${jidParam}`);
    };

    if (!activeSession) {
        return (
            <Card className="backdrop-blur-xl bg-white/70 border-white/50 m-6">
                <CardContent className="p-12 text-center">
                    <Smartphone className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No WhatsApp Session Selected</h3>
                    <p className="text-sm text-gray-600">Please select a session to manage contacts</p>
                </CardContent>
            </Card>
        );
    }

    if (activeSession.status !== 'connected') {
        return (
            <Card className="backdrop-blur-xl bg-white/70 border-white/50 m-6">
                <CardContent className="p-12 text-center">
                    <AlertCircle className="mx-auto h-12 w-12 text-yellow-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Session Not Connected</h3>
                    <p className="text-sm text-gray-600">Connect to session "{activeSession.session_name}" to view contacts</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <Card className="flex flex-col flex-1 min-h-0 border-none shadow-none bg-transparent">
                <CardHeader className="flex-shrink-0 px-6 pt-6 pb-0">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <UserCircle className="h-6 w-6 text-blue-600" />
                            <div>
                                <CardTitle>Contact Management</CardTitle>
                                <CardDescription>Manage your WhatsApp contacts</CardDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant={activeTab === 'device' ? 'default' : 'outline'} onClick={() => setActiveTab('device')} size="sm">
                                Device
                            </Button>
                            <Button variant={activeTab === 'csv' ? 'default' : 'outline'} onClick={() => setActiveTab('csv')} size="sm">
                                CSV
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
                                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                        </div>
                    </div>
                    <div className="mt-4 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Search by name or number..."
                            className="pl-10"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent className="flex-1 min-h-0 p-6">
                    <ScrollArea className="h-full pr-4">
                        {activeTab === 'device' ? (
                            <div className="rounded-md border bg-white">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[80px]">Avatar</TableHead>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Phone Number</TableHead>
                                            <TableHead className="text-right">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredContacts.map((contact: any) => (
                                            <TableRow key={contact.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleStartChat(contact)}>
                                                <TableCell>
                                                    <Avatar>
                                                        <AvatarImage src={contact.profile_picture_url} />
                                                        <AvatarFallback><User className="w-4 h-4" /></AvatarFallback>
                                                    </Avatar>
                                                </TableCell>
                                                <TableCell className="font-medium">{contact.name || contact.push_name || 'Unknown'}</TableCell>
                                                <TableCell>{contact.phone_number}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleStartChat(contact); }}>
                                                        <MessageCircle className="w-4 h-4 text-primary" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center gap-4 border-2 border-dashed rounded-lg p-8 justify-center bg-muted/50">
                                    <Input
                                        type="file"
                                        accept=".csv"
                                        onChange={handleCSVUpload}
                                        className="hidden"
                                        id="csv-upload"
                                    />
                                    <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center gap-2">
                                        <Upload className="w-8 h-8 text-muted-foreground" />
                                        <span className="font-medium text-muted-foreground">{csvFileName || 'Click to upload CSV'}</span>
                                        <span className="text-xs text-muted-foreground">Format: Name, Phone Number</span>
                                    </label>
                                </div>

                                {csvContacts.length > 0 && (
                                    <div className="rounded-md border bg-white">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[80px]">Avatar</TableHead>
                                                    <TableHead>Name</TableHead>
                                                    <TableHead>Phone Number</TableHead>
                                                    <TableHead className="text-right">Action</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredCsvContacts.map((contact, idx) => (
                                                    <TableRow key={idx} className="cursor-pointer hover:bg-muted/50" onClick={() => handleStartChat(contact)}>
                                                        <TableCell>
                                                            <Avatar>
                                                                <AvatarFallback><FileText className="w-4 h-4" /></AvatarFallback>
                                                            </Avatar>
                                                        </TableCell>
                                                        <TableCell className="font-medium">{contact.name}</TableCell>
                                                        <TableCell>{contact.phone_number}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleStartChat(contact); }}>
                                                                <MessageCircle className="w-4 h-4 text-primary" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </div>
                        )}
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
};

export default ContactManagement;
