import { useState, useEffect } from 'react';
import {
    History,
    Calendar,
    Package,
    CheckCircle2,
    Clock,
    XCircle,
    CreditCard
} from 'lucide-react';
import { format } from 'date-fns';
import { api } from '@/services/api';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface SubscriptionPackage {
    id: string;
    name: string;
    description: string;
    price: number;
    duration_days: number;
}

interface PurchaseHistoryItem {
    id: string;
    key: string;
    status: 'active' | 'expired' | 'revoked';
    subscription_package: SubscriptionPackage;
    activated_at: string;
    expires_at: string;
}

export default function PaymentHistory() {
    const [history, setHistory] = useState<PurchaseHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const response = await api.get('/subscription-packages/history');
                setHistory(response.data.data || []);
            } catch (error) {
                console.error('Failed to fetch payment history:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, []);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const getStatusBadge = (status: string, expiresAt: string) => {
        const isExpired = new Date(expiresAt) < new Date();
        
        if (status === 'revoked') {
            return <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="w-3 h-3" /> Revoked</Badge>;
        }
        
        if (isExpired || status === 'expired') {
            return <Badge variant="secondary" className="flex items-center gap-1"><Clock className="w-3 h-3" /> Expired</Badge>;
        }

        return <Badge variant="default" className="bg-green-600 hover:bg-green-700 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Active</Badge>;
    };

    if (loading) {
        return (
            <div className="p-6 space-y-6">
                <div className="flex items-center gap-3 mb-6">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div>
                        <Skeleton className="h-6 w-48 mb-2" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                </div>
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-32" />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-16 w-full" />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-xl">
                        <History className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Payment History</h1>
                        <p className="text-muted-foreground">
                            View your subscription purchase history and status
                        </p>
                    </div>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Transaction History</CardTitle>
                            <CardDescription>
                                List of all your subscription redemptions
                            </CardDescription>
                        </div>
                        <CreditCard className="w-5 h-5 text-muted-foreground" />
                    </div>
                </CardHeader>
                <CardContent>
                    {history.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                                <History className="w-8 h-8 text-muted-foreground/50" />
                            </div>
                            <h3 className="text-lg font-medium">No history found</h3>
                            <p className="text-muted-foreground mt-2">
                                You haven't redeemed any subscription packages yet.
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Package Name</TableHead>
                                        <TableHead>License Key</TableHead>
                                        <TableHead>Activated Date</TableHead>
                                        <TableHead>Expiry Date</TableHead>
                                        <TableHead>Price</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {history.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className="p-2 bg-primary/5 rounded-lg">
                                                        <Package className="w-4 h-4 text-primary" />
                                                    </div>
                                                    <span className="font-medium">
                                                        {item.subscription_package?.name || 'Unknown Package'}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <code className="bg-muted px-2 py-1 rounded text-sm font-mono text-muted-foreground">
                                                    {item.key}
                                                </code>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Calendar className="w-4 h-4" />
                                                    {item.activated_at ? format(new Date(item.activated_at), 'PPP') : '-'}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Clock className="w-4 h-4" />
                                                    {item.expires_at ? format(new Date(item.expires_at), 'PPP') : '-'}
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {item.subscription_package?.price 
                                                    ? formatCurrency(item.subscription_package.price)
                                                    : 'Free'
                                                }
                                            </TableCell>
                                            <TableCell>
                                                {getStatusBadge(item.status, item.expires_at)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
