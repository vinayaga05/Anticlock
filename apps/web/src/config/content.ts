import type { ServiceTree, Feature, FAQ } from '@/types';

export const serviceTrees: ServiceTree[] = [
  {
    id: 'health',
    name: 'Health',
    description: 'Doctors, diagnostics, physiotherapy—care for your health, all in one place.',
    icon: 'heart-pulse',
    color: '#5BB8E8',
  },
  {
    id: 'fitness',
    name: 'Fitness',
    description: 'Gyms, trainers, and classes. Find your perfect workout.',
    icon: 'dumbbell',
    color: '#84CC16',
  },
  {
    id: 'sports',
    name: 'Sports',
    description: 'Play, train, and compete. Join teams and challenges.',
    icon: 'trophy',
    color: '#38BDF8',
  },
  {
    id: 'wellness',
    name: 'Wellness',
    description: 'Mind, body, and holistic care for inner peace.',
    icon: 'sparkles',
    color: '#A78BFA',
  },
  {
    id: 'tours-events',
    name: 'Tours & Events',
    description: 'Trips, adventures, and celebrations await.',
    icon: 'plane',
    color: '#F59E0B',
  },
  {
    id: 'beauty-spa',
    name: 'Beauty & Spa',
    description: 'Salons, spas, and beauty professionals near you.',
    icon: 'scissors',
    color: '#F472B6',
  },
  {
    id: 'courses',
    name: 'Courses & Training',
    description: 'Learn new skills from trusted instructors.',
    icon: 'graduation-cap',
    color: '#818CF8',
  },
  {
    id: 'home-services',
    name: 'Home Services',
    description: 'On-demand help for your home and daily needs.',
    icon: 'home',
    color: '#22D3EE',
  },
  {
    id: 'shop',
    name: 'Shop',
    description: 'Health, fitness, and lifestyle products delivered.',
    icon: 'shopping-bag',
    color: '#F59E0B',
  },
];

export const features: Feature[] = [
  {
    id: 'clips',
    name: 'Clips',
    description: 'Vertical video feed showcasing lifestyle content, services, and experiences from creators and providers.',
    icon: 'video',
    category: 'social',
  },
  {
    id: 'flash',
    name: 'Flash',
    description: 'Ephemeral stories that disappear after 24 hours. Share moments and discover what\'s happening now.',
    icon: 'zap',
    category: 'social',
  },
  {
    id: 'marketplace',
    name: 'Service Marketplace',
    description: '9 comprehensive service categories covering health, fitness, wellness, travel, courses, and more.',
    icon: 'store',
    category: 'marketplace',
  },
  {
    id: 'bookings',
    name: 'Smart Bookings',
    description: 'Book appointments, classes, trips, and services with instant confirmation. Track everything in one place.',
    icon: 'calendar-check',
    category: 'marketplace',
  },
  {
    id: 'communities',
    name: 'Communities',
    description: 'Join teams, participate in challenges, and connect with people who share your interests.',
    icon: 'users',
    category: 'community',
  },
  {
    id: 'knock',
    name: 'Knock',
    description: 'Direct messaging between users and providers. Get quick answers and build connections.',
    icon: 'message-circle',
    category: 'community',
  },
  {
    id: 'genie',
    name: 'AI Assistant',
    description: 'Voice and text assistant that helps you discover services, book appointments, and get personalized recommendations.',
    icon: 'sparkles',
    category: 'smart',
  },
  {
    id: 'provider-tools',
    name: 'Provider Tools',
    description: 'Built-in business dashboard for service providers. Manage bookings, clients, and grow your business.',
    icon: 'briefcase',
    category: 'marketplace',
  },
];

export const faqs: FAQ[] = [
  {
    question: 'What is Knock?',
    answer: 'Knock is a lifestyle super-app that combines social video content with a comprehensive service marketplace. Discover and book health, fitness, wellness, beauty, travel, and lifestyle services—all in one place.',
  },
  {
    question: 'What services can I find on Knock?',
    answer: 'We cover 9 service categories: Health (doctors, diagnostics), Fitness (gyms, trainers), Sports (teams, training), Wellness (holistic care), Tours & Events (travel, adventures), Beauty & Spa, Courses & Training, Home Services, and E-commerce (lifestyle products).',
  },
  {
    question: 'How is Knock different from other booking apps?',
    answer: 'Knock combines social discovery through video content (Clips and Flash) with comprehensive service booking. You can explore services through engaging content, join communities, message providers directly, and manage all your bookings in one app.',
  },
  {
    question: 'Can I use Knock as a service provider?',
    answer: 'Yes! Knock welcomes service providers and businesses. Complete the provider onboarding in the app to create your business profile, list your services, and access the provider dashboard to manage bookings and grow your business.',
  },
  {
    question: 'Is Knock free to use?',
    answer: 'The Knock app is free to download and use. Service providers may have their own pricing for bookings, classes, or products.',
  },
  {
    question: 'What platforms is Knock available on?',
    answer: 'Knock is a mobile app built with React Native. Check back for availability updates.',
  },
];

export const howItWorksSteps = [
  {
    number: 1,
    title: 'Explore & Discover',
    description: 'Browse through Clips, Flash stories, and service categories. Use the AI assistant for personalized recommendations.',
  },
  {
    number: 2,
    title: 'Connect & Book',
    description: 'Message providers directly, check availability, and book appointments, classes, or trips with instant confirmation.',
  },
  {
    number: 3,
    title: 'Join & Share',
    description: 'Become part of communities, participate in challenges, and share your own experiences through content.',
  },
  {
    number: 4,
    title: 'Manage & Track',
    description: 'All your bookings, trips, courses, and orders in one place. Get reminders and updates automatically.',
  },
];

export const differentiators = [
  {
    title: 'All-in-One Platform',
    description: 'Social content, service marketplace, communities, and e-commerce—unified in a single premium experience.',
  },
  {
    title: 'Social-First Discovery',
    description: 'Discover services through engaging video content, not boring directories. Inspiration meets action.',
  },
  {
    title: 'Comprehensive Coverage',
    description: '9 service categories spanning health to home services. Everything your lifestyle needs.',
  },
  {
    title: 'Community Built-In',
    description: 'Teams, challenges, and connections. More than transactions—build relationships.',
  },
  {
    title: 'AI-Powered',
    description: 'Smart assistant that learns your preferences and helps you find exactly what you need.',
  },
];

export const providerBenefits = [
  'Connect with lifestyle-conscious users seeking your services',
  'Manage bookings and clients through an integrated dashboard',
  'Showcase your services through video content',
  'Build community around your brand',
  'Direct messaging with potential clients',
  'Grow your business with minimal overhead',
];
