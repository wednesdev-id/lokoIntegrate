import { useState, useEffect, useCallback } from 'react';
import {
    Plus, Edit, Trash2, Search, RefreshCw, Package, CheckCircle2,
    XCircle, X, AlertTriangle, Key, Copy, ShieldOff, Award, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';

/* ─────────────── Types ─────────────── */
interface SubscriptionPackage {
    id: string;
    name: string;
    description: string;
    price: number;
    broadcast_limit: number;
    ai_limit: number;
    max_sessions: number;
    max_bots: number;
    duration_days: number;
    trial_days: number;
    is_trial_enabled: boolean;
    is_active: boolean;
    active_modules: string;
    created_at: string;
    connected_sessions?: number;
    total_users?: number;
}

interface License {
    id: string;
    key: string;
    subscription_package_id: string;
    subscription_package?: SubscriptionPackage;
    status: 'available' | 'active' | 'expired' | 'revoked';
    created_at: string;
    activated_at?: string;
    expires_at?: string;
    used_by_user?: { id: string; name: string; email: string };
}

interface FormState {
    name: string;
    description: string;
    price: number;
    broadcast_limit: number;
    ai_limit: number;
    max_sessions: number;
    max_bots: number;
    duration_days: number;
    trial_days: number;
    is_trial_enabled: boolean;
    is_active: boolean;
    active_modules: string[];
}

const EMPTY_FORM: FormState = {
    name: '',
    description: '',
    price: 0,
    broadcast_limit: 1000,
    ai_limit: 100,
    max_sessions: 1,
    max_bots: 1,
    duration_days: 30,
    trial_days: 7,
    is_trial_enabled: true,
    is_active: true,
    active_modules: ['dashboard', 'whatsapp', 'inventory', 'sales', 'settings'],
};

// Helper to check if value represents unlimited (-1)
const isUnlimited = (val: number) => val === -1;

const AVAILABLE_MODULES = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'whatsapp', label: 'WhatsApp' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'sales', label: 'Sales' },
    { id: 'settings', label: 'Settings' },
];

const token = () => localStorage.getItem('auth_token') || '';
const API = '/api/subscription-packages';

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
    const url = path.startsWith('/api') ? path : `${API}${path}`;
    const res = await fetch(url, {
        ...opts,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}`, ...opts?.headers },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data as T;
}

/* ─────────────── Helpers ─────────────── */
function fmtCurrency(amount: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}

/* ─────────────── Modal ─────────────── */
function PackageModal({
    open, mode, initial, onClose, onSaved,
}: {
    open: boolean;
    mode: 'create' | 'edit';
    initial?: SubscriptionPackage;
    onClose: () => void;
    onSaved: (msg: string) => void;
}) {
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (mode === 'edit' && initial) {
            setForm({
                name: initial.name,
                description: initial.description,
                price: initial.price,
                broadcast_limit: initial.broadcast_limit,
                ai_limit: initial.ai_limit,
                max_sessions: initial.max_sessions || 1,
                max_bots: initial.max_bots || 1,
                duration_days: initial.duration_days,
                trial_days: initial.trial_days || 7,
                is_trial_enabled: initial.is_trial_enabled ?? true,
                is_active: initial.is_active,
                active_modules: initial.active_modules ? initial.active_modules.split(',') : [],
            });
        } else {
            setForm(EMPTY_FORM);
        }
        setError('');
    }, [open, mode, initial]);

    const set = (k: keyof FormState, v: any) => setForm(p => ({ ...p, [k]: v }));

    const toggleModule = (id: string) => {
        setForm(prev => {
            const modules = prev.active_modules.includes(id)
                ? prev.active_modules.filter(m => m !== id)
                : [...prev.active_modules, id];
            return { ...prev, active_modules: modules };
        });
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            const body: any = { 
                ...form,
                active_modules: form.active_modules.join(',') 
            };
            if (mode === 'create') {
                await apiFetch('/', { method: 'POST', body: JSON.stringify(body) });
                onSaved('Package berhasil dibuat!');
            } else {
                await apiFetch(`/${initial!.id}`, { method: 'PUT', body: JSON.stringify(body) });
                onSaved('Package berhasil diupdate!');
            }
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${mode === 'create' ? 'bg-indigo-100' : 'bg-blue-100'}`}>
                            {mode === 'create'
                                ? <Plus className="w-5 h-5 text-indigo-600" />
                                : <Edit className="w-5 h-5 text-blue-600" />}
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">
                                {mode === 'create' ? 'Tambah Package Baru' : 'Edit Package'}
                            </h2>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={submit} className="p-6 space-y-4">
                    {error && (
                        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Package <span className="text-red-500">*</span></label>
                            <input required value={form.name} onChange={e => set('name', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="PRO Plan" />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Deskripsi</label>
                            <textarea value={form.description} onChange={e => set('description', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-20"
                                placeholder="Penjelasan fitur package..." />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Harga (Rp)</label>
                            <input type="number" min={0} value={form.price} onChange={e => set('price', parseInt(e.target.value) || 0)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-sm font-medium text-gray-700">Broadcast Limit</label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input type="checkbox" checked={isUnlimited(form.broadcast_limit)} onChange={e => set('broadcast_limit', e.target.checked ? -1 : 1000)}
                                        className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" />
                                    <span className="text-xs text-gray-500">Unlimited</span>
                                </label>
                            </div>
                            <input type="number" min={0} value={isUnlimited(form.broadcast_limit) ? '' : form.broadcast_limit}
                                onChange={e => set('broadcast_limit', parseInt(e.target.value) || 0)}
                                disabled={isUnlimited(form.broadcast_limit)}
                                className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none ${isUnlimited(form.broadcast_limit) ? 'bg-gray-100 text-gray-400' : ''}`}
                                placeholder={isUnlimited(form.broadcast_limit) ? 'Unlimited' : ''} />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-sm font-medium text-gray-700">AI Limit</label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input type="checkbox" checked={isUnlimited(form.ai_limit)} onChange={e => set('ai_limit', e.target.checked ? -1 : 100)}
                                        className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" />
                                    <span className="text-xs text-gray-500">Unlimited</span>
                                </label>
                            </div>
                            <input type="number" min={0} value={isUnlimited(form.ai_limit) ? '' : form.ai_limit}
                                onChange={e => set('ai_limit', parseInt(e.target.value) || 0)}
                                disabled={isUnlimited(form.ai_limit)}
                                className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none ${isUnlimited(form.ai_limit) ? 'bg-gray-100 text-gray-400' : ''}`}
                                placeholder={isUnlimited(form.ai_limit) ? 'Unlimited' : ''} />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-sm font-medium text-gray-700">Max Sessions</label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input type="checkbox" checked={isUnlimited(form.max_sessions)} onChange={e => set('max_sessions', e.target.checked ? -1 : 1)}
                                        className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" />
                                    <span className="text-xs text-gray-500">Unlimited</span>
                                </label>
                            </div>
                            <input type="number" min={1} value={isUnlimited(form.max_sessions) ? '' : form.max_sessions}
                                onChange={e => set('max_sessions', parseInt(e.target.value) || 1)}
                                disabled={isUnlimited(form.max_sessions)}
                                className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none ${isUnlimited(form.max_sessions) ? 'bg-gray-100 text-gray-400' : ''}`}
                                placeholder={isUnlimited(form.max_sessions) ? 'Unlimited' : ''} />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-sm font-medium text-gray-700">Max Bots</label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input type="checkbox" checked={isUnlimited(form.max_bots)} onChange={e => set('max_bots', e.target.checked ? -1 : 1)}
                                        className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" />
                                    <span className="text-xs text-gray-500">Unlimited</span>
                                </label>
                            </div>
                            <input type="number" min={1} value={isUnlimited(form.max_bots) ? '' : form.max_bots}
                                onChange={e => set('max_bots', parseInt(e.target.value) || 1)}
                                disabled={isUnlimited(form.max_bots)}
                                className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none ${isUnlimited(form.max_bots) ? 'bg-gray-100 text-gray-400' : ''}`}
                                placeholder={isUnlimited(form.max_bots) ? 'Unlimited' : ''} />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Durasi (Hari)</label>
                            <input type="number" min={1} value={form.duration_days} onChange={e => set('duration_days', parseInt(e.target.value) || 30)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>

                        {/* Trial Configuration */}
                        <div className="col-span-2 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                                        <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-800">Trial Period</h4>
                                        <p className="text-xs text-gray-500">Aktifkan masa trial untuk pengguna baru</p>
                                    </div>
                                </div>
                                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                    <div className={`w-10 h-5 rounded-full transition-colors ${form.is_trial_enabled ? 'bg-amber-500' : 'bg-gray-300'} relative`}
                                        onClick={() => set('is_trial_enabled', !form.is_trial_enabled)}>
                                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_trial_enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                    </div>
                                    <span className="text-xs font-medium text-gray-600">{form.is_trial_enabled ? 'Aktif' : 'Nonaktif'}</span>
                                </label>
                            </div>
                            {form.is_trial_enabled && (
                                <div className="mt-3">
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Durasi Trial (Hari)</label>
                                    <input type="number" min={1} max={365} value={form.trial_days} onChange={e => set('trial_days', parseInt(e.target.value) || 7)}
                                        className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white" />
                                    <p className="text-xs text-gray-500 mt-1">Pengguna baru dapat mencoba selama {form.trial_days} hari sebelum harus berlangganan</p>
                                </div>
                            )}
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Menu Modules</label>
                            <div className="grid grid-cols-2 gap-3 p-3 border rounded-lg bg-gray-50">
                                {AVAILABLE_MODULES.map(module => (
                                    <div key={module.id} className="flex items-center space-x-2">
                                        <Checkbox 
                                            id={`module-${module.id}`}
                                            checked={form.active_modules.includes(module.id)}
                                            onCheckedChange={() => toggleModule(module.id)}
                                        />
                                        <Label htmlFor={`module-${module.id}`} className="font-normal cursor-pointer select-none">
                                            {module.label}
                                        </Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 pt-2">
                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                            <div className={`w-10 h-5 rounded-full transition-colors ${form.is_active ? 'bg-green-500' : 'bg-gray-300'} relative`}
                                onClick={() => set('is_active', !form.is_active)}>
                                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                            </div>
                            <span className="text-sm font-medium text-gray-700">Aktif</span>
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Batal</Button>
                        <Button
                            type="submit"
                            disabled={saving}
                            className={`min-w-[120px] ${mode === 'create' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
                        >
                            {saving ? 'Menyimpan...' : mode === 'create' ? 'Buat Package' : 'Simpan Perubahan'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ─────────────── Delete Confirm ─────────────── */
function DeleteConfirm({ pkg, onClose, onDeleted }: { pkg: SubscriptionPackage; onClose: () => void; onDeleted: () => void }) {
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState('');

    const handle = async () => {
        setDeleting(true);
        try {
            await apiFetch(`/${pkg.id}`, { method: 'DELETE' });
            onDeleted();
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
                <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                    <Trash2 className="w-7 h-7 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 text-center">Hapus Package</h3>
                <p className="text-sm text-gray-500 text-center mt-1 mb-5">
                    Yakin ingin menghapus package <strong>{pkg.name}</strong>?
                </p>
                {error && <p className="text-sm text-red-600 text-center mb-3">{error}</p>}
                <div className="flex gap-3">
                    <Button className="flex-1" variant="outline" onClick={onClose} disabled={deleting}>Batal</Button>
                    <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={handle} disabled={deleting}>
                        {deleting ? 'Menghapus...' : 'Ya, Hapus'}
                    </Button>
                </div>
            </div>
        </div>
    );
}

/* ─────────────── Promo Modal ─────────────── */
function PromoModal({ open, onClose, onSaved, packages }: { open: boolean; onClose: () => void; onSaved: (msg: string) => void; packages: any[] }) {
    const [form, setForm] = useState({ code: '', package_id: '', discount_type: 'percent', discount_value: 0, max_uses: 0, start_date: '', end_date: '' });
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                ...form,
                package_id: form.package_id ? form.package_id : undefined,
                discount_value: Number(form.discount_value),
                max_uses: Number(form.max_uses),
                start_date: form.start_date ? new Date(form.start_date).toISOString() : undefined,
                end_date: form.end_date ? new Date(form.end_date).toISOString() : undefined,
            };
            await apiFetch('/api/promos', { method: 'POST', body: JSON.stringify(payload) });
            onSaved('Promo Code berhasil dibuat');
            onClose();
        } catch (err: any) { alert(err.message); } finally { setSaving(false); }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
                <h3 className="text-lg font-bold">Tambah Promo Code</h3>
                <div className="space-y-3 text-sm">
                    <div>
                        <label className="block font-medium mb-1">Kode</label>
                        <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} className="w-full border rounded-lg px-3 py-2" placeholder="PROMO50" />
                    </div>
                    <div>
                        <label className="block font-medium mb-1">Package (Optional)</label>
                        <select value={form.package_id} onChange={e => setForm({ ...form, package_id: e.target.value })} className="w-full border rounded-lg px-3 py-2">
                            <option value="">Semua Package</option>
                            {packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block font-medium mb-1">Tipe Diskon</label>
                            <select value={form.discount_type} onChange={e => setForm({ ...form, discount_type: e.target.value })} className="w-full border rounded-lg px-3 py-2">
                                <option value="percent">Persentase (%)</option>
                                <option value="fixed">Nominal (IDR)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block font-medium mb-1">Nilai</label>
                            <input type="number" value={form.discount_value} onChange={e => setForm({ ...form, discount_value: Number(e.target.value) })} className="w-full border rounded-lg px-3 py-2" />
                        </div>
                    </div>
                    <div>
                        <label className="block font-medium mb-1">Max Uses (0 = Unlimited)</label>
                        <input type="number" value={form.max_uses} onChange={e => setForm({ ...form, max_uses: Number(e.target.value) })} className="w-full border rounded-lg px-3 py-2" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block font-medium mb-1">Mulai</label>
                            <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
                        </div>
                        <div>
                            <label className="block font-medium mb-1">Berakhir</label>
                            <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
                        </div>
                    </div>
                </div>
                <div className="flex gap-3 mt-4">
                    <Button className="flex-1" variant="outline" onClick={onClose} disabled={saving}>Batal</Button>
                    <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleSave} disabled={saving}>
                        {saving ? 'Menyimpan...' : 'Simpan'}
                    </Button>
                </div>
            </div>
        </div>
    );
}

/* ─────────────── Affiliate Modal ─────────────── */
function AffiliateModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (msg: string) => void }) {
    const [form, setForm] = useState({ user_id: '', code: '', commission_rate: 10 });
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await apiFetch('/api/affiliates', { method: 'POST', body: JSON.stringify({ ...form, commission_rate: Number(form.commission_rate) }) });
            onSaved('Affiliate berhasil dibuat');
            onClose();
        } catch (err: any) { alert(err.message); } finally { setSaving(false); }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
                <h3 className="text-lg font-bold">Tambah Affiliate</h3>
                <div className="space-y-3 text-sm">
                    <div>
                        <label className="block font-medium mb-1">User ID</label>
                        <input value={form.user_id} onChange={e => setForm({ ...form, user_id: e.target.value })} className="w-full border rounded-lg px-3 py-2" placeholder="UUID Pengguna" />
                    </div>
                    <div>
                        <label className="block font-medium mb-1">Kode Affiliate</label>
                        <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} className="w-full border rounded-lg px-3 py-2" placeholder="AFFIL50" />
                    </div>
                    <div>
                        <label className="block font-medium mb-1">Komisi (%)</label>
                        <input type="number" value={form.commission_rate} onChange={e => setForm({ ...form, commission_rate: Number(e.target.value) })} className="w-full border rounded-lg px-3 py-2" />
                    </div>
                </div>
                <div className="flex gap-3 mt-4">
                    <Button className="flex-1" variant="outline" onClick={onClose} disabled={saving}>Batal</Button>
                    <Button className="flex-1 bg-purple-600 hover:bg-purple-700 text-white" onClick={handleSave} disabled={saving}>
                        {saving ? 'Menyimpan...' : 'Simpan'}
                    </Button>
                </div>
            </div>
        </div>
    );
}

/* ─────────────── Main Page ─────────────── */
export default function SubscriptionPackages() {
    const [packages, setPackages] = useState<any[]>([]);
    const [licenses, setLicenses] = useState<License[]>([]);
    const [promos, setPromos] = useState<any[]>([]);
    const [affiliates, setAffiliates] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [licSearch, setLicSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    // Get user role from localStorage
    const userRole = localStorage.getItem('user_role') || '';

    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [modalOpen, setModalOpen] = useState(false);
    const [editPkg, setEditPkg] = useState<any | undefined>();
    const [deletePkg, setDeletePkg] = useState<any | null>(null);
    const [promoModalOpen, setPromoModalOpen] = useState(false);
    const [affModalOpen, setAffModalOpen] = useState(false);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const fetchPackages = useCallback(async () => {
        setLoading(true);
        try {
            const endpoint = userRole === 'SuperAdmin' ? '/with-stats' : '/';
            const res = await apiFetch<any>(endpoint);
            setPackages(res.data || []);
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [userRole]);

    const fetchLicenses = useCallback(async () => {
        try {
            const res = await apiFetch<any>(`/licenses`);
            setLicenses(res.data || []);
        } catch (err: any) {
            console.error('Failed to fetch licenses:', err);
        }
    }, []);

    const fetchPromos = useCallback(async () => {
        try {
            const res = await apiFetch<any>(`/api/promos`);
            setPromos(res.data || []);
        } catch (err: any) {
            console.error('Failed to fetch promos:', err);
        }
    }, []);

    const fetchAffiliates = useCallback(async () => {
        try {
            const res = await apiFetch<any>(`/api/affiliates`);
            setAffiliates(res.data || []);
        } catch (err: any) {
            console.error('Failed to fetch affiliates:', err);
        }
    }, []);

    useEffect(() => {
        fetchPackages();
        if (userRole === 'SuperAdmin') {
            fetchLicenses();
            fetchPromos();
            fetchAffiliates();
        }
    }, [fetchPackages, fetchLicenses, fetchPromos, fetchAffiliates, userRole]);

    const handleRevokeLicense = async (id: string) => {
        if (!confirm('Revoke this license key?')) return;
        try {
            await apiFetch(`/licenses/${id}/revoke`, { method: 'PUT' });
            showToast('License revoked');
            fetchLicenses();
        } catch (err: any) { showToast(err.message, 'error'); }
    };

    const handleDeleteLicense = async (id: string) => {
        if (!confirm('Permanently delete this license key?')) return;
        try {
            await apiFetch(`/licenses/${id}`, { method: 'DELETE' });
            showToast('License deleted');
            fetchLicenses();
        } catch (err: any) { showToast(err.message, 'error'); }
    };

    const copyToClipboard = (text: string) => navigator.clipboard.writeText(text);

    const filtered = packages.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    const filteredLic = licenses.filter(l =>
        l.key.toLowerCase().includes(licSearch.toLowerCase()) ||
        (l.subscription_package?.name || '').toLowerCase().includes(licSearch.toLowerCase())
    );

    const openCreate = () => { setModalMode('create'); setEditPkg(undefined); setModalOpen(true); };
    const openEdit = (p: SubscriptionPackage) => { setModalMode('edit'); setEditPkg(p); setModalOpen(true); };

    const statusConfig: Record<string, { label: string; cls: string }> = {
        available: { label: 'Available', cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
        active: { label: 'Active', cls: 'bg-green-50 text-green-700 border border-green-200' },
        expired: { label: 'Expired', cls: 'bg-gray-100 text-gray-600 border border-gray-200' },
        revoked: { label: 'Revoked', cls: 'bg-red-50 text-red-700 border border-red-200' },
    };

    const getRemainingDays = (expiresAt?: string) => {
        if (!expiresAt) return null;
        const diff = new Date(expiresAt).getTime() - Date.now();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        return days;
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-12">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-white text-sm font-medium transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
                    {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Package className="w-6 h-6 text-indigo-600" />
                        <h1 className="text-2xl font-bold text-gray-900">Subscription Packages</h1>
                    </div>
                    <p className="text-gray-500 text-sm">Kelola paket langganan dan limit kuota untuk pelanggan</p>
                </div>
                <Button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-lg shadow-indigo-200">
                    <Plus className="w-4 h-4" /> Tambah Package
                </Button>
            </div>

            {/* Toolbar */}
            <div className="flex gap-3 items-center">
                <div className="flex-1 relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Cari berdasarkan nama paket..."
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>
                <Button variant="outline" size="icon" onClick={() => fetchPackages()} title="Refresh">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b">
                                <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Package Info</th>
                                <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Harga</th>
                                <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Durasi</th>
                                <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Limit Sesi WhatsApp</th>
                                <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Limit Quota</th>
                                <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Status</th>
                                <th className="text-right px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <tr key={i}>
                                        {Array.from({ length: 7 }).map((_, j) => (
                                            <td key={j} className="px-5 py-4">
                                                <div className="h-4 bg-gray-100 rounded animate-pulse" />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-5 py-16 text-center">
                                        <div className="flex flex-col items-center gap-3 text-gray-400">
                                            <Package className="w-12 h-12" />
                                            <p className="font-medium">Tidak ada package ditemukan</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(pkg => (
                                    <tr key={pkg.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-5 py-4">
                                            <div className="font-semibold text-gray-900">{pkg.name}</div>
                                            <div className="text-xs text-gray-500 max-w-xs truncate" title={pkg.description}>{pkg.description}</div>
                                        </td>
                                        <td className="px-5 py-4 font-medium text-gray-700">{fmtCurrency(pkg.price)}</td>
                                        <td className="px-5 py-4 text-gray-600">
                                            <div>{pkg.duration_days} Hari</div>
                                            {pkg.is_trial_enabled && (
                                                <div className="text-xs text-amber-600 font-medium mt-0.5">
                                                    Trial: {pkg.trial_days || 7} hari
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className={`px-2.5 py-1.5 rounded-lg text-sm font-medium ${pkg.max_sessions !== -1 && pkg.connected_sessions !== undefined && pkg.connected_sessions >= pkg.max_sessions ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    <b>{pkg.connected_sessions ?? 0}</b> / {pkg.max_sessions === -1 ? '∞' : pkg.max_sessions}
                                                </div>
                                                {pkg.max_sessions !== -1 && pkg.connected_sessions !== undefined && pkg.connected_sessions >= pkg.max_sessions && (
                                                    <span className="text-xs text-red-600 font-medium">Full!</span>
                                                )}
                                            </div>
                                            {pkg.total_users !== undefined && pkg.total_users > 0 && (
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {pkg.total_users} pengguna aktif
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="text-xs text-gray-600 block">Broadcast: <b>{pkg.broadcast_limit === -1 ? '∞ Unlimited' : pkg.broadcast_limit}</b></span>
                                            <span className="text-xs text-gray-600 block mt-1">AI: <b>{pkg.ai_limit === -1 ? '∞ Unlimited' : pkg.ai_limit}</b></span>
                                            <span className="text-xs text-gray-600 block mt-1">Bots: <b>{pkg.max_bots === -1 ? '∞ Unlimited' : pkg.max_bots}</b></span>
                                        </td>
                                        <td className="px-5 py-4">
                                            {pkg.is_active
                                                ? <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded-full text-xs font-medium w-fit"><CheckCircle2 className="w-3 h-3" />Aktif</span>
                                                : <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 rounded-full text-xs font-medium w-fit"><XCircle className="w-3 h-3" />Nonaktif</span>}
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => openEdit(pkg)} className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors">
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => setDeletePkg(pkg)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals */}
            <PackageModal
                open={modalOpen} mode={modalMode} initial={editPkg}
                onClose={() => setModalOpen(false)}
                onSaved={(msg) => { showToast(msg); fetchPackages(); }}
            />
            {deletePkg && (
                <DeleteConfirm
                    pkg={deletePkg} onClose={() => setDeletePkg(null)}
                    onDeleted={() => { showToast('Package berhasil dihapus!'); fetchPackages(); }}
                />
            )}

            {/* ─── Licenses Section ─── */}
            <div className="mt-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Key className="w-6 h-6 text-purple-600" />
                            <h2 className="text-xl font-bold text-gray-900">License Keys</h2>
                        </div>
                        <p className="text-gray-500 text-sm">Semua lisensi yang sudah di-generate</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                value={licSearch}
                                onChange={e => setLicSearch(e.target.value)}
                                placeholder="Cari key atau paket..."
                                className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none w-56"
                            />
                        </div>
                        <Button variant="outline" size="icon" onClick={fetchLicenses} title="Refresh">
                            <RefreshCw className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                <div className="bg-white rounded-xl border shadow-sm overflow-hidden mt-4">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b">
                                    <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">License Key</th>
                                    <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Package</th>
                                    <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Status</th>
                                    <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Used By</th>
                                    <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Expires / Sisa</th>
                                    <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Generated At</th>
                                    <th className="text-right px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredLic.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-5 py-14 text-center">
                                            <div className="flex flex-col items-center gap-3 text-gray-400">
                                                <Key className="w-12 h-12" />
                                                <p className="font-medium">Belum ada lisensi yang di-generate</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredLic.map(lic => {
                                    const sc = statusConfig[lic.status] || statusConfig.available;
                                    const remaining = getRemainingDays(lic.expires_at);
                                    return (
                                        <tr key={lic.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-2">
                                                    <code className="bg-purple-50 px-2 py-0.5 rounded font-mono text-purple-700 text-xs border border-purple-100">
                                                        {lic.key}
                                                    </code>
                                                    <button
                                                        onClick={() => copyToClipboard(lic.key)}
                                                        className="text-gray-400 hover:text-purple-600 transition-colors"
                                                        title="Copy key"
                                                    >
                                                        <Copy className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3 font-medium text-gray-700">
                                                {lic.subscription_package?.name || '—'}
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${sc.cls}`}>
                                                    {sc.label}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-gray-600 text-xs">
                                                {lic.used_by_user ? (
                                                    <div>
                                                        <div className="font-medium text-gray-800">{lic.used_by_user.name}</div>
                                                        <div className="text-gray-400">{lic.used_by_user.email}</div>
                                                    </div>
                                                ) : <span className="text-gray-400">—</span>}
                                            </td>
                                            <td className="px-5 py-3 text-xs">
                                                {lic.expires_at ? (
                                                    <div>
                                                        <div className="text-gray-600">{format(new Date(lic.expires_at), 'dd MMM yyyy')}</div>
                                                        {remaining !== null && (
                                                            <div className={remaining <= 7 ? 'text-red-600 font-medium' : 'text-gray-400'}>
                                                                {remaining > 0 ? `${remaining} hari lagi` : 'Expired'}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : <span className="text-gray-400">—</span>}
                                            </td>
                                            <td className="px-5 py-3 text-gray-500 text-xs">
                                                {format(new Date(lic.created_at), 'dd MMM yyyy, HH:mm')}
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    {lic.status === 'active' && (
                                                        <button
                                                            onClick={() => handleRevokeLicense(lic.id)}
                                                            className="p-1.5 rounded-lg hover:bg-orange-50 text-gray-400 hover:text-orange-600 transition-colors"
                                                            title="Revoke License"
                                                        >
                                                            <ShieldOff className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDeleteLicense(lic.id)}
                                                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                                                        title="Delete License"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {userRole === 'SuperAdmin' && (
                <>
                    {/* ─── Promo Codes Section ─── */}
                    <div className="mt-8">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <Award className="w-6 h-6 text-pink-600" />
                                    <h2 className="text-xl font-bold text-gray-900">Promo Codes</h2>
                                </div>
                                <p className="text-gray-500 text-sm">Kelola kode promo dan diskon langganan</p>
                            </div>
                            <Button onClick={() => setPromoModalOpen(true)} className="bg-pink-600 hover:bg-pink-700 text-white gap-2">
                                <Plus className="w-4 h-4" /> Tambah Promo
                            </Button>
                        </div>

                        <div className="bg-white rounded-xl border shadow-sm overflow-hidden mt-4">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 border-b">
                                        <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase">Kode</th>
                                        <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase">Diskon</th>
                                        <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase">Package</th>
                                        <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase">Usage</th>
                                        <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase">Masa Berlaku</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {promos.length === 0 ? (
                                        <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-400">Belum ada promo</td></tr>
                                    ) : promos.map(p => (
                                        <tr key={p.id} className="hover:bg-gray-50">
                                            <td className="px-5 py-3 font-mono font-bold text-pink-700">{p.code}</td>
                                            <td className="px-5 py-3">{p.discount_type === 'percent' ? `${p.discount_value}%` : fmtCurrency(p.discount_value)}</td>
                                            <td className="px-5 py-3">{p.subscription_package?.name || 'Semua'}</td>
                                            <td className="px-5 py-3">{p.current_uses} / {p.max_uses || '∞'}</td>
                                            <td className="px-5 py-3 text-xs text-gray-500">
                                                {p.start_date ? format(new Date(p.start_date), 'dd/MM') : '—'} sd {p.end_date ? format(new Date(p.end_date), 'dd/MM/yyyy') : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* ─── Affiliates Section ─── */}
                    <div className="mt-8">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <Users className="w-6 h-6 text-green-600" />
                                    <h2 className="text-xl font-bold text-gray-900">Affiliate Codes</h2>
                                </div>
                                <p className="text-gray-500 text-sm">Kelola kode referal dan komisi</p>
                            </div>
                            <Button onClick={() => setAffModalOpen(true)} className="bg-green-600 hover:bg-green-700 text-white gap-2">
                                <Plus className="w-4 h-4" /> Tambah Affiliate
                            </Button>
                        </div>

                        <div className="bg-white rounded-xl border shadow-sm overflow-hidden mt-4">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 border-b">
                                        <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase">Kode</th>
                                        <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase">Pemilik (User)</th>
                                        <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase">Komisi (%)</th>
                                        <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase">Clicks / Uses</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {affiliates.length === 0 ? (
                                        <tr><td colSpan={4} className="px-5 py-10 text-center text-gray-400">Belum ada affiliate</td></tr>
                                    ) : affiliates.map(a => (
                                        <tr key={a.id} className="hover:bg-gray-50">
                                            <td className="px-5 py-3 font-mono font-bold text-green-700">{a.code}</td>
                                            <td className="px-5 py-3 text-xs">
                                                {a.user ? (<div><div>{a.user.name}</div><div className="text-gray-400">{a.user.email}</div></div>) : a.user_id}
                                            </td>
                                            <td className="px-5 py-3">{a.commission_rate}%</td>
                                            <td className="px-5 py-3">N/A</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* Modals for Promos/Affiliates */}
            <PromoModal open={promoModalOpen} onClose={() => setPromoModalOpen(false)} onSaved={(msg) => { showToast(msg); fetchPromos(); }} packages={packages} />
            <AffiliateModal open={affModalOpen} onClose={() => setAffModalOpen(false)} onSaved={(msg) => { showToast(msg); fetchAffiliates(); }} />
        </div>
    );
}
