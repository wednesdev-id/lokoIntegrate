import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MessageSquare, Menu, X, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const LandingNavbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Fitur', href: '#features' },
    { name: 'Harga', href: '#pricing' },
    { name: 'Tentang', href: '/about' },
  ];

  return (
    <nav
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300 py-4',
        isScrolled 
          ? 'bg-white/80 backdrop-blur-md border-b border-gray-200 py-3 shadow-sm' 
          : 'bg-transparent'
      )}
    >
      <div className="max-w-7xl mx-auto w-full flex items-center justify-between px-6">
        {/* Logo Part */}
        <div className="flex-1 flex items-center">
          <Link to="/" className="flex items-center gap-2 group ml-[30px]">
            <div className="bg-blue-600 p-2 rounded-lg group-hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <span className={cn(
              "text-2xl font-bold tracking-tight",
              isScrolled ? "text-gray-900" : "text-gray-900"
            )}>
              Loko
            </span>
          </Link>
        </div>

        {/* Desktop Links (Centered to align with Headline) */}
        <div className="hidden md:flex items-center gap-8 px-4">
          {navLinks.map((link) => (
            link.href.startsWith('#') ? (
              <a
                key={link.name}
                href={link.href}
                className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors whitespace-nowrap"
              >
                {link.name}
              </a>
            ) : (
              <Link
                key={link.name}
                to={link.href}
                className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors whitespace-nowrap"
              >
                {link.name}
              </Link>
            )
          ))}
        </div>

        {/* Desktop CTA Part */}
        <div className="hidden md:flex flex-1 items-center justify-end gap-4">
          <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-blue-600 px-4 py-2">
            Masuk
          </Link>
          <Button 
            onClick={() => navigate('/register')}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 rounded-full px-6"
          >
            Mulai Sekarang <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>

        {/* Mobile Menu Toggle */}
        <button 
          className="md:hidden p-2 text-gray-600"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-gray-200 p-6 space-y-4 animate-in slide-in-from-top-4 duration-200 shadow-xl">
           {navLinks.map((link) => (
            link.href.startsWith('#') ? (
              <a
                key={link.name}
                href={link.href}
                className="block text-lg font-medium text-gray-900"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.name}
              </a>
            ) : (
              <Link
                key={link.name}
                to={link.href}
                className="block text-lg font-medium text-gray-900"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.name}
              </Link>
            )
          ))}
          <div className="pt-4 flex flex-col gap-4">
            <Button 
              variant="outline" 
              className="w-full rounded-xl"
              onClick={() => {
                setIsMobileMenuOpen(false);
                navigate('/login');
              }}
            >
              Masuk
            </Button>
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl"
              onClick={() => {
                setIsMobileMenuOpen(false);
                navigate('/register');
              }}
            >
              Daftar Gratis
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default LandingNavbar;
