'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import { navigation } from '@/config/site';

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'glass-dark shadow-lg' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          <Link href="/" className="flex items-center space-x-2 md:space-x-3">
            <div className="relative w-10 h-10 md:w-11 md:h-11 flex-shrink-0">
              <Image
                src="/brand/logo-square.png"
                alt="Knock"
                fill
                sizes="(max-width: 768px) 40px, 44px"
                className="object-contain"
                priority
              />
            </div>
            <span className="text-xl md:text-2xl font-bold text-white">Knock</span>
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            {navigation.main.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="text-white/90 hover:text-white transition-colors font-medium"
              >
                {item.name}
              </Link>
            ))}
            <Link
              href="#download"
              className="px-6 py-2.5 bg-gradient-to-r from-aqua to-aqua-deep text-white rounded-full font-semibold hover:shadow-lg hover:scale-105 transition-all"
            >
              Download
            </Link>
          </div>

          <button
            className="md:hidden text-white p-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden glass-dark border-t border-white/10">
          <div className="px-4 py-6 space-y-4">
            {navigation.main.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="block text-white/90 hover:text-white transition-colors font-medium py-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
            <Link
              href="#download"
              className="block text-center px-6 py-3 bg-gradient-to-r from-aqua to-aqua-deep text-white rounded-full font-semibold"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Download
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
