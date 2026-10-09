export const siteConfig = {
  name: 'Knock',
  description: 'Your lifestyle, simplified. Discover services, connect with communities, and book everything from health to travel—all in one place.',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://anticlock.online',
  ogImage: '/og-image.png',
  links: {
    appStore: process.env.NEXT_PUBLIC_APP_STORE_URL,
    playStore: process.env.NEXT_PUBLIC_PLAY_STORE_URL,
    twitter: process.env.NEXT_PUBLIC_TWITTER_URL,
    instagram: process.env.NEXT_PUBLIC_INSTAGRAM_URL,
    facebook: process.env.NEXT_PUBLIC_FACEBOOK_URL,
    linkedin: process.env.NEXT_PUBLIC_LINKEDIN_URL,
  },
};

export const navigation = {
  main: [
    { name: 'Features', href: '#features' },
    { name: 'Services', href: '#services' },
    { name: 'How it Works', href: '#how-it-works' },
    { name: 'For Providers', href: '#providers' },
  ],
  footer: {
    product: [
      { name: 'Features', href: '#features' },
      { name: 'Services', href: '#services' },
      { name: 'How it Works', href: '#how-it-works' },
      { name: 'Download', href: '#download' },
    ],
    forYou: [
      { name: 'Health & Fitness', href: '#services' },
      { name: 'Beauty & Wellness', href: '#services' },
      { name: 'Travel & Events', href: '#services' },
      { name: 'Courses & Training', href: '#services' },
    ],
    forProviders: [
      { name: 'Become a Provider', href: '#providers' },
      { name: 'Provider Benefits', href: '#providers' },
    ],
    company: [
      { name: 'Privacy Policy', href: '/privacy' },
      { name: 'Terms of Service', href: '/terms' },
    ],
  },
};
