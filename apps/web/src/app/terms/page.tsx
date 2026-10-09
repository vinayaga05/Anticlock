import Link from 'next/link';
import type { Metadata } from 'next';
import { generateMetadata } from '@/lib/metadata';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = generateMetadata({
  title: 'Terms of Service',
  description: 'Knock Terms of Service',
});

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-white pt-32 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-8">Terms of Service</h1>
          
          <div className="prose prose-lg max-w-none">
            <div className="bg-gradient-to-br from-gray-50 to-white border-l-4 border-coral p-6 rounded-r-xl mb-8">
              <p className="text-lg text-gray-700 font-medium mb-0">
                Terms of Service content is to be provided by Knock.
              </p>
            </div>

            <p className="text-gray-600">
              This is a placeholder page. The Terms of Service will contain information about:
            </p>

            <ul className="text-gray-600 space-y-2">
              <li>User responsibilities and acceptable use</li>
              <li>Service provider terms and obligations</li>
              <li>Booking and payment terms</li>
              <li>Content guidelines and intellectual property</li>
              <li>Liability and disclaimers</li>
              <li>Dispute resolution and governing law</li>
            </ul>

            <p className="text-gray-600 mt-8">
              By using Knock, you agree to comply with these terms when they are published.
            </p>

            <div className="mt-12">
              <Link
                href="/"
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-coral to-coral-deep text-white rounded-xl font-semibold hover:scale-105 transition-transform"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
