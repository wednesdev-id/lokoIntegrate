import React, { useState, useEffect } from 'react';
import { Plus, Key, Trash2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import api from '../services/api';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface SubscriptionPackage {
    id: string;
    name: string;
    price: number;
}

interface License {
    id: string;
    key: string;
    subscription_package_id: string;
    subscription_package?: SubscriptionPackage;
    status: string;
    created_at: string;
    activated_at?: string;
    expires_at?: string;
}

const LicenseGenerator: React.FC = () => {
    const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
    const [licenses, setLicenses] = useState<License[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [selectedPackageId, setSelectedPackageId] = useState('');
    const [quantity, setQuantity] = useState<number>(1);
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [pkgRes, licRes] = await Promise.all([
                api.get('/subscription-packages'),
                api.get('/subscription-packages/licenses')
            ]);
            const pkgs = pkgRes.data?.data || (Array.isArray(pkgRes.data) ? pkgRes.data : []);
            const lics = licRes.data?.data || (Array.isArray(licRes.data) ? licRes.data : []);
            setPackages(pkgs);
            setLicenses(lics);
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        if (!selectedPackageId || quantity < 1) return;

        setGenerating(true);
        try {
            await api.post('/subscription-packages/licenses/generate', {
                package_id: selectedPackageId,
                quantity: quantity
            });
            setShowGenerateModal(false);
            fetchData(); // Refresh list
        } catch (error) {
            console.error('Failed to generate licenses:', error);
            alert('Failed to generate licenses');
        } finally {
            setGenerating(false);
        }
    };

    const handleRevoke = async (id: string) => {
        if (!confirm('Are you sure you want to revoke this license?')) return;
        try {
            await api.put(`/subscription-packages/licenses/${id}/revoke`);
            fetchData();
        } catch (error) {
            console.error('Failed to revoke:', error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this license?')) return;
        try {
            await api.delete(`/subscription-packages/licenses/${id}`);
            fetchData();
        } catch (error) {
            console.error('Failed to delete:', error);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    return (
        <div className="h-full flex flex-col bg-gray-50/50">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-white flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                        <Key className="w-6 h-6 text-purple-600" />
                        License Generator
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Create and manage license keys for subscription packages.
                    </p>
                </div>
                <Button
                    onClick={() => {
                        setSelectedPackageId('');
                        setQuantity(1);
                        setShowGenerateModal(true);
                    }}
                    className="bg-purple-600 hover:bg-purple-700 shadow-sm"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Generate Keys
                </Button>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 overflow-auto">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">Loading licenses...</div>
                    ) : licenses.length === 0 ? (
                        <div className="p-12 text-center flex flex-col items-center justify-center">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <Key className="w-8 h-8 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-1">No Licenses Found</h3>
                            <p className="text-gray-500 text-sm max-w-sm">
                                You haven't generated any license keys yet. Click the button above to create some.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-500 uppercase text-xs font-semibold">
                                    <tr>
                                        <th className="px-6 py-4">License Key</th>
                                        <th className="px-6 py-4">Package</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Generated At</th>
                                        <th className="px-6 py-4">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {licenses.map((lic) => (
                                        <tr key={lic.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <code className="bg-gray-100 px-2 py-1 rounded text-purple-700 font-mono text-sm border border-gray-200">
                                                        {lic.key}
                                                    </code>
                                                    <button
                                                        onClick={() => copyToClipboard(lic.key)}
                                                        className="text-gray-400 hover:text-purple-600 transition-colors"
                                                        title="Copy to clipboard"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-700">
                                                {lic.subscription_package?.name || 'Unknown'}
                                            </td>
                                            <td className="px-6 py-4">
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
                                            <td className="px-6 py-4 text-gray-500">
                                                {format(new Date(lic.created_at), 'dd MMM yyyy, HH:mm')}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    {lic.status === 'active' && (
                                                        <button
                                                            onClick={() => handleRevoke(lic.id)}
                                                            className="p-1.5 rounded-lg text-orange-600 hover:bg-orange-50 bg-white border border-gray-200 shadow-sm transition-colors"
                                                            title="Revoke License"
                                                        >
                                                            <XCircle className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDelete(lic.id)}
                                                        className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 bg-white border border-gray-200 shadow-sm transition-colors"
                                                        title="Delete License"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
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

            {/* Generate Modal */}
            <Dialog open={showGenerateModal} onOpenChange={setShowGenerateModal}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Generate License Keys</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Select Package</label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={selectedPackageId}
                                onChange={(e) => setSelectedPackageId(e.target.value)}
                            >
                                <option value="" disabled>Select a package...</option>
                                {packages.filter(p => p.id).map(p => (
                                    <option key={p.id} value={p.id}>{p.name} - Rp {p.price.toLocaleString()}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Quantity</label>
                            <Input
                                type="number"
                                min={1}
                                max={100}
                                value={quantity}
                                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                            />
                            <p className="text-xs text-gray-500">Number of unique keys to generate (max 100).</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowGenerateModal(false)}>Cancel</Button>
                        <Button
                            onClick={handleGenerate}
                            disabled={!selectedPackageId || quantity < 1 || generating}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                            {generating ? 'Generating...' : 'Generate Keys'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default LicenseGenerator;
