import { CURRENT_USER, flashAuthors } from './posts';
import type { PostAuthor } from './types';
import {
  STORY_DEFAULT_DURATION_MS,
  STORY_LIFETIME_MS,
  type StoryItem,
  type UserStory,
} from './storyTypes';

const img = (id: string, w = 800, h = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

const avatar = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=200&h=200&q=80`;

function storyItem(
  id: string,
  type: StoryItem['type'],
  opts: Partial<StoryItem> & { hoursAgo?: number },
): StoryItem {
  const hoursAgo = opts.hoursAgo ?? 2;
  const createdAt = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
  return {
    id,
    type,
    createdAt,
    expiresAt: new Date(new Date(createdAt).getTime() + STORY_LIFETIME_MS).toISOString(),
    durationMs: STORY_DEFAULT_DURATION_MS,
    ...opts,
  };
}

const priya: PostAuthor = {
  id: 'user-priya',
  name: 'Priya',
  avatarUrl: avatar('photo-1494790108377-be9c29b29330'),
  followed: true,
};

const arun: PostAuthor = {
  id: 'user-arun',
  name: 'Arun',
  avatarUrl: avatar('photo-1500648767791-00dcc994a43e'),
  followed: true,
};

export const seedStories: UserStory[] = [
  {
    authorId: CURRENT_USER.id,
    author: CURRENT_USER,
    audience: 'followers',
    items: [],
  },
  {
    authorId: flashAuthors.ravi.id,
    author: flashAuthors.ravi,
    audience: 'followers',
    items: [
      storyItem('story-ravi-1', 'photo', {
        mediaUrl: img('photo-1476480862126-209bfaa8edc8'),
        hoursAgo: 2,
      }),
      storyItem('story-ravi-2', 'text', {
        textContent: '5K done before sunrise 🌅',
        backgroundColor: '#0F766E',
        hoursAgo: 1,
      }),
    ],
  },
  {
    authorId: priya.id,
    author: priya,
    audience: 'close_friends',
    items: [
      storyItem('story-priya-1', 'photo', {
        mediaUrl: img('photo-1576091160399-112ba8d25d1d'),
        hoursAgo: 4,
      }),
    ],
  },
  {
    authorId: arun.id,
    author: arun,
    audience: 'followers',
    items: [
      storyItem('story-arun-1', 'photo', {
        mediaUrl: img('photo-1517649763962-0c623066027b'),
        hoursAgo: 6,
      }),
    ],
  },
  {
    authorId: flashAuthors.ananya.id,
    author: flashAuthors.ananya,
    audience: 'followers',
    items: [
      storyItem('story-ananya-1', 'photo', {
        mediaUrl: img('photo-1576091160550-2173dba999ef'),
        hoursAgo: 3,
      }),
    ],
  },
  {
    authorId: flashAuthors.yoga.id,
    author: flashAuthors.yoga,
    audience: 'followers',
    items: [
      storyItem('story-yoga-1', 'text', {
        textContent: 'Morning flow starts at 6 AM 🧘',
        backgroundColor: '#7C3AED',
        hoursAgo: 5,
      }),
    ],
  },
  {
    authorId: flashAuthors.trek.id,
    author: flashAuthors.trek,
    audience: 'followers',
    items: [
      storyItem('story-trek-1', 'photo', {
        mediaUrl: img('photo-1551632811-561732d1e306'),
        hoursAgo: 7,
      }),
    ],
  },
  {
    authorId: flashAuthors.shop.id,
    author: flashAuthors.shop,
    audience: 'followers',
    items: [
      storyItem('story-shop-1', 'photo', {
        mediaUrl: img('photo-1517836357463-d25dfeac3438'),
        hoursAgo: 8,
      }),
    ],
  },
  {
    authorId: flashAuthors.home.id,
    author: flashAuthors.home,
    audience: 'followers',
    items: [
      storyItem('story-home-1', 'text', {
        textContent: 'AC service slots open today ❄️',
        backgroundColor: '#1D4ED8',
        hoursAgo: 9,
      }),
    ],
  },
];

/** How many story rings show before horizontal scroll loads the next batch. */
export const STORY_TRAY_PAGE_SIZE = 5;

/** Pre-seed viewed state for demo (Arun already seen). */
export const seedViewedStoryItems: Record<string, string[]> = {
  [arun.id]: ['story-arun-1'],
};

export const STORY_SAMPLE_PHOTOS = [
  img('photo-1476480862126-209bfaa8edc8'),
  img('photo-1544367567-0f2fcb009e0b'),
  img('photo-1517836357463-d25dfeac3438'),
];

export const STORY_TEXT_BACKGROUNDS = ['#0F766E', '#7C3AED', '#BE185D', '#1D4ED8'];
