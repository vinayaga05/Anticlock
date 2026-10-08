export type ReactionType =
  | 'like'
  | 'love'
  | 'support'
  | 'useful'
  | 'inspiring'
  | 'celebrate';

export type PostVisibility =
  | 'public'
  | 'followers'
  | 'friends'
  | 'community'
  | 'only_me';

export type FeedTab = 'forYou' | 'following' | 'nearby';

export type SavedContentKind =
  | 'flash'
  | 'clip'
  | 'service'
  | 'product'
  | 'course'
  | 'event';

export type PostAttachmentType =
  | 'service'
  | 'product'
  | 'course'
  | 'event'
  | 'home_service';

export interface PostAuthor {
  id: string;
  name: string;
  avatarUrl: string;
  verified?: boolean;
  isProvider?: boolean;
  followed?: boolean;
  /** Publisher profile kind when the author comes from the API. */
  profileType?: 'personal' | 'business';
  handle?: string | null;
  businessCategory?: string | null;
}

export interface ProfileHighlight {
  id: string;
  label: string;
  imageUrl?: string;
  isNew?: boolean;
}

export interface UserProfileMeta {
  username: string;
  bio?: string;
  location?: string;
  followerCount: number;
  followingCount: number;
  isPrivate?: boolean;
  highlights?: ProfileHighlight[];
}

export interface PostMedia {
  id: string;
  type: 'image' | 'video';
  /** Remote URL or Metro `require()` asset id for bundled Canva / Stream clips. */
  url: string | number;
  posterUrl?: string;
}

export interface PostLinkPreview {
  url: string;
  title: string;
  description: string;
  imageUrl?: string;
}

export interface PostAttachment {
  type: PostAttachmentType;
  title: string;
  subtitle: string;
  priceLabel?: string;
  meta?: string;
  imageUrl?: string;
  entityId: string;
  categoryId?: string;
  primaryCta: string;
  secondaryCta: string;
}

export interface FlashComment {
  id: string;
  postId: string;
  author: PostAuthor;
  text: string;
  createdAt: string;
  likeCount: number;
  liked?: boolean;
  parentId?: string;
  isOwn?: boolean;
}

export interface FlashPost {
  id: string;
  author: PostAuthor;
  createdAt: string;
  timeLabel: string;
  visibility: PostVisibility;
  text?: string;
  media: PostMedia[];
  linkPreview?: PostLinkPreview;
  sharedClipTitle?: string;
  attachment?: PostAttachment;
  communityName?: string;
  communityId?: string;
  feedTabs: FeedTab[];
  reactionCounts: Partial<Record<ReactionType, number>>;
  commentCount: number;
  shareCount: number;
  viewCount?: number;
  viewerReaction?: ReactionType | null;
  saved?: boolean;
  isOwn?: boolean;
  commentsEnabled?: boolean;
  pinned?: boolean;
  hidden?: boolean;
  /** `api` posts are server-published and refreshed from the Flash feed. */
  source?: 'api' | 'local';
  publisherProfileId?: string;
  publisherProfileType?: 'personal' | 'business';
}

export interface SavedContent {
  id: string;
  kind: SavedContentKind;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  refId: string;
  savedAt: string;
}
