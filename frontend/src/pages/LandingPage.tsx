import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import LandingNavbar from '@/components/layout/LandingNavbar';

import { 
  Zap, Shield, MessageCircle, Bot, BarChart3, 
  Smartphone, CheckCircle2, ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

    // Auto-redirect to dashboard if already logged in
    const token = localStorage.getItem('auth_token');
    if (token) {
      navigate('/dashboard');
    }
  }, [navigate]);

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
            Solusi integrasi API WhatsApp tercanggih untuk mengelola pesan, bot, dan kampanye broadcast dalam satu platform yang elegan dan efisien.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button 
                onClick={() => navigate('/register')}
                size="lg" 
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 h-14 rounded-full text-lg shadow-xl shadow-blue-200"
            >
              Mulai Gratis Sekarang <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="px-8 h-14 rounded-full text-lg border-gray-200 text-gray-600">
              Lihat Demo Video
            </Button>
          </div>
          
          <div className="mt-16 relative mx-auto max-w-4xl animate-in zoom-in-95 duration-1000">
              <div className="rounded-2xl border border-gray-200 bg-white/50 backdrop-blur-sm p-2 shadow-2xl">
                  {/* Note: This would be the generated hero image in a real deployment */}
                  <div className="rounded-xl overflow-hidden bg-gray-50 aspect-video flex items-center justify-center">
                      <div className="text-center p-8">
                          <Zap className="h-16 w-16 text-blue-500 mx-auto mb-4 animate-pulse" />
                          <p className="text-gray-400 font-medium">Loko Dashboard Preview</p>
                      </div>
                  </div>
              </div>
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
              { q: 'Apakah ada batasan nomor WhatsApp yang bisa dihubungkan?', a: 'Tergantung paket yang Anda pilih. Paket Starter hanya mengizinkan 1 nomor WhatsApp, sedangkan paket lain seperti Enterprise mendukung hingga 10 nomor dalam satu dashboard.' },
              { q: 'Bagaimana cara kerja AI Chatbot?', a: 'Kami mengintegrasikan sistem dengan OpenRouter AI. Anda bisa menentukan instruksi khusus (prompt) untuk bot Anda, dan AI akan otomatis membalas pesan pelanggan sesuai konteks yang diberikan 24/7.' },
              { q: 'Apakah aman mengirim pesan Broadcast?', a: 'Sistem Loko dirancang dengan delay otomatis (jeda) dan manajemen limit untuk meminimalisir risiko blokir dari WhatsApp. Namun, kami tetap menyarankan untuk mengirim pesan sesuai dengan ketentuan layanan WhatsApp.' },
              { q: 'Apakah saya bisa membatalkan langganan kapan saja?', a: 'Tentu. Anda dapat upgrade, downgrade, atau membatalkan langganan kapan saja melalui dashboard tanpa biaya penalti tersembunyi.' }
            ].map((faq, i) => (
              <details key={i} className="group border border-gray-200 rounded-2xl bg-gray-50/50 p-6 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer items-center justify-between gap-1.5 font-medium text-gray-900">
                  <h3 className="text-lg font-semibold">{faq.q}</h3>
                  <span className="shrink-0 rounded-full bg-white p-1.5 text-gray-900 sm:p-3 shadow-sm border border-gray-100 transition duration-300 group-open:-rotate-180">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </span>
                </summary>
                <p className="mt-4 leading-relaxed text-gray-600">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Footer Section */}
      <section className="py-24 bg-gray-900 overflow-hidden relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-10 bg-[radial-gradient(circle_at_center,_white_1px,_transparent_1px)] bg-[length:24px_24px] pointer-events-none"></div>
          <div className="max-w-4xl mx-auto px-6 text-center">
              <h2 className="text-4xl font-bold text-white mb-6">Siap Mengembangkan Bisnis Anda?</h2>
              <p className="text-gray-400 mb-10 text-lg">
                  Bergabunglah dengan ratusan pemilik bisnis lainnya yang telah menggunakan Loko untuk mengefisiensikan komunikasi WhatsApp mereka.
              </p>
              <Button 
                onClick={() => navigate('/register')}
                size="lg" 
                className="bg-white text-gray-900 hover:bg-gray-100 px-10 h-14 rounded-full text-lg font-bold shadow-xl shadow-white/10"
              >
                  Daftar Sekarang Secara Gratis
              </Button>
          </div>
      </section>

      {/* Real Footer */}
      <footer className="py-12 border-t border-gray-100">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
              <div className="flex items-center gap-2">
                  <MessageCircle className="h-6 w-6 text-blue-600" />
                  <span className="text-xl font-bold text-gray-900">Loko</span>
              </div>
              <div className="flex gap-8 text-sm text-gray-500">
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
