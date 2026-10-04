import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { HeroSection } from '@/components/sections/HeroSection';
import { FeaturesSection } from '@/components/sections/FeaturesSection';
import { ServicesSection } from '@/components/sections/ServicesSection';
import { HowItWorksSection } from '@/components/sections/HowItWorksSection';
import { WhyAnticlockSection } from '@/components/sections/WhyAnticlockSection';
import { ProvidersSection } from '@/components/sections/ProvidersSection';
import { FAQSection } from '@/components/sections/FAQSection';
import { CTASection } from '@/components/sections/CTASection';

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <ServicesSection />
        <HowItWorksSection />
        <WhyAnticlockSection />
        <ProvidersSection />
        <FAQSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
