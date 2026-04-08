import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, Search, Edit, Trash2, MoreVertical } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/common/ToastProvider';
import { api } from '@/services/api';
import { PaymentMethod, CreatePaymentMethodRequest } from '@/types/commerce';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const PaymentList: React.FC = () => {
    const [payments, setPayments] = useState<PaymentMethod[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(null);
    const { addToast } = useToast();

    // Form State
    const [formData, setFormData] = useState<CreatePaymentMethodRequest>({
        payment_name: '',
        payment_type: 'bank_transfer',
        provider: '',
        account_name: '',
        account_number: '',
        payment_image_url: '',
        instructions: '',
        status: 'active'
    });

    const fetchPayments = async () => {
        try {
            setLoading(true);
            const response = await api.get('/sales/payments');
            setPayments(response.data.data || []);
        } catch (error) {
            console.error('Failed to fetch payments:', error);
            addToast('Error', 'Failed to load payment methods', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPayments();
    }, []);

    const handleCreate = async () => {
        try {
            await api.post('/sales/payments', formData);
            addToast('Success', 'Payment method created successfully', 'success');
            setIsCreateOpen(false);
            resetForm();
            fetchPayments();
        } catch (error) {
            console.error('Failed to create payment method:', error);
            addToast('Error', 'Failed to create payment method', 'error');
        }
    };

    const handleUpdate = async () => {
        if (!selectedPayment) return;
        try {
            await api.put(`/sales/payments/${selectedPayment.id}`, formData);
            addToast('Success', 'Payment method updated successfully', 'success');
            setIsEditOpen(false);
            setSelectedPayment(null);
            resetForm();
            fetchPayments();
        } catch (error) {
            console.error('Failed to update payment method:', error);
            addToast('Error', 'Failed to update payment method', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this payment method?')) return;
        try {
            await api.delete(`/sales/payments/${id}`);
            addToast('Success', 'Payment method deleted successfully', 'success');
            fetchPayments();
        } catch (error) {
            console.error('Failed to delete payment method:', error);
            addToast('Error', 'Failed to delete payment method', 'error');
        }
    };

    const openEdit = (payment: PaymentMethod) => {
        setSelectedPayment(payment);
        setFormData({
            payment_name: payment.payment_name,
            payment_type: payment.payment_type,
            provider: payment.provider || '',
            account_name: payment.account_name || '',
            account_number: payment.account_number || '',
            payment_image_url: payment.payment_image_url || '',
            instructions: payment.instructions || '',
            status: payment.status
        });
        setIsEditOpen(true);
    };

    const resetForm = () => {
        setFormData({
            payment_name: '',
            payment_type: 'bank_transfer',
            provider: '',
            account_name: '',
            account_number: '',
            payment_image_url: '',
            instructions: '',
            status: 'active'
        });
    };

    const filteredPayments = payments.filter(p => 
        p.payment_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.provider?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <CreditCard className="h-10 w-10 text-primary" />
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
                        <p className="text-muted-foreground">Manage payment methods for your store.</p>
                    </div>
                </div>
                <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" /> Add Payment Method
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Payment Methods</CardTitle>
                            <CardDescription>Configure how customers pay you.</CardDescription>
                        </div>
                        <div className="relative w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search payment..."
                                className="pl-8"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Method Name</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Account Info</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-10">Loading...</TableCell>
                                    </TableRow>
                                ) : filteredPayments.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No payment methods found.</TableCell>
                                    </TableRow>
                                ) : (
                                    filteredPayments.map((payment) => (
                                        <TableRow key={payment.id}>
                                            <TableCell className="font-medium">
                                                <div className="flex flex-col">
                                                    <span>{payment.payment_name}</span>
                                                    <span className="text-xs text-muted-foreground">{payment.provider}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="capitalize">{payment.payment_type.replace('_', ' ')}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col text-sm">
                                                    <span>{payment.account_number}</span>
                                                    <span className="text-xs text-muted-foreground">{payment.account_name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={payment.status === 'active' ? 'default' : 'secondary'}>
                                                    {payment.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => openEdit(payment)}>
                                                            <Edit className="mr-2 h-4 w-4" /> Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(payment.id)}>
                                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Create/Edit Form Dialog Content (Shared) */}
            {/* Note: In a real app, extract this to a component */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Add Payment Method</DialogTitle>
                        <DialogDescription>Add a new way for customers to pay.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Display Name</Label>
                                <Input id="name" value={formData.payment_name} onChange={(e) => setFormData({...formData, payment_name: e.target.value})} placeholder="e.g. Bank Transfer BCA" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="type">Type</Label>
                                <Select value={formData.payment_type} onValueChange={(val: any) => setFormData({...formData, payment_type: val})}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                        <SelectItem value="qris">QRIS</SelectItem>
                                        <SelectItem value="e-wallet">E-Wallet</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="provider">Provider</Label>
                                <Input id="provider" value={formData.provider} onChange={(e) => setFormData({...formData, provider: e.target.value})} placeholder="e.g. BCA, GoPay" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="acc_name">Account Name</Label>
                                <Input id="acc_name" value={formData.account_name} onChange={(e) => setFormData({...formData, account_name: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="acc_num">Account Number</Label>
                                <Input id="acc_num" value={formData.account_number} onChange={(e) => setFormData({...formData, account_number: e.target.value})} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="instructions">Payment Instructions</Label>
                            <Textarea id="instructions" value={formData.instructions} onChange={(e) => setFormData({...formData, instructions: e.target.value})} placeholder="Steps to pay..." />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="image">QR / Logo URL</Label>
                            <Input id="image" value={formData.payment_image_url} onChange={(e) => setFormData({...formData, payment_image_url: e.target.value})} placeholder="https://..." />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreate}>Create Method</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Edit Payment Method</DialogTitle>
                        <DialogDescription>Update payment details.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-name">Display Name</Label>
                                <Input id="edit-name" value={formData.payment_name} onChange={(e) => setFormData({...formData, payment_name: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-type">Type</Label>
                                <Select value={formData.payment_type} onValueChange={(val: any) => setFormData({...formData, payment_type: val})}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                        <SelectItem value="qris">QRIS</SelectItem>
                                        <SelectItem value="e-wallet">E-Wallet</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-provider">Provider</Label>
                                <Input id="edit-provider" value={formData.provider} onChange={(e) => setFormData({...formData, provider: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-acc_name">Account Name</Label>
                                <Input id="edit-acc_name" value={formData.account_name} onChange={(e) => setFormData({...formData, account_name: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-acc_num">Account Number</Label>
                                <Input id="edit-acc_num" value={formData.account_number} onChange={(e) => setFormData({...formData, account_number: e.target.value})} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-instructions">Payment Instructions</Label>
                            <Textarea id="edit-instructions" value={formData.instructions} onChange={(e) => setFormData({...formData, instructions: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-image">QR / Logo URL</Label>
                            <Input id="edit-image" value={formData.payment_image_url} onChange={(e) => setFormData({...formData, payment_image_url: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-status">Status</Label>
                            <Select value={formData.status} onValueChange={(val: any) => setFormData({...formData, status: val})}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                        <Button onClick={handleUpdate}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default PaymentList;
