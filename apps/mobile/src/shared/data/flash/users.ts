import { CURRENT_USER, flashAuthors } from '@/shared/data/flash/posts';
import { seedStories } from '@/shared/data/flash/stories';
import { PostAuthor, UserProfileMeta } from '@/shared/data/flash/types';

const img = (id: string, w = 200, h = 200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

export const USER_PROFILES: Record<string, UserProfileMeta> = {
  'user-me': {
    username: '__v_i_n_a_y__',
    location: 'Pondicherry',
    followerCount: 164,
    followingCount: 1625,
    isPrivate: true,
    highlights: [
      { id: 'hl-new', label: 'New', isNew: true },
      {
        id: 'hl-1',
        label: '🤎',
        imageUrl: img('photo-1476480862126-209bfaa8edc8'),
      },
    ],
  },
  'user-ravi': {
    username: 'ravi.runs',
    bio: 'Half marathon trainee · Chennai mornings',
    location: 'Chennai',
    followerCount: 892,
    followingCount: 412,
    highlights: [
      { id: 'hl-new', label: 'New', isNew: true },
      {
        id: 'hl-1',
        label: 'Runs',
        imageUrl: img('photo-1476480862126-209bfaa8edc8'),
      },
    ],
  },
  'user-ananya': {
    username: 'dr.ananya',
    bio: 'Physiotherapy · Sports recovery',
    location: 'Chennai',
    followerCount: 4200,
    followingCount: 318,
    highlights: [
      {
        id: 'hl-1',
        label: 'Clinic',
        imageUrl: img('photo-1576091160399-112ba8d25d1d'),
      },
    ],
  },
  'user-yoga': {
    username: 'yoga.meera',
    bio: 'Online yoga programs',
    location: 'India',
    followerCount: 12800,
    followingCount: 890,
    highlights: [
      {
        id: 'hl-1',
        label: 'Flows',
        imageUrl: img('photo-1544367567-0f2fcb009e0b'),
      },
    ],
  },
  'user-fitstore': {
    username: 'fitstore.chennai',
    bio: 'Fitness gear & home gym setups',
    location: 'Chennai',
    followerCount: 5600,
    followingCount: 220,
    highlights: [
      {
        id: 'hl-1',
        label: 'Gear',
        imageUrl: img('photo-1517836357463-d25dfeac3438'),
      },
    ],
  },
  'user-trek': {
    username: 'trail.collective',
    bio: 'Weekend treks & outdoor events',
    location: 'South India',
    followerCount: 3100,
    followingCount: 540,
    highlights: [
      {
        id: 'hl-1',
        label: 'Trails',
        imageUrl: img('photo-1551632811-561732d1e306'),
      },
    ],
  },
  'user-fixit': {
    username: 'quickfix.home',
    bio: 'Home services on demand',
    location: 'Chennai',
    followerCount: 980,
    followingCount: 120,
  },
  'user-priya': {
    username: 'priya.fit',
    bio: 'Wellness & morning routines',
    location: 'Chennai',
    followerCount: 640,
    followingCount: 280,
    highlights: [
      {
        id: 'hl-1',
        label: 'Wellness',
        imageUrl: img('photo-1494790108377-be9c29b29330'),
      },
    ],
  },
  'user-arun': {
    username: 'arun.cricket',
    bio: 'Weekend cricket · Chennai Strikers',
    location: 'Chennai',
    followerCount: 1200,
    followingCount: 390,
    highlights: [
      {
        id: 'hl-1',
        label: 'Cricket',
        imageUrl: img('photo-1531415079145-90eeae4890e0'),
      },
    ],
  },
};

export function getUserById(userId: string): PostAuthor | undefined {
  if (userId === CURRENT_USER.id) return CURRENT_USER;
  const fromAuthors = Object.values(flashAuthors).find(a => a.id === userId);
  if (fromAuthors) return fromAuthors;
  return seedStories.find(s => s.authorId === userId)?.author;
}

export function getProfileMeta(userId: string): UserProfileMeta {
  const known = USER_PROFILES[userId];
  if (known) return known;
  const author = getUserById(userId);
  return {
    username: author?.name.toLowerCase().replace(/\s+/g, '.') ?? 'user',
    followerCount: 0,
    followingCount: 0,
  };
}

export function formatProfileCount(n: number) {
  return n.toLocaleString('en-US');
}
