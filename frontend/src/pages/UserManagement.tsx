import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Edit, Trash2, Search, RefreshCw, ShieldCheck, User as UserIcon,
  CheckCircle2, XCircle, Bot, X, Eye, EyeOff, ChevronLeft, ChevronRight,
  AlertTriangle, ExternalLink, Package, Send
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SUPER_ADMIN } from '@/constants/roles';

/* ─────────────── Types ─────────────── */
interface User {
  id: string;
  name: string;
  username: string;
  email?: string;
  role_id: string;
  is_active: boolean;
  is_verify: boolean;
  ai_quota: number;
  broadcast_quota: number;
  subscription_package?: { name: string; is_active: boolean; id: string };
  subscription_expired_at?: string;
  created_at: string;
}

interface SubscriptionPackage {
  id: string;
  name: string;
  price: number;
}

interface FormState {
  name: string;
  username: string;
  email: string;
  password: string;
  role_id: string;
  is_active: boolean;
  is_verify: boolean;
  ai_quota: number;
}

const EMPTY_FORM: FormState = {
  name: '', username: '', email: '', password: '',
  role_id: 'customer', is_active: true, is_verify: true, ai_quota: 100,
};

const token = () => localStorage.getItem('auth_token') || '';
const API = '/api/users';

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(API + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}`, ...opts?.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data as T;
}

/* ─────────────── Helpers ─────────────── */
function RoleBadge({ role }: { role: string }) {
  if (role === SUPER_ADMIN)
    return <Badge className="bg-purple-100 text-purple-800 border-purple-200 gap-1"><ShieldCheck className="w-3 h-3" />Super Admin</Badge>;
  return <Badge className="bg-blue-100 text-blue-800 border-blue-200 gap-1"><UserIcon className="w-3 h-3" />Customer</Badge>;
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const colors = ['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`w-9 h-9 rounded-full ${color} flex items-center justify-center text-white text-sm font-semibold flex-shrink-0`}>
      {initials}
    </div>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ─────────────── Modal ─────────────── */
function UserModal({
  open, mode, initial, onClose, onSaved,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  initial?: User;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (mode === 'edit' && initial) {
      setForm({
        name: initial.name,
        username: initial.username,
        email: initial.email || '',
        password: '',
        role_id: initial.role_id,
        is_active: initial.is_active,
        is_verify: initial.is_verify,
        ai_quota: initial.ai_quota,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setError('');
  }, [open, mode, initial]);

  const set = (k: keyof FormState, v: any) => setForm(p => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body: any = { ...form };
      if (mode === 'edit' && !body.password) delete body.password;
      if (mode === 'create') {
        await apiFetch('/new', { method: 'POST', body: JSON.stringify(body) });
        onSaved('User berhasil dibuat!');
      } else {
        await apiFetch(`/edit/${initial!.id}`, { method: 'PUT', body: JSON.stringify(body) });
        onSaved('User berhasil diupdate!');
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
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${mode === 'create' ? 'bg-green-100' : 'bg-blue-100'}`}>
              {mode === 'create'
                ? <Plus className="w-5 h-5 text-green-600" />
                : <Edit className="w-5 h-5 text-blue-600" />}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {mode === 'create' ? 'Tambah User Baru' : 'Edit User'}
              </h2>
              {mode === 'edit' && <p className="text-sm text-gray-500">{initial?.username}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Lengkap <span className="text-red-500">*</span></label>
              <input required value={form.name} onChange={e => set('name', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                placeholder="John Doe" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Username <span className="text-red-500">*</span></label>
              <input required value={form.username} onChange={e => set('username', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                placeholder="johndoe" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                placeholder="john@example.com" />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Password {mode === 'create' && <span className="text-red-500">*</span>}
                {mode === 'edit' && <span className="text-gray-400 font-normal">(kosongkan jika tidak diubah)</span>}
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  required={mode === 'create'}
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                  placeholder="••••••••" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
              <select value={form.role_id} onChange={e => set('role_id', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent transition bg-white">
                <option value="customer">Customer</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">AI Quota</label>
              <div className="relative">
                <Bot className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="number" min={0} value={form.ai_quota} onChange={e => set('ai_quota', parseInt(e.target.value) || 0)}
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent transition" />
              </div>
            </div>
          </div>

          {/* Toggles */}
          <div className="flex gap-4 pt-1">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <div className={`w-10 h-5 rounded-full transition-colors ${form.is_active ? 'bg-green-500' : 'bg-gray-300'} relative`}
                onClick={() => set('is_active', !form.is_active)}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm font-medium text-gray-700">Aktif</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <div className={`w-10 h-5 rounded-full transition-colors ${form.is_verify ? 'bg-blue-500' : 'bg-gray-300'} relative`}
                onClick={() => set('is_verify', !form.is_verify)}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_verify ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm font-medium text-gray-700">Terverifikasi</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Batal</Button>
            <Button
              type="submit"
              disabled={saving}
              className={`min-w-[120px] ${mode === 'create' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
            >
              {saving ? 'Menyimpan...' : mode === 'create' ? 'Buat User' : 'Simpan Perubahan'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─────────────── Subscription Modal ─────────────── */
function SubscriptionModal({
  open, user, packages, onClose, onSaved,
}: {
  open: boolean;
  user?: User;
  packages: SubscriptionPackage[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [selectedPkg, setSelectedPkg] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setSelectedPkg(user?.subscription_package?.id || '');
    setError('');
  }, [open, user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPkg) {
      setError('Pilih minimal satu package'); return;
    }
    setSaving(true);
    setError('');
    try {
      await apiFetch(`/${user!.id}/subscribe`, {
        method: 'POST',
        body: JSON.stringify({ package_id: selectedPkg })
      });
      onSaved('Subscription berhasil dipasang!');
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!open || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-100">
              <Package className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Pasang Paket</h2>
              <p className="text-sm text-gray-500">{user.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Package</label>
            <div className="space-y-2">
              {packages.map(p => (
                <label key={p.id} className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${selectedPkg === p.id ? 'border-indigo-500 bg-indigo-50/50' : 'hover:bg-gray-50'}`}>
                  <input type="radio" name="package" value={p.id} checked={selectedPkg === p.id} onChange={(e) => setSelectedPkg(e.target.value)} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                  <span className="ml-3 font-medium text-gray-900">{p.name}</span>
                </label>
              ))}
              {packages.length === 0 && <p className="text-sm text-gray-500">Tidak ada package tersedia.</p>}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" className="flex-1" variant="outline" onClick={onClose} disabled={saving}>Batal</Button>
            <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white" disabled={saving || !selectedPkg}>
              {saving ? 'Processing...' : 'Apply'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─────────────── Delete Confirm ─────────────── */
function DeleteConfirm({ user, onClose, onDeleted }: { user: User; onClose: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handle = async () => {
    setDeleting(true);
    try {
      await apiFetch(`/remove/${user.id}`, { method: 'DELETE' });
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
        <h3 className="text-lg font-semibold text-gray-900 text-center">Hapus User</h3>
        <p className="text-sm text-gray-500 text-center mt-1 mb-5">
          Yakin ingin menghapus <strong>{user.name}</strong>? Aksi ini tidak dapat dibatalkan.
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

/* ─────────────── Main Page ─────────────── */
export default function UserManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);

  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [modalOpen, setModalOpen] = useState(false);
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [activeUser, setActiveUser] = useState<User | undefined>();
  const [deleteUser, setDeleteUser] = useState<User | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchUsers = useCallback(async (p = page, q = search) => {
    setLoading(true);
    try {
      const res = await apiFetch<any>(`/paginate?page=${p}&limit=10&search=${encodeURIComponent(q)}`);
      setUsers(res.data || []);
      setTotal(res.total || 0);
      setTotalPages(res.total_pages || 1);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers(page, search);
    // Fetch packages for the subscription modal
    fetch('/api/subscription-packages', {
      headers: { Authorization: `Bearer ${token()}` }
    }).then(res => res.json()).then(data => setPackages(data.data || []));
  }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers(1, search);
  };

  const openCreate = () => { setModalMode('create'); setActiveUser(undefined); setModalOpen(true); };
  const openEdit = (u: User) => { setModalMode('edit'); setActiveUser(u); setModalOpen(true); };
  const openSub = (u: User) => { setActiveUser(u); setSubModalOpen(true); };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-white text-sm font-medium transition-all animate-in slide-in-from-top-5 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-6 h-6 text-purple-600" />
            <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          </div>
          <p className="text-gray-500 text-sm">Kelola pengguna sistem — hanya Super Admin yang dapat mengakses halaman ini</p>
        </div>
        <Button onClick={openCreate} className="bg-purple-600 hover:bg-purple-700 text-white gap-2 shadow-lg shadow-purple-200">
          <Plus className="w-4 h-4" /> Tambah User
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Users', value: total, icon: UserIcon, color: 'text-blue-600 bg-blue-50' },
          { label: 'Super Admin', value: users.filter(u => u.role_id === SUPER_ADMIN).length, icon: ShieldCheck, color: 'text-purple-600 bg-purple-50' },
          { label: 'Aktif', value: users.filter(u => u.is_active).length, icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
          { label: 'AI Quota Total', value: users.reduce((s, u) => s + u.ai_quota, 0), icon: Bot, color: 'text-amber-600 bg-amber-50' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.color}`}>
              <s.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex gap-3 items-center">
        <form onSubmit={handleSearch} className="flex-1 relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama, username, atau email..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </form>
        <Button variant="outline" size="icon" onClick={() => fetchUsers(page, search)} title="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">User</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Role & Package</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Kuotas</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Dibuat</th>
                <th className="text-right px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <UserIcon className="w-12 h-12" />
                      <p className="font-medium">Tidak ada user ditemukan</p>
                      {search && <p className="text-sm">Coba ubah kata kunci pencarian</p>}
                    </div>
                  </td>
                </tr>
              ) : (
                users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={user.name} />
                        <div>
                          <div className="font-medium text-gray-900">{user.name}</div>
                          <div className="text-xs text-gray-400">@{user.username}</div>
                          {user.email && <div className="text-xs text-gray-400">{user.email}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        <RoleBadge role={user.role_id} />
                        {user.subscription_package && (
                          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 mt-1 gap-1 py-0 px-1.5 text-[10px]">
                            <Package className="w-3 h-3" /> {user.subscription_package.name}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Bot className="w-3.5 h-3.5 text-amber-500" />
                          <span className="font-semibold text-gray-800">{user.ai_quota}</span>
                          <span className="text-gray-400">AI</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          <Send className="w-3.5 h-3.5 text-blue-500" />
                          <span className="font-semibold text-gray-800">{user.broadcast_quota}</span>
                          <span className="text-gray-400">BC</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1">
                        {user.is_active
                          ? <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded-full text-xs font-medium w-fit"><CheckCircle2 className="w-3 h-3" />Aktif</span>
                          : <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 rounded-full text-xs font-medium w-fit"><XCircle className="w-3 h-3" />Nonaktif</span>}
                        {user.is_verify
                          ? <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full text-xs font-medium w-fit"><CheckCircle2 className="w-3 h-3" />Terverifikasi</span>
                          : <span className="text-xs text-gray-400">Belum diverifikasi</span>}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs">{fmtDate(user.created_at)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/users/${user.id}`)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:border-purple-300 transition-all shadow-sm"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Detail
                        </button>
                        <button
                          onClick={() => openSub(user)}
                          className="p-1.5 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-colors"
                          title="Assign Package"
                        >
                          <Package className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEdit(user)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteUser(user)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                          title="Hapus"
                        >
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t bg-gray-50 text-sm text-gray-600">
            <p>Menampilkan halaman <span className="font-semibold">{page}</span> dari <span className="font-semibold">{totalPages}</span> ({total} user)</p>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = page <= 3 ? i + 1 : page - 2 + i;
                if (p < 1 || p > totalPages) return null;
                return (
                  <Button key={p} variant={p === page ? 'default' : 'outline'} size="icon" className="h-8 w-8 text-xs"
                    onClick={() => setPage(p)}>
                    {p}
                  </Button>
                );
              })}
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <UserModal
        open={modalOpen}
        mode={modalMode}
        initial={activeUser}
        onClose={() => setModalOpen(false)}
        onSaved={(msg) => { showToast(msg); fetchUsers(page, search); }}
      />

      <SubscriptionModal
        open={subModalOpen}
        user={activeUser}
        packages={packages}
        onClose={() => setSubModalOpen(false)}
        onSaved={(msg) => { showToast(msg); fetchUsers(page, search); }}
      />

      {deleteUser && (
        <DeleteConfirm
          user={deleteUser}
          onClose={() => setDeleteUser(null)}
          onDeleted={() => { showToast('User berhasil dihapus!'); fetchUsers(page, search); }}
        />
      )}
    </div>
  );
}