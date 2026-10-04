import Link from 'next/link';
import type { Metadata } from 'next';
import { generateMetadata } from '@/lib/metadata';

export const metadata: Metadata = generateMetadata({
  title: '404 - Page Not Found',
  description: 'This page could not be found.',
  noIndex: true,
});

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center px-4">
      <div className="text-center">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-aqua to-coral mb-6 animate-float">
            <span className="text-white font-bold text-4xl">A</span>
          </div>
        </div>
        
        <h1 className="text-6xl md:text-8xl font-bold mb-4 bg-gradient-to-r from-aqua via-coral to-lime bg-clip-text text-transparent">
          404
        </h1>
        
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
          Looks like this moment doesn't exist.
        </h2>
        
        <p className="text-lg text-white/70 mb-8 max-w-md mx-auto">
          The page you're looking for has vanished into the digital void. Let's get you back on track.
        </p>
        
        <Link
          href="/"
          className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-aqua to-aqua-deep text-white rounded-2xl font-semibold hover:scale-105 transition-transform"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
