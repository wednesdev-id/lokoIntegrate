import React from 'react';
import LandingNavbar from '@/components/layout/LandingNavbar';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Target, Award, Rocket, 
  MessageCircle, Heart, Shield, Zap 
} from 'lucide-react';

const AboutPage: React.FC = () => {
  const navigate = useNavigate();

  const values = [
    {
      title: 'Inovasi Tanpa Henti',
      desc: 'Kami terus mengembangkan fitur-fitur terbaru untuk memastikan bisnis Anda tetap relevan di era digital.',
      icon: <Rocket className="h-6 w-6 text-blue-600" />,
    },
    {
      title: 'Fokus pada Pengguna',
      desc: 'Setiap baris kode yang kami tulis didasarkan pada kebutuhan dan feedback dari pengguna setia kami.',
      icon: <Users className="h-6 w-6 text-purple-600" />,
    },
    {
      title: 'Keamanan Data',
      desc: 'Privasi dan keamanan data Anda adalah prioritas utama kami dengan standar enkripsi terkini.',
      icon: <Shield className="h-6 w-6 text-indigo-600" />,
    },
    {
      title: 'Integritas & Transparansi',
      desc: 'Kami menjunjung tinggi kejujuran dalam berbisnis dan keterbukaan dalam setiap layanan kami.',
      icon: <Award className="h-6 w-6 text-amber-600" />,
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <LandingNavbar />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden bg-gray-50/50">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-full -z-10 opacity-30 blur-3xl pointer-events-none">
          <div className="absolute top-0 left-0 w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply animate-blob"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply animate-blob animation-delay-2000"></div>
        </div>

        <div className="max-w-7xl mx-auto px-6 text-center">
          <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 tracking-tight mb-8">
            Tentang <span className="text-blue-600">Loko</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed font-light">
            Loko (Lobi Toko) lahir dari visi untuk mendemokratisasi akses teknologi otomasi bisnis kelas dunia 
            bagi setiap pengusaha, dari UMKM hingga korporasi besar.
          </p>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">Misi Kami</h2>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                Kami percaya bahwa komunikasi yang efektif adalah kunci keberhasilan setiap bisnis. 
                Melalui Loko, kami menyediakan infrastruktur yang memungkinkan bisnis untuk merespon pelanggan lebih cepat, 
                mengelola tim lebih efisien, dan mengembangkan pasar tanpa hambatan teknis.
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Heart className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Memberdayakan UMKM</h4>
                    <p className="text-gray-500 text-sm">Memberikan alat profesional dengan harga yang terjangkau.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Zap className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Otomasi Cerdas</h4>
                    <p className="text-gray-500 text-sm">Menghilangkan tugas manual yang membosankan melalui AI & integrasi API.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="rounded-2xl overflow-hidden shadow-2xl">
                 <div className="aspect-square bg-gradient-to-br from-blue-600 to-indigo-900 flex items-center justify-center p-12">
                    <div className="text-center text-white">
                        <Target className="h-32 w-32 mx-auto mb-6 opacity-80" />
                        <h3 className="text-2xl font-bold">Terfokus pada Hasil</h3>
                        <p className="opacity-70 mt-2">Membantu ribuan bisnis bertumbuh setiap harinya.</p>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-24 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Nilai-Nilai Kami</h2>
          <p className="text-gray-500 max-w-2xl mx-auto mb-16">
            Fondasi yang membentuk cara kami bekerja dan melayani Anda.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {values.map((v, i) => (
              <div key={i} className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow text-left">
                <div className="mb-4">{v.icon}</div>
                <h4 className="text-lg font-bold text-gray-900 mb-2">{v.title}</h4>
                <p className="text-gray-500 text-sm leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gray-900 relative">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-6">Mulai Transformasi Bisnis Anda</h2>
          <p className="text-gray-400 mb-10 text-lg">
            Bergabunglah dengan komunitas pembisnis cerdas yang telah beralih ke Loko.
          </p>
          <Button 
            onClick={() => navigate('/register')}
            size="lg" 
            className="bg-white text-gray-900 hover:bg-gray-100 px-10 h-14 rounded-full text-lg font-bold"
          >
            Daftar Gratis Sekarang
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">Loko</span>
          </div>
          <p className="text-sm text-gray-400">© 2026 Wednes.Dev (Loko Project). Seluruh hak cipta dilindungi.</p>
        </div>
      </footer>
    </div>
  );
};

export default AboutPage;
