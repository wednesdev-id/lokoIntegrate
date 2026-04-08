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
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/common/ToastProvider';
import { api } from '@/services/api';
import { Label } from '@/components/ui/label';
import { Order, PaymentProof } from '@/types/commerce';

const Transactions: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [proofs, setProofs] = useState<PaymentProof[]>([]);
    const [loadingOrders, setLoadingOrders] = useState(true);
    const [loadingProofs, setLoadingProofs] = useState(true);
    const [searchOrder, setSearchOrder] = useState('');
    const [selectedOrderId, setSelectedOrderId] = useState<string>('');
    const [notes, setNotes] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const { addToast } = useToast();

    useEffect(() => {
        fetchOrders();
        fetchProofs();
    }, []);

    const fetchOrders = async () => {
        try {
            setLoadingOrders(true);
            const response = await api.get('/inventory/orders');
            setOrders(response.data.data || []);
        } catch (error) {
            console.error('Failed to fetch orders:', error);
            addToast('Error', 'Failed to load orders', 'error');
        } finally {
            setLoadingOrders(false);
        }
    };

    const fetchProofs = async () => {
        try {
            setLoadingProofs(true);
            const response = await api.get('/sales/proofs');
            setProofs(response.data.data || []);
        } catch (error) {
            console.error('Failed to fetch proofs:', error);
            addToast('Error', 'Failed to load transaction proofs', 'error');
        } finally {
            setLoadingProofs(false);
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
        if (!selectedOrderId) {
            addToast('Warning', 'Please select an order', 'warning');
            return;
        }
        if (!file) {
            addToast('Warning', 'Please upload or paste an image', 'warning');
            return;
        }

        try {
            setUploading(true);
            const formData = new FormData();
            formData.append('order_id', selectedOrderId);
            formData.append('notes', notes);
            formData.append('file', file);

            await api.post('/sales/proofs', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            addToast('Success', 'Transaction proof uploaded successfully', 'success');
            // Reset form
            setSelectedOrderId('');
            setNotes('');
            setFile(null);
            setPreview(null);
            // Refresh list
            fetchProofs();
            fetchOrders(); // Refresh order status (might be waiting_verification)
        } catch (error) {
            console.error('Upload failed:', error);
            addToast('Error', 'Failed to upload proof', 'error');
        } finally {
            setUploading(false);
        }
    };

    const filteredOrders = orders.filter(o => 
        o.order_code.toLowerCase().includes(searchOrder.toLowerCase()) ||
        o.customer_name.toLowerCase().includes(searchOrder.toLowerCase())
    );

    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'verified': return 'default';
            case 'pending': return 'secondary';
            case 'rejected': return 'destructive';
            default: return 'outline';
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <History className="h-10 w-10 text-primary" />
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
                    <p className="text-muted-foreground">Record and manage transaction proofs for orders.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Upload Form */}
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle>Record Transaction</CardTitle>
                        <CardDescription>Upload or paste proof of payment.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label htmlFor="order">Select Order</Label>
                                    <Input 
                                        placeholder="Search order..." 
                                        className="h-8 w-40 text-xs" 
                                        value={searchOrder}
                                        onChange={(e) => setSearchOrder(e.target.value)}
                                    />
                                </div>
                                <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                                    {loadingOrders ? (
                                        <div className="text-center text-sm py-2">Loading orders...</div>
                                    ) : filteredOrders.length === 0 ? (
                                        <div className="text-center text-sm py-2">No orders available</div>
                                    ) : (
                                        filteredOrders.map(order => (
                                            <div 
                                                key={order.id}
                                                className={`p-2 rounded-md cursor-pointer text-sm flex justify-between items-center ${
                                                    selectedOrderId === order.id ? 'bg-zinc-800 text-white shadow-sm' : 'hover:bg-zinc-100'
                                                }`}
                                                onClick={() => setSelectedOrderId(order.id)}
                                            >
                                                <div>
                                                    <div className="font-medium">{order.order_code}</div>
                                                    <div className="text-xs opacity-80">{order.customer_name}</div>
                                                </div>
                                                <Badge variant="outline" className={selectedOrderId === order.id ? 'bg-white text-black border-none' : ''}>
                                                    Rp {order.total_amount.toLocaleString()}
                                                </Badge>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="notes">Notes (Optional)</Label>
                                <Textarea 
                                    id="notes" 
                                    value={notes} 
                                    onChange={(e) => setNotes(e.target.value)} 
                                    placeholder="e.g. Paid via BCA Transfer" 
                                    className="resize-none"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Proof Image</Label>
                                <div 
                                    onPaste={handlePaste}
                                    className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors h-48 relative"
                                    onClick={() => document.getElementById('file-upload')?.click()}
                                >
                                    {preview ? (
                                        <div className="absolute inset-0 p-2 flex items-center justify-center bg-black/5 rounded-lg">
                                            <img src={preview} alt="Preview" className="max-h-full max-w-full object-contain rounded-md shadow-sm" />
                                        </div>
                                    ) : (
                                        <>
                                            <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                                            <p className="text-sm font-medium">Click to upload or paste image</p>
                                            <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 10MB</p>
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
                                {uploading ? 'Uploading...' : 'Save Transaction'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* History List */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Transaction History</CardTitle>
                        <CardDescription>View uploaded payment proofs.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Order Code</TableHead>
                                        <TableHead>Image</TableHead>
                                        <TableHead>Notes</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Date</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loadingProofs ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-10">Loading...</TableCell>
                                        </TableRow>
                                    ) : proofs.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No transactions recorded.</TableCell>
                                        </TableRow>
                                    ) : (
                                        proofs.map((proof) => (
                                            <TableRow key={proof.id}>
                                                <TableCell className="font-medium">
                                                    {proof.order_id.split('-')[0]}... 
                                                </TableCell>
                                                <TableCell>
                                                    <a href={proof.media_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-zinc-600 hover:text-zinc-900 hover:underline text-sm font-medium">
                                                        <FileImage className="h-4 w-4" /> View
                                                    </a>
                                                </TableCell>
                                                <TableCell className="truncate max-w-[150px]">{proof.notes || '-'}</TableCell>
                                                <TableCell>
                                                    <Badge variant={getStatusVariant(proof.verification_status)}>
                                                        {proof.verification_status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {new Date(proof.created_at).toLocaleDateString()}
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

export default Transactions;
