import React, { useState, useEffect } from 'react';
import { TrendingUp, Package, Key, Activity, CalendarClock } from 'lucide-react';
import api from '../services/api';
import { Badge } from '@/components/ui/badge';
import { format, formatDistanceToNow, isPast } from 'date-fns';

interface SubscriptionPackage {
    id: string;
    name: string;
    price: number;
}

interface User {
    id: string;
    name: string;
    email: string;
}

interface License {
    id: string;
    key: string;
    subscription_package_id: string;
    subscription_package?: SubscriptionPackage;
    status: string;
    used_by_user?: User;
    created_at: string;
    activated_at?: string;
    expires_at?: string;
}

const SubscriptionReports: React.FC = () => {
    const [licenses, setLicenses] = useState<License[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Just fetch licenses, the items often have subscription_package inside
            const licRes = await api.get('/subscription-packages/licenses');
            setLicenses(licRes.data.data || []);
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Calculations for insights
    const totalLicenses = licenses.length;
    const activeLicenses = licenses.filter(l => l.status === 'active').length;
    const availableLicenses = licenses.filter(l => l.status === 'available').length;
    const revokedOrExpired = licenses.filter(l => l.status === 'revoked' || l.status === 'expired').length;

    const getRemainingTime = (expiresAtStr?: string) => {
        if (!expiresAtStr) return '-';
        const expiresAt = new Date(expiresAtStr);
        if (isPast(expiresAt)) return 'Expired';
        return formatDistanceToNow(expiresAt, { addSuffix: true });
    };

    return (
        <div className="h-full flex flex-col bg-gray-50/50">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-white">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                    <TrendingUp className="w-6 h-6 text-indigo-600" />
                    Subscription Reports
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                    Monitor license usage, active subscriptions, and package statistics.
                </p>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-gray-500">Loading reports...</div>
                </div>
            ) : (
                <div className="flex-1 p-6 overflow-auto space-y-6">
                    {/* Analytics Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                                <Key className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-500">Total Licenses</p>
                                <h3 className="text-2xl font-bold text-gray-900">{totalLicenses}</h3>
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                                <Activity className="w-6 h-6 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-500">Active Licenses</p>
                                <h3 className="text-2xl font-bold text-green-700">{activeLicenses}</h3>
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
                                <Package className="w-6 h-6 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-500">Available (Unused)</p>
                                <h3 className="text-2xl font-bold text-gray-900">{availableLicenses}</h3>
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                                <CalendarClock className="w-6 h-6 text-red-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-500">Expired / Revoked</p>
                                <h3 className="text-2xl font-bold text-red-700">{revokedOrExpired}</h3>
                            </div>
                        </div>
                    </div>

                    {/* Licenses Table with Details */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
                            <h3 className="font-semibold text-gray-800">License Usage Details</h3>
                        </div>

                        {licenses.length === 0 ? (
                            <div className="p-12 text-center text-gray-500">No licenses found.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-white border-b border-gray-200 text-gray-500 uppercase text-xs font-semibold">
                                        <tr>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4">Package</th>
                                            <th className="px-6 py-4">Used By</th>
                                            <th className="px-6 py-4">Activated</th>
                                            <th className="px-6 py-4">Time Remaining</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {licenses.map((lic) => (
                                            <tr key={lic.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <Badge
                                                        variant="outline"
                                                        className={`
                              ${lic.status === 'available' ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}
                              ${lic.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : ''}
                              ${lic.status === 'expired' ? 'bg-gray-50 text-gray-700 border-gray-200' : ''}
                              ${lic.status === 'revoked' ? 'bg-red-50 text-red-700 border-red-200' : ''}
                            `}
                                                    >
                                                        {lic.status.toUpperCase()}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4 font-medium text-gray-700">
                                                    {lic.subscription_package?.name || 'Unknown'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {lic.used_by_user ? (
                                                        <div>
                                                            <p className="font-medium text-gray-900">{lic.used_by_user.name}</p>
                                                            <p className="text-xs text-gray-500">{lic.used_by_user.email}</p>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400 italic">-</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-gray-500">
                                                    {lic.activated_at ? format(new Date(lic.activated_at), 'dd MMM yyyy') : '-'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {lic.status === 'active' ? (
                                                        <span className="font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">
                                                            {getRemainingTime(lic.expires_at)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                </div>
            )}
        </div>
    );
};

export default SubscriptionReports;
