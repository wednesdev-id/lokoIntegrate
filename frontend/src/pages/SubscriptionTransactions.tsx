import React, { useState, useEffect, ClipboardEvent } from 'react';
import { History, Upload, FileImage } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { useToast } from '@/components/common/ToastProvider';
import { api } from '@/services/api';
import { Label } from '@/components/ui/label';

interface UserItem {
    id: string;
    username: string;
    name: string;
    email: string;
}

interface SubscriptionPackage {
    id: string;
    name: string;
    price: number;
    duration_days: number;
}

interface SubscriptionTransaction {
    id: string;
    user_id: string;
    user?: UserItem;
    package_id: string;
    subscription_package?: SubscriptionPackage;
    actual_paid: number;
    media_url: string;
    notes: string;
    created_at: string;
}

const SubscriptionTransactions: React.FC = () => {
    const [users, setUsers] = useState<UserItem[]>([]);
    const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
    const [transactions, setTransactions] = useState<SubscriptionTransaction[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);

    const [loadingTransactions, setLoadingTransactions] = useState(true);
    
    const [searchUser, setSearchUser] = useState('');
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [selectedPackageId, setSelectedPackageId] = useState<string>('');
    const [actualPaid, setActualPaid] = useState<string>('');
    const [notes, setNotes] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const { addToast } = useToast();

    useEffect(() => {
        fetchUsers();
        fetchPackages();
        fetchTransactions();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoadingUsers(true);
            const response = await api.get('/users');
            setUsers(response.data.data || []);
        } catch (error) {
            console.error('Failed to fetch users:', error);
            addToast('Error', 'Failed to load users', 'error');
        } finally {
            setLoadingUsers(false);
        }
    };

    const fetchPackages = async () => {
        try {
            const response = await api.get('/subscription-packages');
            setPackages(response.data.data || []);
        } catch (error) {
            console.error('Failed to fetch packages:', error);
            addToast('Error', 'Failed to load packages', 'error');
        }
    };

    const fetchTransactions = async () => {
        try {
            setLoadingTransactions(true);
            const response = await api.get('/subscription-transactions');
            setTransactions(response.data.data || []);
        } catch (error) {
            console.error('Failed to fetch transactions:', error);
            addToast('Error', 'Failed to load transactions', 'error');
        } finally {
            setLoadingTransactions(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setPreview(URL.createObjectURL(selectedFile));
        }
    };

    const handlePaste = (e: ClipboardEvent<HTMLDivElement>) => {
        const items = e.clipboardData?.items;
        if (items) {
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const pastedFile = items[i].getAsFile();
                    if (pastedFile) {
                        setFile(pastedFile);
                        setPreview(URL.createObjectURL(pastedFile));
                        addToast('Success', 'Image pasted from clipboard', 'success');
                        break;
                    }
                }
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUserId) {
            addToast('Warning', 'Please select a user', 'warning');
            return;
        }
        if (!selectedPackageId) {
            addToast('Warning', 'Please select a package', 'warning');
            return;
        }

        try {
            setUploading(true);
            const formData = new FormData();
            formData.append('user_id', selectedUserId);
            formData.append('package_id', selectedPackageId);
            formData.append('actual_paid', actualPaid);
            formData.append('notes', notes);
            if (file) {
                formData.append('file', file);
            }

            await api.post('/subscription-transactions', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            addToast('Success', 'Subscription transaction recorded successfully', 'success');
            // Reset form
            setSelectedUserId('');
            setSelectedPackageId('');
            setActualPaid('');
            setNotes('');
            setFile(null);
            setPreview(null);
            // Refresh list
            fetchTransactions();
        } catch (error) {
            console.error('Upload failed:', error);
            addToast('Error', 'Failed to record transaction', 'error');
        } finally {
            setUploading(false);
        }
    };

    const filteredUsers = users.filter(u => 
        u.name.toLowerCase().includes(searchUser.toLowerCase()) ||
        u.username.toLowerCase().includes(searchUser.toLowerCase())
    );

    const selectedPkg = packages.find(p => p.id === selectedPackageId);

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <History className="h-10 w-10 text-primary" />
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Subscription Transactions</h1>
                    <p className="text-muted-foreground">Record and manage manual payment triggers for customers.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Upload Form */}
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle>Record Payment</CardTitle>
                        <CardDescription>Manually activate user subscription packages.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* User Selection */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label htmlFor="user">Select User</Label>
                                    <Input 
                                        placeholder="Search user..." 
                                        className="h-8 w-40 text-xs" 
                                        value={searchUser}
                                        onChange={(e) => setSearchUser(e.target.value)}
                                    />
                                </div>
                                <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                                    {loadingUsers ? (
                                        <div className="text-center text-sm py-2">Loading users...</div>
                                    ) : filteredUsers.length === 0 ? (
                                        <div className="text-center text-sm py-2">No users available</div>
                                    ) : (
                                        filteredUsers.map(userItem => (
                                            <div 
                                                key={userItem.id}
                                                className={`p-2 rounded-md cursor-pointer text-sm flex justify-between items-center ${
                                                    selectedUserId === userItem.id ? 'bg-zinc-800 text-white shadow-sm' : 'hover:bg-zinc-100'
                                                }`}
                                                onClick={() => setSelectedUserId(userItem.id)}
                                            >
                                                <div>
                                                    <div className="font-medium">{userItem.name}</div>
                                                    <div className="text-xs opacity-80">{userItem.username}</div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Package Selection */}
                            <div className="space-y-2">
                                <Label htmlFor="package">Select Package</Label>
                                <select 
                                    id="package"
                                    className="w-full border rounded-md p-2 text-sm"
                                    value={selectedPackageId}
                                    onChange={(e) => setSelectedPackageId(e.target.value)}
                                >
                                    <option value="">-- Pick Package --</option>
                                    {packages.map(pkg => (
                                        <option key={pkg.id} value={pkg.id}>
                                            {pkg.name} - Rp {pkg.price.toLocaleString()}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Actual Paid */}
                            <div className="space-y-2">
                                <Label htmlFor="actualPaid">Actual Paid (Optional)</Label>
                                <Input 
                                    id="actualPaid" 
                                    type="number"
                                    value={actualPaid} 
                                    onChange={(e) => setActualPaid(e.target.value)} 
                                    placeholder={selectedPkg ? `Default: Rp ${selectedPkg.price.toLocaleString()}` : "Enter amount"} 
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="notes">Notes (Optional)</Label>
                                <Textarea 
                                    id="notes" 
                                    value={notes} 
                                    onChange={(e) => setNotes(e.target.value)} 
                                    placeholder="e.g. Paid via Cash / Direct Transfer" 
                                    className="resize-none"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Proof Image (Optional)</Label>
                                <div 
                                    onPaste={handlePaste}
                                    className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors h-36 relative"
                                    onClick={() => document.getElementById('file-upload')?.click()}
                                >
                                    {preview ? (
                                        <div className="absolute inset-0 p-2 flex items-center justify-center bg-black/5 rounded-lg">
                                            <img src={preview} alt="Preview" className="max-h-full max-w-full object-contain rounded-md shadow-sm" />
                                        </div>
                                    ) : (
                                        <>
                                            <Upload className="h-8 w-8 text-muted-foreground mb-1" />
                                            <p className="text-xs font-medium">Click to upload or paste image</p>
                                        </>
                                    )}
                                </div>
                                <input 
                                    id="file-upload" 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={handleFileChange} 
                                />
                            </div>

                            <Button type="submit" className="w-full" disabled={uploading}>
                                {uploading ? 'Processing...' : 'Record & Activate'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* History List */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>History</CardTitle>
                        <CardDescription>View recorded subscription payments.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>User</TableHead>
                                        <TableHead>Package</TableHead>
                                        <TableHead>Paid</TableHead>
                                        <TableHead>Attachment</TableHead>
                                        <TableHead>Date</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loadingTransactions ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-10">Loading...</TableCell>
                                        </TableRow>
                                    ) : transactions.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No transactions recorded.</TableCell>
                                        </TableRow>
                                    ) : (
                                        transactions.map((tx) => (
                                            <TableRow key={tx.id}>
                                                <TableCell className="font-medium">
                                                    {tx.user?.name || 'User'}
                                                    <div className="text-xs text-gray-400">{tx.user?.username}</div>
                                                </TableCell>
                                                <TableCell>{tx.subscription_package?.name || 'Package'}</TableCell>
                                                <TableCell>Rp {(tx.actual_paid || 0).toLocaleString()}</TableCell>
                                                <TableCell>
                                                    {tx.media_url ? (
                                                        <a href={tx.media_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-zinc-600 hover:text-zinc-900 hover:underline text-sm font-medium">
                                                            <FileImage className="h-4 w-4" /> View
                                                        </a>
                                                    ) : '-'}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {new Date(tx.created_at).toLocaleDateString()}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default SubscriptionTransactions;
