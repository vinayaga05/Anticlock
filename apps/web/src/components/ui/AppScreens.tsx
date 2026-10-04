/**
 * Mock app screen components
 * These are creative, polished mockups that resemble the real Anticlock app
 * 
 * NOTE: These are placeholder mockups to be replaced with real screenshots.
 * Real screenshots should be placed in public/screens/*.png
 */

'use client';

import Image from 'next/image';
import { Heart, MessageCircle, Share2, Play, Calendar, MapPin, Star, TrendingUp, Users } from 'lucide-react';

/**
 * Home Feed Screen - Shows category grid with real artwork
 */
export function HomeScreen() {
  const categories = [
    { name: 'Fitness', image: '/app/fitness-gym.webp', color: '#84CC16' },
    { name: 'Health', image: '/app/health-doctor-consultation.webp', color: '#5BB8E8' },
    { name: 'Wellness', image: '/app/wellness-nutrition-diet.webp', color: '#A78BFA' },
    { name: 'Beauty', image: '/app/beauty-parlour-female.webp', color: '#F472B6' },
    { name: 'Sports', image: '/app/sports-football.webp', color: '#38BDF8' },
    { name: 'Tours', image: '/app/tours-trekking.webp', color: '#F59E0B' },
    { name: 'Courses', image: '/app/course-design.webp', color: '#818CF8' },
    { name: 'Home', image: '/app/home-plumber.webp', color: '#22D3EE' },
  ];

  return (
    <div className="h-full bg-gradient-to-br from-gray-50 to-white pt-16 pb-20 overflow-y-auto">
      {/* Flash stories row */}
      <div className="px-4 mb-6">
        <div className="flex gap-3 overflow-x-auto pb-2">
          {['Trending', 'Fitness', 'Wellness', 'Travel'].map((story, i) => (
            <div key={i} className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-aqua to-coral p-0.5">
                <div className="w-full h-full rounded-full bg-gray-200" />
              </div>
              <span className="text-xs text-gray-600">{story}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Categories grid */}
      <div className="px-4">
        <h2 className="text-lg font-bold mb-4 text-gray-900">Explore Services</h2>
        <div className="grid grid-cols-4 gap-3">
          {categories.map((cat, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="w-full aspect-square rounded-2xl overflow-hidden relative" style={{ backgroundColor: `${cat.color}15` }}>
                <Image
                  src={cat.image}
                  alt={cat.name}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </div>
              <span className="text-xs font-medium text-gray-700 text-center">{cat.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Clips Screen - Vertical video feed
 */
export function ClipsScreen() {
  return (
    <div className="h-full bg-gray-900 relative pt-16">
      {/* Video content simulation */}
      <div className="absolute inset-0">
        <div className="w-full h-full bg-gradient-to-br from-aqua/20 to-coral/20 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
            <Play size={32} className="text-white ml-1" />
          </div>
        </div>
      </div>
      
      {/* Overlay UI */}
      <div className="absolute bottom-24 left-4 right-20 z-10 text-white">
        <h3 className="font-bold text-lg mb-2">Morning Yoga Flow</h3>
        <p className="text-sm opacity-90 mb-3">by Sarah Chen • Wellness Coach</p>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <MapPin size={14} />
            <span>Mumbai</span>
          </div>
          <div className="flex items-center gap-1">
            <Users size={14} />
            <span>2.4K</span>
          </div>
        </div>
      </div>
      
      {/* Action buttons */}
      <div className="absolute right-4 bottom-32 flex flex-col gap-6 text-white">
        <div className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
            <Heart size={24} />
          </div>
          <span className="text-xs">12K</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
            <MessageCircle size={24} />
          </div>
          <span className="text-xs">432</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
            <Share2 size={24} />
          </div>
          <span className="text-xs">Share</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Marketplace Screen - Product/service grid
 */
export function MarketplaceScreen() {
  const items = [
    { name: 'Yoga Mat Premium', price: '₹1,299', image: '/app/shop-fitness-3d.webp' },
    { name: 'Resistance Bands', price: '₹899', image: '/app/shop-sports-3d.webp' },
    { name: 'Wellness Kit', price: '₹2,499', image: '/app/shop-health-3d.webp' },
    { name: 'Beauty Essentials', price: '₹1,799', image: '/app/shop-beauty-3d.webp' },
  ];

  return (
    <div className="h-full bg-white pt-16 pb-20 overflow-y-auto">
      <div className="px-4">
        <h2 className="text-lg font-bold mb-4 text-gray-900">Shop</h2>
        <div className="grid grid-cols-2 gap-4">
          {items.map((item, i) => (
            <div key={i} className="bg-gray-50 rounded-xl overflow-hidden">
              <div className="aspect-square bg-gray-100 relative">
                <Image
                  src={item.image}
                  alt={item.name}
                  fill
                  sizes="150px"
                  className="object-cover"
                />
              </div>
              <div className="p-3">
                <h3 className="font-semibold text-sm mb-1 text-gray-900">{item.name}</h3>
                <p className="text-aqua font-bold">{item.price}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Booking Confirmation Screen
 */
export function BookingScreen() {
  return (
    <div className="h-full bg-white pt-16 pb-20 overflow-y-auto">
      <div className="px-4">
        <div className="text-center mb-8 pt-6">
          <div className="w-20 h-20 rounded-full bg-aqua/10 mx-auto mb-4 flex items-center justify-center">
            <Calendar size={40} className="text-aqua" />
          </div>
          <h2 className="text-xl font-bold mb-2 text-gray-900">Booking Confirmed!</h2>
          <p className="text-gray-600">Your session has been scheduled</p>
        </div>

        <div className="bg-gradient-to-br from-aqua/5 to-coral/5 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-aqua to-coral" />
            <div>
              <h3 className="font-bold text-gray-900">Personal Training</h3>
              <p className="text-sm text-gray-600">with Alex Kumar</p>
            </div>
          </div>
          
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Date</span>
              <span className="font-semibold text-gray-900">Oct 15, 2026</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Time</span>
              <span className="font-semibold text-gray-900">6:00 PM - 7:00 PM</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Location</span>
              <span className="font-semibold text-gray-900">FitZone Gym</span>
            </div>
          </div>
        </div>

        <button className="w-full py-4 bg-gradient-to-r from-aqua to-coral text-white font-semibold rounded-xl">
          View Details
        </button>
      </div>
    </div>
  );
}

/**
 * Community Feed Screen
 */
export function CommunityScreen() {
  return (
    <div className="h-full bg-white pt-16 pb-20 overflow-y-auto">
      <div className="px-4">
        <h2 className="text-lg font-bold mb-4 text-gray-900">Communities</h2>
        
        {[
          { name: 'Morning Runners', members: '2.4K', trend: '+45' },
          { name: 'Yoga Lovers', members: '5.1K', trend: '+123' },
          { name: 'Fitness Challenge', members: '3.8K', trend: '+89' },
        ].map((community, i) => (
          <div key={i} className="bg-gray-50 rounded-xl p-4 mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-aqua to-coral" />
              <div>
                <h3 className="font-semibold text-gray-900">{community.name}</h3>
                <p className="text-sm text-gray-600">{community.members} members</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-aqua text-sm font-semibold">
              <TrendingUp size={16} />
              <span>{community.trend}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Messages Screen
 */
export function MessagesScreen() {
  const chats = [
    { name: 'Sarah Chen', message: 'See you at the session!', time: '2m', unread: true },
    { name: 'FitZone Gym', message: 'Booking confirmed for tomorrow', time: '1h', unread: false },
    { name: 'Alex Kumar', message: 'Great progress this week!', time: '3h', unread: false },
  ];

  return (
    <div className="h-full bg-white pt-16 pb-20 overflow-y-auto">
      <div className="px-4">
        <h2 className="text-lg font-bold mb-4 text-gray-900">Messages</h2>
        
        {chats.map((chat, i) => (
          <div key={i} className={`flex items-center gap-3 p-4 rounded-xl mb-2 ${chat.unread ? 'bg-aqua/5' : ''}`}>
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-aqua to-coral flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-semibold text-gray-900 truncate">{chat.name}</h3>
                <span className="text-xs text-gray-500">{chat.time}</span>
              </div>
              <p className="text-sm text-gray-600 truncate">{chat.message}</p>
            </div>
            {chat.unread && (
              <div className="w-2 h-2 rounded-full bg-aqua flex-shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Provider Dashboard Screen
 */
export function ProviderScreen() {
  return (
    <div className="h-full bg-white pt-16 pb-20 overflow-y-auto">
      <div className="px-4">
        <div className="bg-gradient-to-br from-aqua to-coral text-white rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-bold mb-6">This Week</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm opacity-90 mb-1">Bookings</p>
              <p className="text-3xl font-bold">24</p>
            </div>
            <div>
              <p className="text-sm opacity-90 mb-1">Revenue</p>
              <p className="text-3xl font-bold">₹12K</p>
            </div>
          </div>
        </div>

        <h3 className="font-bold mb-4 text-gray-900">Upcoming Sessions</h3>
        {[
          { client: 'Priya Sharma', time: 'Today, 6:00 PM', service: 'Yoga Class' },
          { client: 'Raj Patel', time: 'Tomorrow, 7:00 AM', service: 'Personal Training' },
        ].map((session, i) => (
          <div key={i} className="bg-gray-50 rounded-xl p-4 mb-3">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-aqua to-coral" />
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">{session.client}</h4>
                <p className="text-sm text-gray-600">{session.service}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar size={14} />
              <span>{session.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
