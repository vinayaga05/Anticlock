import Link from 'next/link';
import type { Metadata } from 'next';
import { generateMetadata } from '@/lib/metadata';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = generateMetadata({
  title: 'Privacy Policy',
  description: 'Anticlock Privacy Policy',
});

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-white pt-32 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-8">Privacy Policy</h1>
          
          <div className="prose prose-lg max-w-none">
            <div className="bg-gradient-to-br from-gray-50 to-white border-l-4 border-aqua p-6 rounded-r-xl mb-8">
              <p className="text-lg text-gray-700 font-medium mb-0">
                Privacy Policy content is to be provided by Anticlock.
              </p>
            </div>

            <p className="text-gray-600">
              This is a placeholder page. The Privacy Policy will contain information about:
            </p>

            <ul className="text-gray-600 space-y-2">
              <li>What data Anticlock collects</li>
              <li>How user data is used and protected</li>
              <li>Cookie and tracking policies</li>
              <li>Third-party service integration</li>
              <li>User rights and data access</li>
              <li>Contact information for privacy concerns</li>
            </ul>

            <p className="text-gray-600 mt-8">
              For questions about privacy practices, please check back when the official policy is published.
            </p>

            <div className="mt-12">
              <Link
                href="/"
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-aqua to-aqua-deep text-white rounded-xl font-semibold hover:scale-105 transition-transform"
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
