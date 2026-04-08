import { useState, useEffect, useCallback } from 'react';
import {
    DollarSign, TrendingUp, Key, CheckCircle2, XCircle,
    Clock, RefreshCw, BarChart3, Users, Package, ShieldOff, Trash2, History
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { format, isAfter } from 'date-fns';

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

interface SubscriptionPackage {
    id: string;
    name: string;
    price: number;
    duration_days: number;
}

interface License {
    id: string;
    key: string;
    status: 'available' | 'active' | 'expired' | 'revoked';
    created_at: string;
    activated_at?: string;
    expires_at?: string;
    subscription_package?: SubscriptionPackage;
    used_by_user?: { id: string; name: string; email: string };
}

interface RevenueByPackage {
    package: SubscriptionPackage;
    sold: number;
    revenue: number;
    active: number;
    expired: number;
}

const statusConfig: Record<string, { label: string; cls: string }> = {
    available: { label: 'Available', cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
    active: { label: 'Active', cls: 'bg-green-50 text-green-700 border border-green-200' },
    expired: { label: 'Expired', cls: 'bg-gray-100 text-gray-600 border border-gray-200' },
    revoked: { label: 'Revoked', cls: 'bg-red-50 text-red-700 border border-red-200' },
};

export default function Revenue() {
    const [licenses, setLicenses] = useState<License[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const fetchLicenses = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiFetch<any>('/api/subscription-packages/licenses');
            setLicenses(res.data || []);
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchTransactions = useCallback(async () => {
        try {
            const res = await apiFetch<any>('/api/subscription-transactions');
            setTransactions(res.data || []);
        } catch (err: any) {
            console.error('Fetch transactions error:', err);
        }
    }, []);

    useEffect(() => { 
        fetchLicenses(); 
        fetchTransactions();
    }, [fetchLicenses, fetchTransactions]);


    const handleRevoke = async (id: string) => {
        if (!confirm('Revoke this license?')) return;
        try {
            await apiFetch(`/api/subscription-packages/licenses/${id}/revoke`, { method: 'PUT' });
            showToast('License revoked');
            fetchLicenses();
        } catch (err: any) { showToast(err.message, 'error'); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this license permanently?')) return;
        try {
            await apiFetch(`/api/subscription-packages/licenses/${id}`, { method: 'DELETE' });
            showToast('License deleted');
            fetchLicenses();
        } catch (err: any) { showToast(err.message, 'error'); }
    };

    // --- Computed Stats ---
    const sold = licenses.filter(l => l.status === 'active' || l.status === 'expired');
    const active = licenses.filter(l => l.status === 'active');
    const available = licenses.filter(l => l.status === 'available');
    const revoked = licenses.filter(l => l.status === 'revoked');

    const totalRevenue = sold.reduce((sum, l) => sum + (l.subscription_package?.price || 0), 0);

    // Revenue grouped by package
    const byPackage = licenses.reduce<Record<string, RevenueByPackage>>((acc, l) => {
        const pkg = l.subscription_package;
        if (!pkg) return acc;
        if (!acc[pkg.id]) {
            acc[pkg.id] = { package: pkg, sold: 0, revenue: 0, active: 0, expired: 0 };
        }
        if (l.status === 'active' || l.status === 'expired') {
            acc[pkg.id].sold += 1;
            acc[pkg.id].revenue += pkg.price;
        }
        if (l.status === 'active') acc[pkg.id].active += 1;
        if (l.status === 'expired') acc[pkg.id].expired += 1;
        return acc;
    }, {});

    const packageStats = Object.values(byPackage).sort((a, b) => b.revenue - a.revenue);

    // Licenses expiring within 7 days
    const expiringSoon = active.filter(l => {
        if (!l.expires_at) return false;
        const diff = new Date(l.expires_at).getTime() - Date.now();
        return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
    });

    const getRemainingDays = (expiresAt?: string) => {
        if (!expiresAt) return null;
        const diff = new Date(expiresAt).getTime() - Date.now();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    };

    const soldLicenses = licenses.filter(l => l.status !== 'available');

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
                        <DollarSign className="w-6 h-6 text-green-600" />
                        <h1 className="text-2xl font-bold text-gray-900">Revenue Dashboard</h1>
                    </div>
                    <p className="text-gray-500 text-sm">Pantau pendapatan dari penjualan lisensi</p>
                </div>
                <Button variant="outline" onClick={fetchLicenses} className="gap-2">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-5 text-white shadow-lg shadow-green-200">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-green-100">Total Revenue</span>
                        <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                            <DollarSign className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold">{fmtCurrency(totalRevenue)}</div>
                    <div className="text-xs text-green-100 mt-1">{sold.length} lisensi terjual</div>
                </div>

                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg shadow-blue-200">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-blue-100">Aktif</span>
                        <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold">{active.length}</div>
                    <div className="text-xs text-blue-100 mt-1">Lisensi sedang aktif</div>
                </div>

                <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-5 text-white shadow-lg shadow-orange-200">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-amber-100">Tersedia</span>
                        <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                            <Key className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold">{available.length}</div>
                    <div className="text-xs text-amber-100 mt-1">Belum di-redeem</div>
                </div>

                <div className="bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl p-5 text-white shadow-lg shadow-purple-200">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-purple-100">Total Lisensi</span>
                        <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                            <BarChart3 className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold">{licenses.length}</div>
                    <div className="text-xs text-purple-100 mt-1">{revoked.length} di-revoke</div>
                </div>
            </div>

            {/* Revenue by Package */}
            {packageStats.length > 0 && (
                <div className="bg-white rounded-2xl border shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-5">
                        <Package className="w-5 h-5 text-indigo-600" />
                        <h2 className="text-lg font-semibold text-gray-900">Revenue per Paket</h2>
                    </div>
                    <div className="space-y-4">
                        {packageStats.map(ps => {
                            const maxRevenue = Math.max(...packageStats.map(p => p.revenue), 1);
                            const pct = (ps.revenue / maxRevenue) * 100;
                            return (
                                <div key={ps.package.id}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div>
                                            <span className="font-semibold text-gray-800">{ps.package.name}</span>
                                            <span className="ml-2 text-xs text-gray-400">{fmtCurrency(ps.package.price)} / {ps.package.duration_days} hari</span>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-green-700">{fmtCurrency(ps.revenue)}</div>
                                            <div className="text-xs text-gray-400">{ps.sold} terjual · {ps.active} aktif · {ps.expired} expired</div>
                                        </div>
                                    </div>
                                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-700"
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Expiring Soon Alert */}
            {expiringSoon.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <Clock className="w-5 h-5 text-amber-600" />
                        <h3 className="font-semibold text-amber-800">⚠️ {expiringSoon.length} Lisensi Hampir Expired (≤ 7 hari)</h3>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {expiringSoon.map(l => (
                            <div key={l.id} className="bg-white rounded-xl p-4 border border-amber-200 shadow-sm">
                                <code className="text-xs font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 block mb-2">{l.key}</code>
                                <div className="text-xs text-gray-700 font-medium">{l.used_by_user?.name || '—'}</div>
                                <div className="text-xs text-gray-400">{l.used_by_user?.email}</div>
                                <div className="mt-2 text-xs font-bold text-red-600">
                                    {getRemainingDays(l.expires_at)} hari lagi
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* All Sold/Used Licenses Table */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-gray-600" />
                        <h2 className="text-lg font-semibold text-gray-900">Riwayat Penjualan Lisensi</h2>
                    </div>
                    <span className="text-sm text-gray-400">{soldLicenses.length} transaksi</span>
                </div>

                <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="p-10 text-center text-gray-400">Memuat data...</div>
                    ) : soldLicenses.length === 0 ? (
                        <div className="p-14 text-center">
                            <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-400 font-medium">Belum ada lisensi yang terjual</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 border-b">
                                        <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">License Key</th>
                                        <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Paket</th>
                                        <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Revenue</th>
                                        <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Customer</th>
                                        <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Status</th>
                                        <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Aktif Sejak</th>
                                        <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Expired</th>
                                        <th className="text-right px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {soldLicenses.map(l => {
                                        const sc = statusConfig[l.status] || statusConfig.available;
                                        const remaining = getRemainingDays(l.expires_at);
                                        const isExpiredNow = l.expires_at ? !isAfter(new Date(l.expires_at), new Date()) : false;
                                        return (
                                            <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-5 py-3">
                                                    <code className="bg-purple-50 px-2 py-0.5 rounded font-mono text-purple-700 text-xs border border-purple-100">
                                                        {l.key}
                                                    </code>
                                                </td>
                                                <td className="px-5 py-3 font-medium text-gray-700 text-xs">{l.subscription_package?.name || '—'}</td>
                                                <td className="px-5 py-3 font-bold text-green-700 text-xs">
                                                    {fmtCurrency(l.subscription_package?.price || 0)}
                                                </td>
                                                <td className="px-5 py-3">
                                                    {l.used_by_user ? (
                                                        <div>
                                                            <div className="font-medium text-gray-800 text-xs">{l.used_by_user.name}</div>
                                                            <div className="text-gray-400 text-xs">{l.used_by_user.email}</div>
                                                        </div>
                                                    ) : <span className="text-gray-400 text-xs">—</span>}
                                                </td>
                                                <td className="px-5 py-3">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${sc.cls}`}>
                                                        {sc.label}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3 text-gray-500 text-xs">
                                                    {l.activated_at ? format(new Date(l.activated_at), 'dd MMM yyyy') : '—'}
                                                </td>
                                                <td className="px-5 py-3 text-xs">
                                                    {l.expires_at ? (
                                                        <div>
                                                            <div className="text-gray-600">{format(new Date(l.expires_at), 'dd MMM yyyy')}</div>
                                                            {!isExpiredNow && remaining !== null && (
                                                                <div className={remaining <= 7 ? 'text-red-600 font-medium' : 'text-gray-400'}>
                                                                    {remaining > 0 ? `${remaining}h lagi` : 'Expired'}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : '—'}
                                                </td>
                                                <td className="px-5 py-3">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {l.status === 'active' && (
                                                            <button
                                                                onClick={() => handleRevoke(l.id)}
                                                                className="p-1.5 rounded-lg hover:bg-orange-50 text-gray-400 hover:text-orange-600 transition-colors"
                                                                title="Revoke"
                                                            >
                                                                <ShieldOff className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        {(l.status === 'expired' || l.status === 'revoked') && (
                                                            <button
                                                                onClick={() => handleDelete(l.id)}
                                                                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Manual Subscription Transactions Table */}
            <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <History className="w-5 h-5 text-gray-600" />
                        <h2 className="text-lg font-semibold text-gray-900">Riwayat Pembayaran Manual (Direct)</h2>
                    </div>
                    <span className="text-sm text-gray-400">{transactions.length} transaksi</span>
                </div>

                <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="p-10 text-center text-gray-400">Memuat data...</div>
                    ) : transactions.length === 0 ? (
                        <div className="p-14 text-center">
                            <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-400 font-medium">Belum ada transaksi manual</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 border-b">
                                        <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">User</th>
                                        <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Paket</th>
                                        <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Actual Paid</th>
                                        <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Bukti</th>
                                        <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Tanggal</th>
                                        <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Notes</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {transactions.map(t => (
                                        <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-5 py-3">
                                                <div>
                                                    <div className="font-medium text-gray-800 text-xs">{t.user?.name || '—'}</div>
                                                    <div className="text-gray-400 text-xs">{t.user?.email || '—'}</div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3 font-medium text-gray-700 text-xs">{t.subscription_package?.name || '—'}</td>
                                            <td className="px-5 py-3 font-bold text-green-700 text-xs">
                                                {fmtCurrency(t.actual_paid)}
                                            </td>
                                            <td className="px-5 py-3">
                                                {t.media_url ? (
                                                    <a href={t.media_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs">
                                                        View Proof
                                                    </a>
                                                ) : <span className="text-gray-400 text-xs">—</span>}
                                            </td>
                                            <td className="px-5 py-3 text-gray-500 text-xs">
                                                {format(new Date(t.created_at), 'dd MMM yyyy')}
                                            </td>
                                            <td className="px-5 py-3 text-gray-400 text-xs truncate max-w-xs">{t.notes || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>

    );
}
