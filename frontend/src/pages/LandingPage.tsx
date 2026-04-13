import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import LandingNavbar from '@/components/layout/LandingNavbar';

import {
  Zap, Shield, MessageCircle, Bot, BarChart3,
  Smartphone, CheckCircle2, ArrowRight,
  MessageSquare, TrendingUp, CheckCircle,
  RefreshCw, Activity, Send, UserPlus, Sparkles, ArrowUpRight,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Check authentication status
    const token = localStorage.getItem('auth_token');
    const isAuthenticated = !!token;
    setIsLoggedIn(isAuthenticated);

    // Auto-redirect to dashboard if already logged in
    if (token) {
      navigate('/dashboard');
    }
  }, [navigate]);

  useEffect(() => {
    // Gunakan data dummy agar langsung tampil tanpa menunggu API (backend belum di-deploy)
    setPackages([
        {
            id: '1',
            name: 'Starter',
            description: 'Untuk bisnis kecil yang baru memulai otomatisasi.',
            price: 0,
            broadcast_limit: 10,
            ai_limit: 50,
            max_sessions: 1,
            duration_days: 7,
            is_trial_enabled: true
        },
        {
            id: '2',
            name: 'Pro Business',
            description: 'Solusi lengkap untuk skala bisnis menengah.',
            price: 150000,
            broadcast_limit: 1000,
            ai_limit: 5000,
            max_sessions: 3,
            duration_days: 30,
        },
        {
            id: '3',
            name: 'Enterprise',
            description: 'Performa maksimal untuk kebutuhan korporasi besar.',
            price: 500000,
            broadcast_limit: 10000,
            ai_limit: 25000,
            max_sessions: 10,
            duration_days: 30,
        }
    ]);
    setLoading(false);
  }, []);

  const features = [
    {
      title: 'Manajemen Device',
      desc: 'Hubungkan dan pantau banyak nomor WhatsApp dalam satu dashboard terpusat.',
      icon: <Smartphone className="h-6 w-6 text-blue-600" />,
    },
    {
      title: 'AI Smart Chatbot',
      desc: 'Integrasi OpenRouter AI untuk membalas pesan pelanggan secara otomatis dan cerdas.',
      icon: <Bot className="h-6 w-6 text-purple-600" />,
    },
    {
      title: 'Pesan Broadcast',
      desc: 'Kirim pengumuman, promo, atau update ke ribuan kontak sekaligus dengan aman.',
      icon: <Zap className="h-6 w-6 text-amber-600" />,
    },
    {
      title: 'Analisis Real-time',
      desc: 'Pantau performa pesan dan interaksi pelanggan dengan metrik yang akurat.',
      icon: <BarChart3 className="h-6 w-6 text-green-600" />,
    },
    {
      title: 'Keamanan Tingkat Tinggi',
      desc: 'Enkripsi data dan manajemen lisensi untuk memastikan akun Anda tetap aman.',
      icon: <Shield className="h-6 w-6 text-indigo-600" />,
    },
    {
      title: 'Template Pesan',
      desc: 'Gunakan template untuk konsistensi pesan dan kecepatan respon tim CS Anda.',
      icon: <MessageCircle className="h-6 w-6 text-pink-600" />,
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <LandingNavbar />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-full -z-10 opacity-30 blur-3xl pointer-events-none">
          <div className="absolute top-0 left-0 w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply animate-blob"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply animate-blob animation-delay-2000"></div>
        </div>

        <div className="max-w-7xl mx-auto px-6 text-center">

          <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 tracking-tight leading-tight mb-6">
            Lobi Toko (Loko) <br />
            <span className="bg-gradient-to-r from-blue-600 to-indigo-700 bg-clip-text text-transparent">
              Otomatisasi WhatsApp Tanpa Batas
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
            Kelola banyak nomor WhatsApp, kirim broadcast, dan otomatisasi chat dalam satu dashboard sederhana. Siap digunakan dalam 5 menit.
          </p>
          {!isLoggedIn && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                  onClick={() => navigate('/register')}
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 h-14 rounded-full text-lg shadow-xl shadow-blue-200"
              >
                Mulai Gratis Sekarang <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <a
                href="https://loko.wednesdev.id/dashboard"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="lg" variant="outline" className="px-8 h-14 rounded-full text-lg border-gray-200 text-gray-600">
                  Masuk ke Dashboard
                </Button>
              </a>
            </div>
          )}
          
          <div className="mt-16 relative mx-auto max-w-5xl animate-in zoom-in-95 duration-1000">
            {/* Dashboard Mockup - Based on actual Loko Dashboard */}
            <div className="rounded-3xl border border-white bg-gradient-to-br from-gray-50/90 via-blue-50/80 to-indigo-50/80 backdrop-blur-xl p-6 shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="mb-6 backdrop-blur-xl bg-white/70 rounded-2xl p-4 border border-white/50 shadow-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2.5 h-2.5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full animate-pulse shadow-lg shadow-green-500/50"></div>
                      <span className="text-xs font-medium text-gray-600">Live Dashboard</span>
                    </div>
                    <p className="text-sm text-gray-600 font-medium">Real-time statistics and insights</p>
                  </div>
                  <div className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xs font-medium rounded-lg shadow-lg shadow-blue-500/30 flex items-center gap-1.5">
                    <RefreshCw className="h-3 w-3" />
                    Live
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {[
                  { title: 'Total Sessions', value: '12', desc: 'WhatsApp sessions', icon: Smartphone, variant: 'blue', change: '+12%' },
                  { title: 'Connected', value: '10', desc: 'Active connections', icon: CheckCircle, variant: 'green', change: '+8%' },
                  { title: 'Messages Today', value: '1,284', desc: 'Sent messages', icon: MessageSquare, variant: 'purple', change: '+24%' },
                  { title: 'AI Quota', value: '8,420', desc: 'Auto-reply limits', icon: Zap, variant: 'orange', change: '+32%' }
                ].map((stat, idx) => {
                  const variantStyles = {
                    blue: 'border-blue-200/50 bg-gradient-to-br from-blue-50/80 to-blue-100/40',
                    green: 'border-green-200/50 bg-gradient-to-br from-green-50/80 to-emerald-100/40',
                    purple: 'border-purple-200/50 bg-gradient-to-br from-purple-50/80 to-violet-100/40',
                    orange: 'border-orange-200/50 bg-gradient-to-br from-orange-50/80 to-amber-100/40'
                  };
                  const iconStyles = {
                    blue: 'bg-gradient-to-br from-blue-500 to-blue-600',
                    green: 'bg-gradient-to-br from-green-500 to-emerald-600',
                    purple: 'bg-gradient-to-br from-purple-500 to-violet-600',
                    orange: 'bg-gradient-to-br from-orange-500 to-amber-600'
                  };
                  return (
                    <div key={idx} className={`backdrop-blur-xl bg-white/70 border shadow-lg rounded-xl p-3.5 hover:shadow-xl transition-all duration-300 hover:scale-105 relative ${variantStyles[stat.variant as keyof typeof variantStyles]}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">{stat.title}</span>
                        <div className={`p-1.5 rounded-lg shadow-md ${iconStyles[stat.variant as keyof typeof iconStyles]} text-white`}>
                          <stat.icon className="h-3.5 w-3.5" />
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1.5 mb-1">
                        <div className="text-xl font-bold text-gray-900">{stat.value}</div>
                        {stat.change && (
                          <span className="text-[9px] bg-white/60 text-gray-700 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                            <ArrowUpRight className="h-2 w-2" />
                            {stat.change}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-600">{stat.desc}</p>
                    </div>
                  );
                })}
              </div>

              {/* Quick Actions */}
              <div className="backdrop-blur-xl bg-white/70 border border-white/50 shadow-xl rounded-2xl p-4 mb-5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-indigo-50/30 to-purple-50/50 pointer-events-none" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm font-semibold text-gray-900">Quick Actions</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { label: 'Add Session', desc: 'Create session', icon: UserPlus, gradient: 'from-blue-500 to-indigo-600' },
                      { label: 'Send Message', desc: 'Quick send', icon: Send, gradient: 'from-purple-500 to-pink-600' },
                      { label: 'Broadcast', desc: 'Bulk send', icon: TrendingUp, gradient: 'from-green-500 to-emerald-600' }
                    ].map((action, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-white/60 border border-white/50 hover:bg-white/80 hover:shadow-md transition-all duration-300 group cursor-pointer">
                        <div className={`p-2 rounded-lg bg-gradient-to-br ${action.gradient} text-white shadow-md w-fit mb-2 group-hover:scale-110 transition-transform`}>
                          <action.icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="text-xs font-semibold text-gray-900">{action.label}</div>
                        <div className="text-[10px] text-gray-600">{action.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Recent Activity */}
                <div className="backdrop-blur-xl bg-white/70 border border-white/50 shadow-lg rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-semibold text-gray-900">Recent Activity</span>
                  </div>
                  <div className="space-y-2">
                    {[
                      { text: 'Broadcast sent to 1,234 contacts', time: '2 min ago', status: 'success' },
                      { text: 'AI replied to 47 conversations', time: '15 min ago', status: 'info' }
                    ].map((activity, idx) => (
                      <div key={idx} className={`p-2.5 rounded-lg ${activity.status === 'success' ? 'bg-gradient-to-r from-green-50/50 to-emerald-50/30 border-green-100/50' : 'bg-gradient-to-r from-blue-50/50 to-indigo-50/30 border-blue-100/50'} border flex items-start gap-2`}>
                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${activity.status === 'success' ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-blue-500 shadow-lg shadow-blue-500/50'} animate-pulse`} />
                        <div className="flex-1">
                          <p className="text-xs font-medium text-gray-900">{activity.text}</p>
                          <p className="text-[10px] text-gray-600 flex items-center gap-0.5 mt-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            {activity.time}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* System Status */}
                <div className="backdrop-blur-xl bg-white/70 border border-white/50 shadow-lg rounded-xl p-4 overflow-hidden relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-50/50 via-emerald-50/30 to-teal-50/50 opacity-50 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-semibold text-gray-900">System Status</span>
                    </div>
                    <div className="p-3 rounded-xl bg-gradient-to-br from-green-50/80 to-emerald-50/60 border border-green-200/50 shadow-md">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <div className="absolute inset-0 bg-green-500 rounded-full blur-md opacity-50 animate-pulse" />
                          <div className="relative w-2.5 h-2.5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full animate-pulse" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900">All Systems Operational</p>
                          <p className="text-xs text-gray-600">99.97% uptime</p>
                        </div>
                        <span className="px-2 py-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-[10px] font-semibold rounded-lg shadow-md">
                          Online
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Badges */}
            <div className="absolute top-1/2 -right-8 hidden md:block animate-pulse">
              <div className="px-3 py-1.5 bg-white rounded-xl shadow-xl border border-gray-100 flex items-center gap-2">
                <Sparkles className="h-3 w-3 text-yellow-500" />
                <span className="text-[10px] font-bold text-gray-700">AI Powered</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dashboard Highlights Section */}
      <section className="py-20 bg-gradient-to-b from-white to-gray-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-6">Kelola Semua Dalam Satu Dashboard</h2>
            <p className="text-gray-500 max-w-2xl mx-auto text-lg font-light">
              Tampilan dashboard modern yang memudahkan Anda memantau aktivitas pesan, mengelola session, dan mengaktifkan bot AI dalam hitungan detik.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: 'Multi Device',
                desc: 'Hubungkan dan pantau semua nomor WhatsApp Anda tanpa perlu ganti-ganti device. Cocok untuk tim CS dan bisnis yang berkembang.',
                icon: Smartphone,
                color: 'from-blue-500 to-indigo-600'
              },
              {
                title: 'AI Smart Chatbot',
                desc: 'Biarkan AI menjawab pertanyaan customer secara otomatis, memahami konteks percakapan, dan tetap terasa natural seperti admin manusia.',
                icon: Bot,
                color: 'from-purple-500 to-pink-600'
              },
              {
                title: 'Pesan Broadcast',
                desc: 'Kirim promo, update, atau follow-up ke ribuan kontak dengan sistem delay yang membantu mengurangi risiko blokir.',
                icon: Zap,
                color: 'from-amber-500 to-orange-600'
              }
            ].map((feature, idx) => (
              <div key={idx} className="group p-6 rounded-2xl bg-white border border-gray-100 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${feature.color} text-white shadow-lg w-fit mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Fitur Unggulan Proyek Loko</h2>
            <p className="text-gray-500">Dirancang khusus untuk membantu pemilik toko online dan bisnis meningkatkan efisiensi komunikasi.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <Card key={i} className="border-none shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 bg-white">
                <CardHeader>
                  <div className="p-3 bg-gray-50 rounded-2xl w-fit mb-4">
                    {f.icon}
                  </div>
                  <CardTitle className="text-xl font-bold text-gray-900">{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-500 leading-relaxed text-sm">
                    {f.desc}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Pilih Paket Sesuai Kebutuhan</h2>
            <p className="text-gray-500">Harga transparan tanpa biaya tersembunyi. Mulai gratis dan upgrade kapan saja.</p>
          </div>

          {loading ? (
            <div className="flex justify-center p-20">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {Array.isArray(packages) && packages.map((pkg, i) => (
                <Card key={i} className={cn(
                  "relative border-gray-100 transition-all hover:border-blue-200",
                  pkg.price > 100000 && "border-blue-200 ring-2 ring-blue-50 shadow-blue-100 shadow-2xl"
                )}>
                  {pkg.price > 100000 && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                      <Badge className="bg-blue-600 text-white rounded-full px-4 py-1">Paling Populer</Badge>
                    </div>
                  )}
                  <CardHeader className="text-center pt-8">
                    <CardTitle className="text-2xl font-bold">{pkg.name}</CardTitle>
                    <CardDescription className="min-h-[40px] mt-2">{pkg.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-center">
                    <div className="mb-6">
                      <span className="text-4xl font-bold">
                        {pkg.price === 0 ? 'Gratis' : `Rp ${pkg.price.toLocaleString('id-ID')}`}
                      </span>
                      <span className="text-gray-400"> / {pkg.duration_days} hari</span>
                    </div>
                    <ul className="space-y-4 text-left">
                      <li className="flex items-center gap-3 text-sm text-gray-600">
                        <CheckCircle2 className="h-5 w-5 text-green-500" /> WhatsApp Device: {pkg.max_sessions}
                      </li>
                      <li className="flex items-center gap-3 text-sm text-gray-600">
                        <CheckCircle2 className="h-5 w-5 text-green-500" /> Broadcast Limit: {pkg.broadcast_limit}
                      </li>
                      <li className="flex items-center gap-3 text-sm text-gray-600">
                        <CheckCircle2 className="h-5 w-5 text-green-500" /> AI Tokens: {pkg.ai_limit}
                      </li>
                      <li className="flex items-center gap-3 text-sm text-gray-600">
                        <CheckCircle2 className="h-5 w-5 text-green-500" /> Akses Dashboard Pro
                      </li>
                    </ul>
                  </CardContent>
                  <CardFooter className="pb-8 pt-4">
                    <Button 
                        onClick={() => navigate('/register')}
                        variant={pkg.price > 100000 ? "default" : "outline"} 
                        className={cn(
                          "w-full rounded-xl h-12",
                          pkg.price > 100000 ? "bg-blue-600 hover:bg-blue-700" : "border-gray-200"
                        )}
                    >
                      Pilih Paket
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Pertanyaan yang Sering Diajukan</h2>
            <p className="text-gray-500">Punya pertanyaan lain? Jangan ragu untuk menghubungi tim support kami.</p>
          </div>
          
          <div className="space-y-4">
            {[
              { q: 'Apakah akun WhatsApp saya aman? Bisa kena blokir?', a: 'Loko menggunakan sistem delay dan mengikuti best practice penggunaan WhatsApp untuk meminimalkan risiko. Namun, seperti semua tools WhatsApp, tidak ada sistem yang 100% anti-blokir. Kami membantu Anda menggunakan WhatsApp secara lebih aman dan terkontrol.' },
              { q: 'Berapa lama setup sampai bisa dipakai?', a: 'Kurang dari 5 menit. Anda cukup login, hubungkan nomor WhatsApp, dan Loko sudah siap digunakan tanpa proses teknis yang rumit.' },
              { q: 'Apakah saya perlu skill teknis untuk menggunakan Loko?', a: 'Tidak. Loko dirancang untuk pemilik bisnis dan tim non-teknis. Semua fitur dibuat sederhana dan mudah digunakan tanpa coding atau setup yang kompleks.' },
              { q: 'Bagaimana cara kerja AI chatbot di Loko?', a: 'AI di Loko dapat memahami konteks percakapan, bukan hanya keyword. Anda bisa mengatur gaya balasan sesuai bisnis, dan AI akan membantu membalas chat customer secara otomatis 24/7.' },
              { q: 'Apakah bisa mengelola banyak nomor WhatsApp dalam satu dashboard?', a: 'Ya. Anda bisa menghubungkan dan mengelola banyak nomor WhatsApp sekaligus dalam satu dashboard, sehingga lebih mudah mengatur tim dan operasional customer service.' },
              { q: 'Apakah ada biaya tambahan selain biaya langganan?', a: 'Tidak ada biaya tersembunyi. Semua harga transparan sesuai paket yang Anda pilih, tanpa biaya tambahan yang membingungkan.' }
            ].map((faq, i) => (
              <details key={i} className="group border border-gray-200 rounded-xl bg-gray-50/50 p-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer items-center justify-between gap-1.5 font-medium text-gray-900">
                  <h3 className="text-base font-semibold">{faq.q}</h3>
                  <span className="shrink-0 rounded-full bg-white p-1 text-gray-900 sm:p-1.5 shadow-sm border border-gray-100 transition duration-300 group-open:-rotate-180">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </span>
                </summary>
                <p className="mt-3 leading-relaxed text-gray-600 text-sm">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Footer Section */}
      {!isLoggedIn && (
        <section className="py-24 bg-gray-900 overflow-hidden relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-10 bg-[radial-gradient(circle_at_center,_white_1px,_transparent_1px)] bg-[length:24px_24px] pointer-events-none"></div>
            <div className="max-w-4xl mx-auto px-6 text-center">
                <h2 className="text-4xl font-bold text-white mb-6">Siap Mengembangkan Bisnis Anda?</h2>
                <p className="text-gray-400 mb-10 text-lg">
                    Bergabunglah dengan ratusan pemilik bisnis lainnya yang telah menggunakan Loko untuk mengefisiensikan komunikasi WhatsApp mereka.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Button
                    onClick={() => navigate('/register')}
                    size="lg"
                    className="bg-white text-gray-900 px-10 h-14 rounded-full text-lg font-bold hover:bg-white"
                  >
                      Daftar Sekarang Secara Gratis
                  </Button>
                  <a
                    href="https://loko.wednesdev.id/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button
                      size="lg"
                      variant="outline"
                      className="border-2 border-white text-gray-900 bg-white px-10 h-14 rounded-full text-lg font-bold hover:bg-white hover:text-gray-900"
                    >
                        Masuk ke Dashboard
                    </Button>
                  </a>
                </div>
            </div>
        </section>
      )}

      {/* Real Footer */}
      <footer className="py-12 border-t border-gray-100">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
              <div className="flex items-center gap-2">
                  <MessageCircle className="h-6 w-6 text-blue-600" />
                  <span className="text-xl font-bold text-gray-900">Loko</span>
              </div>
              <div className="flex gap-8 text-sm text-gray-500">
                  <a href="https://loko.wednesdev.id/dashboard" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 font-semibold text-blue-600">Dashboard</a>
                  <a href="#" className="hover:text-blue-600">Privacy Policy</a>
                  <a href="#" className="hover:text-blue-600">Terms of Service</a>
                  <a href="#" className="hover:text-blue-600">Documentation</a>
              </div>
              <p className="text-sm text-gray-400">© 2026 Wednes.Dev (Loko Project). Seluruh hak cipta dilindungi.</p>
          </div>
      </footer>
    </div>
  );
};

export default LandingPage;
