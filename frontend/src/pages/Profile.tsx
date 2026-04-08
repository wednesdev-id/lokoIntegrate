import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useUser } from '@/contexts/UserContext';
import userService from '@/services/user.service';
import authService from '@/services/auth.service';
import { 
  Mail, UserCircle, LogOut, MapPin, Briefcase, 
  Settings, Shield, CreditCard, LayoutDashboard, 
  CheckCircle2, Clock, Zap, Star
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/common/ToastProvider';

const Profile: React.FC = () => {
  const { user, refreshUser, loading } = useUser();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // State for Edit Profile
  const [profileForm, setProfileForm] = useState({
    name: '',
    business_address: '',
    business_sector: ''
  });
  
  // State for Password Change
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        business_address: user.business_address || '',
        business_sector: user.business_sector || ''
      });
    }
  }, [user]);

  const handleLogout = async () => {
    try {
      await authService.logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  const onUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    try {
      await userService.updateProfile(profileForm);
      toast({
        title: "Profil Diperbarui",
        description: "Informasi profil Anda berhasil disimpan."
      });
      await refreshUser();
    } catch (error: any) {
      toast({
        title: "Gagal Memperbarui",
        description: error.message || "Terjadi kesalahan saat menyimpan profil.",
        variant: "destructive"
      });
    } finally {
      setUpdating(false);
    }
  };

  const onUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast({
        title: "Konfirmasi Password Salah",
        description: "Password baru dan konfirmasi tidak cocok.",
        variant: "destructive"
      });
      return;
    }
    
    setUpdating(true);
    try {
      await userService.updatePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password
      });
      toast({
        title: "Password Diperbarui",
        description: "Keamanan akun Anda telah diperbarui."
      });
      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: ''
      });
    } catch (error: any) {
      toast({
        title: "Gagal Ganti Password",
        description: error.message || "Terjadi kesalahan saat mengganti password.",
        variant: "destructive"
      });
    } finally {
      setUpdating(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen space-y-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 font-medium">Memuat data profil...</p>
      </div>
    );
  }

  const initials = (user.name || 'User')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

  const roleLabel = user.role_code === 'super_admin' ? 'Super Admin' : 'Customer';

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="relative">
            <Avatar className="h-28 w-28 border-4 border-white shadow-xl ring-2 ring-blue-100">
              <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.username}`} alt={user.name} />
              <AvatarFallback className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white text-2xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 bg-green-500 border-2 border-white w-6 h-6 rounded-full shadow-sm"></div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">{user.name}</h1>
              <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100 px-3 py-1 text-xs font-semibold">
                {roleLabel}
              </Badge>
            </div>
            <p className="text-gray-500 flex items-center gap-2">
              <Mail className="h-4 w-4" /> {user.username}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleLogout} className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700">
            <LogOut className="mr-2 h-4 w-4" /> Keluar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full space-y-6">
        <TabsList className="bg-gray-100/50 p-1 border border-gray-200 rounded-xl w-full md:w-auto grid md:flex grid-cols-3">
          <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <LayoutDashboard className="mr-2 h-4 w-4" /> Ringkasan
          </TabsTrigger>
          <TabsTrigger value="account" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <UserCircle className="mr-2 h-4 w-4" /> Akun & Bisnis
          </TabsTrigger>
          <TabsTrigger value="security" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Shield className="mr-2 h-4 w-4" /> Keamanan
          </TabsTrigger>
        </TabsList>

        {/* Tab Content: Overview */}
        <TabsContent value="overview" className="space-y-6 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Subscription Card */}
            <Card className="col-span-1 md:col-span-1 border-none bg-gradient-to-br from-blue-600 to-indigo-800 text-white shadow-lg shadow-blue-200/50 overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Star className="h-32 w-32" />
              </div>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Zap className="h-5 w-5 text-yellow-300 fill-yellow-300" /> Paket Premium
                </CardTitle>
                <CardDescription className="text-blue-100">Status langganan Anda aktif</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-blue-200 font-semibold mb-1">Berlaku Hingga</p>
                    <p className="text-lg font-bold">
                      {user.subscription_expired_at ? new Date(user.subscription_expired_at).toLocaleDateString('id-ID', {
                        day: 'numeric', month: 'long', year: 'numeric'
                      }) : 'Lifetime Access'}
                    </p>
                  </div>
                  <Separator className="bg-blue-500/50" />
                  <div className="flex justify-between items-center text-sm">
                    <span>Fitur Prioritas</span>
                    <CheckCircle2 className="h-4 w-4 text-green-300" />
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button size="sm" variant="secondary" className="w-full bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm">
                  Lihat Detail Tagihan
                </Button>
              </CardFooter>
            </Card>

            {/* Quota Cards */}
            <div className="col-span-1 md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Card className="border-gray-200/50 shadow-sm transition-all hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-medium text-gray-500">AI Tokens / Quota</CardTitle>
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                      <Star className="h-4 w-4" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-gray-900">{user.ai_quota || 0}</p>
                  <div className="mt-4 w-full bg-gray-100 rounded-full h-2">
                    <div 
                      className="bg-purple-500 h-2 rounded-full" 
                      style={{ width: `${Math.min(((user.ai_quota || 0) / 1000) * 100, 100)}%` }}
                    ></div>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">Batas bulanan: 1,000 unit</p>
                </CardContent>
              </Card>

              <Card className="border-gray-200/50 shadow-sm transition-all hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-medium text-gray-500">WhatsApp Broadcast</CardTitle>
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                      <Zap className="h-4 w-4" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-gray-900">{user.broadcast_quota || 0}</p>
                  <div className="mt-4 w-full bg-gray-100 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ width: `${Math.min(((user.broadcast_quota || 0) / 100) * 100, 100)}%` }}
                    ></div>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">Batas bulanan: 100 pesan</p>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="border-gray-200/50 shadow-sm overflow-hidden">
            <CardHeader className="border-b bg-gray-50/50">
              <CardTitle className="text-lg">Informasi Bisnis & Kontak</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 bg-gray-100 text-gray-600 rounded-lg">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Alamat Usaha</p>
                      <p className="text-sm text-gray-500 leading-relaxed mt-1">
                        {user.business_address || 'Pengaturan alamat belum dilengkapi.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 bg-gray-100 text-gray-600 rounded-lg">
                      <Briefcase className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Sektor Bisnis</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {user.business_sector || 'Sektor bisnis belum diatur.'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 bg-gray-100 text-gray-600 rounded-lg">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Tanggal Bergabung</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Didaftarkan sejak {new Date(user.created_at || Date.now()).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 bg-gray-100 text-gray-600 rounded-lg">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Verifikasi Akun</p>
                      <p className="text-sm text-gray-500 mt-1">Akun ini telah melalui proses verifikasi keamanan.</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Content: Account */}
        <TabsContent value="account" className="animate-in fade-in duration-500">
          <Card className="border-gray-200/50 shadow-sm overflow-hidden">
            <form onSubmit={onUpdateProfile}>
              <CardHeader>
                <CardTitle>Edit Informasi Profil</CardTitle>
                <CardDescription>Perbarui data diri dan informasi bisnis Anda di sini.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nama Lengkap</Label>
                    <Input 
                      id="name" 
                      placeholder="Masukkan nama lengkap" 
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                      required
                      className="border-gray-200 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email / Username (Read-only)</Label>
                    <Input 
                      id="email" 
                      value={user.username} 
                      disabled 
                      className="bg-gray-50 cursor-not-allowed border-gray-200"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sector">Sektor / Bidang Bisnis</Label>
                  <Input 
                    id="sector" 
                    placeholder="Contoh: Kuliner, Retail, Jasa IT" 
                    value={profileForm.business_sector}
                    onChange={(e) => setProfileForm({ ...profileForm, business_sector: e.target.value })}
                    className="border-gray-200 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Alamat Bisnis</Label>
                  <textarea 
                    id="address" 
                    rows={4}
                    placeholder="Masukkan alamat bisnis Anda secara lengkap" 
                    value={profileForm.business_address}
                    onChange={(e) => setProfileForm({ ...profileForm, business_address: e.target.value })}
                    className="flex w-full rounded-md border border-gray-200 bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </CardContent>
              <CardFooter className="bg-gray-50/50 border-t flex justify-end gap-3 px-6 py-4">
                <Button type="button" variant="outline" disabled={updating}>Batalkan</Button>
                <Button type="submit" disabled={updating} className="bg-blue-600 hover:bg-blue-700">
                  {updating ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        {/* Tab Content: Security */}
        <TabsContent value="security" className="animate-in fade-in duration-500">
          <Card className="border-gray-200/50 shadow-sm overflow-hidden border-orange-100">
            <form onSubmit={onUpdatePassword}>
              <CardHeader className="bg-orange-50/30">
                <CardTitle className="text-orange-900">Ubah Password</CardTitle>
                <CardDescription className="text-orange-800">Pastikan Anda menggunakan kombinasi karakter yang kuat.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="space-y-2 max-w-md">
                  <Label htmlFor="current-pass">Password Saat Ini</Label>
                  <Input 
                    id="current-pass" 
                    type="password" 
                    placeholder="••••••••" 
                    value={passwordForm.current_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                    required
                    className="border-gray-200 focus:ring-orange-500"
                  />
                </div>
                
                <Separator className="bg-gray-100" />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
                  <div className="space-y-2">
                    <Label htmlFor="new-pass">Password Baru</Label>
                    <Input 
                      id="new-pass" 
                      type="password" 
                      placeholder="••••••••" 
                      value={passwordForm.new_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                      required
                      className="border-gray-200 focus:ring-orange-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-pass">Konfirmasi Password Baru</Label>
                    <Input 
                      id="confirm-pass" 
                      type="password" 
                      placeholder="••••••••" 
                      value={passwordForm.confirm_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                      required
                      className="border-gray-200 focus:ring-orange-500"
                    />
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-xs text-gray-500 leading-relaxed font-medium">
                    <Star className="h-3 w-3 inline mr-1 text-orange-400" />
                    Gunakan minimal 8 karakter dengan kombinasi huruf besar, huruf kecil, dan angka untuk keamanan optimal.
                  </p>
                </div>
              </CardContent>
              <CardFooter className="bg-gray-50/50 border-t flex justify-end gap-3 px-6 py-4">
                <Button type="submit" disabled={updating} className="bg-orange-600 hover:bg-orange-700">
                  {updating ? "Memproses..." : "Perbarui Kata Sandi"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Profile;
