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

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      aria-label="Main navigation"
      className={`site-nav fixed top-0 left-0 right-0 z-50 border-b transition-all duration-300 ${
        isScrolled ? 'border-[#09235b]/10 bg-white/95 shadow-lg shadow-[#09235b]/5 backdrop-blur-xl' : 'border-[#09235b]/5 bg-white/80 backdrop-blur-md'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          <Link href="/" className="flex items-center space-x-2 md:space-x-3">
            <div className="relative w-10 h-10 md:w-11 md:h-11 flex-shrink-0 overflow-hidden rounded-xl shadow-sm">
              <Image
                src="/brand/logo-square.png"
                alt="Knock"
                fill
                sizes="(max-width: 768px) 40px, 44px"
                className="object-contain"
                priority
              />
            </div>
            <span className="text-xl md:text-2xl font-black tracking-tight text-[#09235b]">Knock<span className="text-[#e94c62]">.</span></span>
          </Link>

          <div className="hidden lg:flex items-center space-x-8">
            {navigation.main.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="text-[#415878] hover:text-[#d23848] transition-colors font-bold"
              >
                {item.name}
              </Link>
            ))}
            <Link
              href="#download"
              className="rounded-xl bg-[#09235b] px-6 py-2.5 font-black text-white shadow-md shadow-[#09235b]/10 transition hover:bg-[#0b5f9d] motion-safe:hover:-translate-y-0.5"
            >
              Download
            </Link>
          </div>

          <button
            type="button"
            className="rounded-xl border border-[#09235b]/10 bg-white p-2 text-[#09235b] lg:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-navigation"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div id="mobile-navigation" className="border-t border-[#09235b]/10 bg-[#f4fbff] shadow-xl shadow-[#09235b]/10 lg:hidden">
          <div className="px-4 py-6 space-y-4">
            {navigation.main.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="block py-2 font-bold text-[#415878] transition-colors hover:text-[#d23848]"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
            <Link
              href="#download"
              className="block rounded-xl bg-[#09235b] px-6 py-3 text-center font-black text-white"
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
