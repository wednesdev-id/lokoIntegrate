import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingCart, 
  AlertTriangle,
  PackageSearch,
  Loader2
} from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/components/common/ToastProvider';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ChartData {
  date: string;
  revenue: number;
}

interface BestSeller {
  product_id: string;
  product_name: string;
  total_sold: number;
  revenue: number;
}

interface LowStockProduct {
  id: string;
  name: string;
  stock: number;
  min_stock: number;
  sku: string;
}

interface RevenueData {
  total_orders: number;
  total_revenue: number;
  total_profit: number;
  chart_data: ChartData[];
  best_sellers: BestSeller[];
  low_stock_products: LowStockProduct[];
}

const RevenueDashboard: React.FC = () => {
    const [data, setData] = useState<RevenueData | null>(null);
    const [loading, setLoading] = useState(false);
    
    // Filters
    const [dateFilter, setDateFilter] = useState('this_month');
    const [groupBy, setGroupBy] = useState('daily');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    const { addToast } = useToast();

    useEffect(() => {
        const fetchRevenue = async () => {
            let start = '';
            let end = '';
            const today = new Date();
            
            if (dateFilter === 'this_month') {
                start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
                end = today.toISOString().split('T')[0];
            } else if (dateFilter === '3_months') {
                const d = new Date();
                d.setMonth(d.getMonth() - 3);
                start = d.toISOString().split('T')[0];
                end = today.toISOString().split('T')[0];
            } else if (dateFilter === '6_months') {
                const d = new Date();
                d.setMonth(d.getMonth() - 6);
                start = d.toISOString().split('T')[0];
                end = today.toISOString().split('T')[0];
            } else if (dateFilter === '1_year') {
                const d = new Date();
                d.setFullYear(d.getFullYear() - 1);
                start = d.toISOString().split('T')[0];
                end = today.toISOString().split('T')[0];
            } else if (dateFilter === 'custom') {
                start = customStartDate;
                end = customEndDate;
                // Wait until both Custom dates are provided
                if (!start || !end) return;
            }

            setLoading(true);
            try {
                const params = new URLSearchParams();
                if (start) params.append('start_date', start);
                if (end) params.append('end_date', end);
                params.append('group_by', groupBy);

                const response = await api.get(`/sales/revenue?${params.toString()}`);
                setData(response.data.data);
            } catch (error) {
                console.error('Failed to fetch revenue data', error);
                addToast('Error', 'Failed to load revenue data', 'error');
            } finally {
                setLoading(false);
            }
        };

        fetchRevenue();
    }, [dateFilter, groupBy, customStartDate, customEndDate, addToast]);

    const formatIDR = (value: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(value);
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Revenue Dashboard</h1>
                    <p className="text-muted-foreground">Monitor your sales traffic, cash flow, and inventory alerts.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                   {dateFilter === 'custom' && (
                       <div className="flex items-center gap-2">
                         <Input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="w-auto h-9" />
                         <span className="text-sm text-muted-foreground">to</span>
                         <Input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="w-auto h-9" />
                       </div>
                   )}
                   <Select value={dateFilter} onValueChange={setDateFilter}>
                      <SelectTrigger className="w-[150px] h-9">
                         <SelectValue placeholder="Period" />
                      </SelectTrigger>
                      <SelectContent>
                         <SelectItem value="this_month">Bulan Ini</SelectItem>
                         <SelectItem value="3_months">3 Bulan</SelectItem>
                         <SelectItem value="6_months">6 Bulan</SelectItem>
                         <SelectItem value="1_year">1 Tahun</SelectItem>
                         <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                   </Select>

                   <Select value={groupBy} onValueChange={setGroupBy}>
                      <SelectTrigger className="w-[120px] h-9">
                         <SelectValue placeholder="Group by" />
                      </SelectTrigger>
                      <SelectContent>
                         <SelectItem value="daily">Harian</SelectItem>
                         <SelectItem value="weekly">Mingguan</SelectItem>
                         <SelectItem value="monthly">Bulanan</SelectItem>
                      </SelectContent>
                   </Select>
               </div>
            </div>

            {loading ? (
                <div className="py-20 flex justify-center items-center gap-3 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin" /> Fetching revenue data...
                </div>
            ) : !data ? (
                <div className="py-20 flex justify-center items-center text-muted-foreground">Please select a valid date range.</div>
            ) : (
                <>
                    {/* Scorecards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Revenue (Arus Kas)</CardTitle>
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatIDR(data.total_revenue)}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Profit (Laba)</CardTitle>
                                <TrendingUp className="h-4 w-4 text-green-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">{formatIDR(data.total_profit)}</div>
                                <p className="text-xs text-muted-foreground mt-1">From completed orders</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Traffic Penjualan</CardTitle>
                                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{data.total_orders} Orders</div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Chart */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Sales Trends</CardTitle>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={data.chart_data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                    <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} />
                                    <CartesianGrid stroke="#ccc" strokeDasharray="5 5" vertical={false} />
                                    <XAxis dataKey="date" tick={{fontSize: 12}} />
                                    <YAxis tickFormatter={(val) => `Rp${val/1000}k`} tick={{fontSize: 12}} />
                                    <Tooltip formatter={(value: any) => formatIDR(Number(value))} labelStyle={{color: 'black'}} />
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Best Sellers */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <PackageSearch className="h-5 w-5 text-blue-500" />
                                    <CardTitle>Barang Paling Laku</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {data.best_sellers && data.best_sellers.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Product</TableHead>
                                                <TableHead className="text-right">Sold</TableHead>
                                                <TableHead className="text-right">Revenue</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {data.best_sellers.map((item) => (
                                                <TableRow key={item.product_id}>
                                                    <TableCell className="font-medium">{item.product_name}</TableCell>
                                                    <TableCell className="text-right">{item.total_sold}</TableCell>
                                                    <TableCell className="text-right">{formatIDR(item.revenue)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <div className="text-center py-4 text-muted-foreground">No sales data in this period.</div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Restock Alerts */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                                    <CardTitle>Barang Harus Restock</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {data.low_stock_products && data.low_stock_products.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Product</TableHead>
                                                <TableHead>SKU</TableHead>
                                                <TableHead className="text-right">Current Stock</TableHead>
                                                <TableHead className="text-right">Min Threshold</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {data.low_stock_products.map((item) => (
                                                <TableRow key={item.id}>
                                                    <TableCell className="font-medium">{item.name}</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">{item.sku}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge variant="destructive">{item.stock}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">{item.min_stock}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <div className="text-center py-4 text-muted-foreground">All products have sufficient stock.</div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
};

export default RevenueDashboard;
