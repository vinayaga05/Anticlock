import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { generateMetadata as genMetadata } from '@/lib/metadata';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = genMetadata({});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning>{children}</body>
    </html>
  );
}
