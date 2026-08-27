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
}

export interface PostMedia {
  id: string;
  type: 'image' | 'video';
  url: string;
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
