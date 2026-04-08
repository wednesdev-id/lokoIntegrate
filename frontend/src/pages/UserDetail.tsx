import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Edit, Bot, ShieldCheck, User as UserIcon,
    CheckCircle2, XCircle, Calendar, Mail, AtSign,
    AlertTriangle, RefreshCw, Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SUPER_ADMIN } from '@/constants/roles';

/* ─── Types ─── */
interface User {
    id: string;
    name: string;
    username: string;
    email?: string;
    role_id: string;
    is_active: boolean;
    is_verify: boolean;
    ai_quota: number;
    credits?: number;
    project_count?: number;
    max_projects?: number;
    created_at: string;
}

const token = () => localStorage.getItem('auth_token') || '';

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
    const res = await fetch('/api/users' + path, {
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

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function Avatar({ name, size = 'lg' }: { name: string; size?: 'sm' | 'lg' }) {
    const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const colors = ['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];
    const color = colors[name.charCodeAt(0) % colors.length];
    const sz = size === 'lg' ? 'w-20 h-20 text-3xl' : 'w-10 h-10 text-base';
    return (
        <div className={`${sz} rounded-2xl ${color} flex items-center justify-center text-white font-bold flex-shrink-0 shadow-lg`}>
            {initials}
        </div>
    );
}

/* ─── Quota Edit Inline ─── */
function QuotaEditor({ userId, initial, onSaved }: { userId: string; initial: number; onSaved: (q: number) => void }) {
    const [quota, setQuota] = useState(initial);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);

    const save = async () => {
        setSaving(true);
        try {
            await apiFetch(`/${userId}/quota`, {
                method: 'PUT',
                body: JSON.stringify({ ai_quota: quota }),
            });
            onSaved(quota);
            setEditing(false);
        } finally {
            setSaving(false);
        }
    };

    if (!editing) {
        return (
            <div className="flex items-center gap-3">
                <span className="text-3xl font-bold text-gray-900">{initial}</span>
                <Button variant="outline" size="sm" onClick={() => { setQuota(initial); setEditing(true); }}>
                    <Edit className="w-3 h-3 mr-1" /> Ubah
                </Button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <input
                type="number"
                min={0}
                value={quota}
                onChange={e => setQuota(parseInt(e.target.value) || 0)}
                className="w-24 px-3 py-1.5 border-2 border-purple-400 rounded-lg text-lg font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={save} disabled={saving}>
                {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                {saving ? '' : 'Simpan'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Batal</Button>
        </div>
    );
}

/* ─── UserDetail Page ─── */
export default function UserDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [toast, setToast] = useState('');

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    };

    const fetchUser = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await apiFetch<User>(`/detail/${id}`);
            setUser(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { if (id) fetchUser(); }, [id]);

    const toggleStatus = async (field: 'is_active' | 'is_verify') => {
        if (!user) return;
        const body = { [field]: !user[field] };
        try {
            await apiFetch(`/edit/${user.id}`, { method: 'PUT', body: JSON.stringify(body) });
            setUser(prev => prev ? { ...prev, [field]: !prev[field] } : prev);
            showToast('Status berhasil diupdate!');
        } catch (err: any) {
            showToast('Gagal: ' + err.message);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-3 text-gray-400">
                    <RefreshCw className="w-8 h-8 animate-spin" />
                    <p>Memuat data user...</p>
                </div>
            </div>
        );
    }

    if (error || !user) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">{error || 'User tidak ditemukan'}</h2>
                    <Button variant="outline" onClick={() => navigate('/users')}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-12">
            {/* Toast */}
            {toast && (
                <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium flex items-center gap-2 animate-in slide-in-from-top-5">
                    <CheckCircle2 className="w-4 h-4" /> {toast}
                </div>
            )}

            {/* Breadcrumb / Back */}
            <div className="flex items-center gap-2 text-sm text-gray-500">
                <button onClick={() => navigate('/users')} className="hover:text-purple-600 flex items-center gap-1 transition-colors">
                    <ArrowLeft className="w-4 h-4" /> User Management
                </button>
                <span>/</span>
                <span className="text-gray-900 font-medium">{user.name}</span>
            </div>

            {/* Profile Hero */}
            <div className="bg-gradient-to-br from-purple-600 to-violet-700 rounded-2xl p-6 text-white shadow-xl">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                    <Avatar name={user.name} size="lg" />
                    <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h1 className="text-2xl font-bold">{user.name}</h1>
                            {user.role_id === SUPER_ADMIN
                                ? <Badge className="bg-white/20 text-white border-white/30 gap-1"><ShieldCheck className="w-3 h-3" />Super Admin</Badge>
                                : <Badge className="bg-white/20 text-white border-white/30 gap-1"><UserIcon className="w-3 h-3" />Customer</Badge>}
                        </div>
                        <div className="flex flex-wrap gap-4 text-purple-200 text-sm">
                            {user.username && (
                                <span className="flex items-center gap-1.5">
                                    <AtSign className="w-3.5 h-3.5" />{user.username}
                                </span>
                            )}
                            {user.email && (
                                <span className="flex items-center gap-1.5">
                                    <Mail className="w-3.5 h-3.5" />{user.email}
                                </span>
                            )}
                            <span className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5" /> Bergabung {fmtDate(user.created_at)}
                            </span>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        className="border-white/40 text-white hover:bg-white/20 hover:text-white bg-white/10"
                        onClick={() => navigate(`/users`, { state: { editUser: user } })}
                    >
                        <Edit className="w-4 h-4 mr-2" /> Edit User
                    </Button>
                </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                {/* AI Quota Card */}
                <div className="sm:col-span-2 bg-white rounded-2xl border shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                            <Bot className="w-5 h-5 text-amber-600" />
                        </div>
                        <h2 className="font-semibold text-gray-900">AI Quota</h2>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">Jumlah balasan AI otomatis yang tersedia untuk user ini.</p>
                    <QuotaEditor
                        userId={user.id}
                        initial={user.ai_quota}
                        onSaved={q => {
                            setUser(prev => prev ? { ...prev, ai_quota: q } : prev);
                            showToast('AI Quota berhasil diupdate!');
                        }}
                    />
                    <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, (user.ai_quota / 1000) * 100)}%` }}
                        />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{user.ai_quota} / 1000 (maks tampilan)</p>
                </div>

                {/* Status Card */}
                <div className="bg-white rounded-2xl border shadow-sm p-6">
                    <h2 className="font-semibold text-gray-900 mb-4">Status Akun</h2>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-700">Aktif</p>
                                <p className="text-xs text-gray-400">Bisa login ke sistem</p>
                            </div>
                            <button
                                onClick={() => toggleStatus('is_active')}
                                className={`w-11 h-6 rounded-full transition-colors relative ${user.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
                            >
                                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${user.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                            </button>
                        </div>
                        <div className="border-t pt-3 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-700">Terverifikasi</p>
                                <p className="text-xs text-gray-400">Email sudah dikonfirmasi</p>
                            </div>
                            <button
                                onClick={() => toggleStatus('is_verify')}
                                className={`w-11 h-6 rounded-full transition-colors relative ${user.is_verify ? 'bg-blue-500' : 'bg-gray-300'}`}
                            >
                                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${user.is_verify ? 'translate-x-5' : 'translate-x-0.5'}`} />
                            </button>
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                            {user.is_active
                                ? <><CheckCircle2 className="w-4 h-4 text-green-500" /><span className="text-green-700">Akun Aktif</span></>
                                : <><XCircle className="w-4 h-4 text-red-500" /><span className="text-red-700">Akun Nonaktif</span></>}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            {user.is_verify
                                ? <><CheckCircle2 className="w-4 h-4 text-blue-500" /><span className="text-blue-700">Terverifikasi</span></>
                                : <><XCircle className="w-4 h-4 text-gray-400" /><span className="text-gray-500">Belum Verifikasi</span></>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Additional Info */}
            <div className="bg-white rounded-2xl border shadow-sm p-6">
                <h2 className="font-semibold text-gray-900 mb-4">Informasi Akun</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                        { label: 'User ID', value: user.id.slice(0, 8) + '...', mono: true },
                        { label: 'Role', value: user.role_id === SUPER_ADMIN ? 'Super Admin' : 'Customer' },
                        { label: 'Credits', value: (user.credits ?? 0).toString() },
                        { label: 'Tanggal Bergabung', value: fmtDate(user.created_at) },
                    ].map(item => (
                        <div key={item.label}>
                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{item.label}</p>
                            <p className={`text-sm font-medium text-gray-900 ${item.mono ? 'font-mono' : ''}`}>{item.value}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
