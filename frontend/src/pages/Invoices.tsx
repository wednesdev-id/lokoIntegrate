import { useState, useEffect, useCallback } from 'react';
import { FileText, Printer, RefreshCw, CheckCircle2, XCircle, Search, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';


const token = () => localStorage.getItem('auth_token') || '';

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        ...opts,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token()}`,
            ...opts?.headers,
        },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data as T;
}

function fmtCurrency(n: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
}

interface User {
    id: string;
    name: string;
    email: string;
}

interface SubscriptionPackage {
    id: string;
    name: string;
    price: number;
}

interface Transaction {
    id: string;
    created_at: string;
    actual_paid: number;
    notes: string;
    media_url: string;
    user?: User;
    subscription_package?: SubscriptionPackage;
}

export default function Invoices() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [selectedInvoice, setSelectedInvoice] = useState<Transaction | null>(null);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const fetchTransactions = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiFetch<any>('/api/subscription-transactions');
            setTransactions(res.data || []);
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

    const handlePrint = () => {
        const printContent = document.getElementById("invoice-print-template");
        if (!printContent) return;
        const WinPrint = window.open('', '', 'width=900,height=650');
        WinPrint?.document.write(`
            <html>
                <head>
                    <title>Invoice</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                </head>
                <body onload="window.print();window.close()">
                    <div class="p-8">
                        ${printContent.innerHTML}
                    </div>
                </body>
            </html>
        `);
        WinPrint?.document.close();
    };

    const filtered = transactions.filter(t => 
        t.user?.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        t.user?.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.subscription_package?.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-16 px-1">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-white text-sm font-medium transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
                    {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <FileText className="w-6 h-6 text-blue-600" />
                        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
                    </div>
                    <p className="text-gray-500 text-sm">Daftar invoice pembayaran subscription</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Cari User / Paket..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-3 py-2 border rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <Button variant="outline" onClick={fetchTransactions} className="gap-2">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* List Table */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-10 text-center text-gray-400">Memuat data...</div>
                ) : filtered.length === 0 ? (
                    <div className="p-14 text-center">
                        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-400 font-medium">Belum ada invoice transaksi</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b">
                                    <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Invoice No</th>
                                    <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">User</th>
                                    <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Paket</th>
                                    <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Tanggal</th>
                                    <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Jumlah Bayar</th>
                                    <th className="text-right px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filtered.map(t => (
                                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-5 py-3 font-mono text-xs font-semibold text-zinc-900">
                                            #INV-{t.id.substring(0, 8).toUpperCase()}
                                        </td>
                                        <td className="px-5 py-3">
                                            <div>
                                                <div className="font-medium text-gray-800 text-xs">{t.user?.name || '—'}</div>
                                                <div className="text-gray-400 text-xs">{t.user?.email || '—'}</div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3 font-medium text-gray-700 text-xs">{t.subscription_package?.name || '—'}</td>
                                        <td className="px-5 py-3 text-gray-500 text-xs">
                                            {format(new Date(t.created_at), 'dd MMM yyyy')}
                                        </td>
                                        <td className="px-5 py-3 font-bold text-green-700 text-xs">
                                            {fmtCurrency(t.actual_paid)}
                                        </td>
                                        <td className="px-5 py-3">
                                            <div className="flex items-center justify-end gap-1">
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button variant="outline" size="sm" onClick={() => setSelectedInvoice(t)} className="gap-1 text-xs">
                                                            <Printer className="w-3.5 h-3.5" />
                                                            View & Print
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="max-w-2xl bg-white p-0 overflow-hidden">
                                                        {selectedInvoice && (
                                                            <div className="flex flex-col h-full">
                                                                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                                                                    <DialogTitle>Preview Invoice</DialogTitle>
                                                                    <Button size="sm" onClick={handlePrint} className="gap-2">
                                                                        <Printer className="w-4 h-4" />
                                                                        Print
                                                                    </Button>
                                                                </div>
                                                                <div id="invoice-print-template" className="p-8 bg-white text-zinc-800">
                                                                    <div className="flex justify-between items-start border-b pb-6 mb-8">
                                                                        <div>
                                                                            <h1 className="text-3xl font-extrabold text-blue-600 tracking-tight">LOKO</h1>
                                                                            <p className="text-sm text-gray-500 mt-1">Management Tool Subscription</p>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <div className="font-bold text-lg">INVOICE</div>
                                                                            <div className="font-mono text-sm text-gray-600 mt-1">#INV-{selectedInvoice.id.substring(0, 8).toUpperCase()}</div>
                                                                            <div className="text-xs text-gray-500 mt-1 flex items-center justify-end gap-1">
                                                                                <Calendar className="w-3.5 h-3.5" />
                                                                                {format(new Date(selectedInvoice.created_at), 'dd MMM yyyy HH:mm')}
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="grid grid-cols-2 gap-8 mb-8">
                                                                        <div>
                                                                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Billed To</div>
                                                                            <div className="font-bold text-base text-gray-900">{selectedInvoice.user?.name}</div>
                                                                            <div className="text-sm text-gray-600">{selectedInvoice.user?.email}</div>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Payment Method</div>
                                                                            <div className="font-semibold text-sm text-gray-800">Direct Manual Transfer</div>
                                                                            <div className="text-xs text-green-600 font-bold mt-1 inline-flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                                                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                                                PAID
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="border rounded-xl overflow-hidden mb-8">
                                                                        <table className="w-full text-sm">
                                                                            <thead>
                                                                                <tr className="bg-gray-50 border-b">
                                                                                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Description</th>
                                                                                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Amount</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                <tr>
                                                                                    <td className="px-4 py-4">
                                                                                        <div className="font-semibold text-gray-800">{selectedInvoice.subscription_package?.name}</div>
                                                                                        <div className="text-xs text-gray-400 mt-0.5">Subscription Activation</div>
                                                                                    </td>
                                                                                    <td className="px-4 py-4 text-right font-semibold text-gray-900">
                                                                                        {fmtCurrency(selectedInvoice.subscription_package?.price || 0)}
                                                                                    </td>
                                                                                </tr>
                                                                            </tbody>
                                                                        </table>
                                                                    </div>

                                                                    <div className="flex justify-end mb-12">
                                                                        <div className="w-64 space-y-2 border-t pt-4">
                                                                            <div className="flex justify-between text-sm text-gray-600">
                                                                                <span>Subtotal</span>
                                                                                <span>{fmtCurrency(selectedInvoice.subscription_package?.price || 0)}</span>
                                                                            </div>
                                                                            <div className="flex justify-between font-bold text-lg text-gray-900 border-t pt-2">
                                                                                <span>Total</span>
                                                                                <span className="text-green-700">{fmtCurrency(selectedInvoice.actual_paid)}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="text-center text-xs text-gray-400 mt-20 border-t pt-4">
                                                                        <p>Terima kasih atas pembayaran Anda.</p>
                                                                        <p className="mt-0.5">Loko Subscriptions - All rights reserved.</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </DialogContent>
                                                </Dialog>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
