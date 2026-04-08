import React, { useState, useEffect } from 'react';
import { ShoppingCart, Search, Eye, Filter } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from '@/components/common/ToastProvider';
import { api } from '@/services/api';
import { Order, OrderItem } from '@/types/commerce';

const OrderList: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const { addToast } = useToast();

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const response = await api.get('/inventory/orders');
            setOrders(response.data.data || []);
        } catch (error) {
            console.error('Failed to fetch orders:', error);
            addToast('Error', 'Failed to load orders', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    const updateOrderStatus = async (id: string, newStatus: string) => {
        try {
            await api.put(`/inventory/orders/${id}/status`, { status: newStatus });
            addToast('Success', 'Order status updated', 'success');
            
            // Update local state
            setOrders(orders.map(o => o.id === id ? { ...o, order_status: newStatus as any } : o));
            if (selectedOrder && selectedOrder.id === id) {
                setSelectedOrder({ ...selectedOrder, order_status: newStatus as any });
            }
        } catch (error) {
            console.error('Failed to update status:', error);
            addToast('Error', 'Failed to update order status', 'error');
        }
    };

    const openDetail = async (order: Order) => {
        // Fetch full detail including items if needed
        try {
            const response = await api.get(`/inventory/orders/${order.id}`);
            setSelectedOrder(response.data.data);
            setIsDetailOpen(true);
        } catch (error) {
            console.error('Failed to fetch order details:', error);
            addToast('Error', 'Failed to load order details', 'error');
        }
    };

    const filteredOrders = orders.filter(o => {
        const matchesSearch = 
            o.order_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            o.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            o.phone_number.includes(searchQuery);
        
        const matchesStatus = statusFilter === 'all' || o.order_status === statusFilter;
        
        return matchesSearch && matchesStatus;
    });

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'paid':
            case 'completed':
                return <Badge className="bg-green-600 hover:bg-green-700">{status}</Badge>;
            case 'pending_payment':
                return <Badge variant="outline" className="text-orange-600 border-orange-600">{status.replace('_', ' ')}</Badge>;
            case 'waiting_verification':
                return <Badge className="bg-blue-600 hover:bg-blue-700">Verify</Badge>;
            case 'processing':
                return <Badge className="bg-indigo-600 hover:bg-indigo-700">{status}</Badge>;
            case 'cancelled':
                return <Badge variant="destructive">{status}</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <ShoppingCart className="h-10 w-10 text-primary" />
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
                    <p className="text-muted-foreground">Manage customer orders here.</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <CardTitle>Order List</CardTitle>
                            <CardDescription>View and manage all customer orders.</CardDescription>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search order, customer..."
                                    className="pl-8"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[180px]">
                                    <div className="flex items-center gap-2">
                                        <Filter className="h-4 w-4" />
                                        <SelectValue placeholder="Filter Status" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="pending_payment">Pending Payment</SelectItem>
                                    <SelectItem value="waiting_verification">Waiting Verification</SelectItem>
                                    <SelectItem value="paid">Paid</SelectItem>
                                    <SelectItem value="processing">Processing</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Order Code</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Total</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-10">Loading...</TableCell>
                                    </TableRow>
                                ) : filteredOrders.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No orders found.</TableCell>
                                    </TableRow>
                                ) : (
                                    filteredOrders.map((order) => (
                                        <TableRow key={order.id}>
                                            <TableCell className="font-medium">{order.order_code}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span>{order.customer_name}</span>
                                                    <span className="text-xs text-muted-foreground">{order.phone_number}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>{formatCurrency(order.total_amount)}</TableCell>
                                            <TableCell>{getStatusBadge(order.order_status)}</TableCell>
                                            <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" onClick={() => openDetail(order)}>
                                                    <Eye className="h-4 w-4 mr-1" /> View
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Order Detail Dialog */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Order Details: {selectedOrder?.order_code}</DialogTitle>
                        <DialogDescription>
                            Created on {selectedOrder && new Date(selectedOrder.created_at).toLocaleString()}
                        </DialogDescription>
                    </DialogHeader>
                    
                    {selectedOrder && (
                        <div className="space-y-6 py-4">
                            {/* Status & Actions */}
                            <div className="flex justify-between items-center p-4 bg-muted/50 rounded-lg">
                                <div className="flex flex-col">
                                    <span className="text-sm text-muted-foreground">Current Status</span>
                                    <div className="mt-1">{getStatusBadge(selectedOrder.order_status)}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Select 
                                        value={selectedOrder.order_status} 
                                        onValueChange={(val) => updateOrderStatus(selectedOrder.id, val)}
                                    >
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue placeholder="Update Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="pending_payment">Pending Payment</SelectItem>
                                            <SelectItem value="waiting_verification">Waiting Verification</SelectItem>
                                            <SelectItem value="paid">Paid</SelectItem>
                                            <SelectItem value="processing">Processing</SelectItem>
                                            <SelectItem value="completed">Completed</SelectItem>
                                            <SelectItem value="cancelled">Cancelled</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Customer Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <h3 className="font-semibold text-sm">Customer Information</h3>
                                    <p className="text-sm">{selectedOrder.customer_name}</p>
                                    <p className="text-sm text-muted-foreground">{selectedOrder.phone_number}</p>
                                </div>
                                <div className="space-y-1">
                                    <h3 className="font-semibold text-sm">Shipping Information</h3>
                                    {selectedOrder.shipping_address ? (
                                        <>
                                            <p className="text-sm">{selectedOrder.shipping_name || selectedOrder.customer_name}</p>
                                            <p className="text-sm text-muted-foreground">{selectedOrder.shipping_address}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {selectedOrder.shipping_city}, {selectedOrder.shipping_province} {selectedOrder.shipping_postal_code}
                                            </p>
                                        </>
                                    ) : (
                                        <p className="text-sm text-muted-foreground italic">No shipping required (Digital/Service)</p>
                                    )}
                                </div>
                            </div>

                            {/* Order Items */}
                            <div>
                                <h3 className="font-semibold text-sm mb-3">Order Items</h3>
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Product</TableHead>
                                                <TableHead className="text-right">Price</TableHead>
                                                <TableHead className="text-right">Qty</TableHead>
                                                <TableHead className="text-right">Total</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {selectedOrder.items?.map((item: OrderItem) => (
                                                <TableRow key={item.id}>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">{item.product_name}</span>
                                                            <span className="text-xs text-muted-foreground">{item.sku}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">{formatCurrency(item.price)}</TableCell>
                                                    <TableCell className="text-right">{item.quantity}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(item.subtotal)}</TableCell>
                                                </TableRow>
                                            ))}
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-right font-medium">Subtotal</TableCell>
                                                <TableCell className="text-right">{formatCurrency(selectedOrder.subtotal)}</TableCell>
                                            </TableRow>
                                            {selectedOrder.discount_amount > 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={3} className="text-right font-medium text-green-600">Discount</TableCell>
                                                    <TableCell className="text-right text-green-600">-{formatCurrency(selectedOrder.discount_amount)}</TableCell>
                                                </TableRow>
                                            )}
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-right font-bold">Total</TableCell>
                                                <TableCell className="text-right font-bold">{formatCurrency(selectedOrder.total_amount)}</TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default OrderList;
