import type { Metadata } from 'next';
import { generateMetadata as genMetadata } from '@/lib/metadata';
import './globals.css';

export const metadata: Metadata = genMetadata({});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="antialiased">{children}</body>
    </html>
  );
}
