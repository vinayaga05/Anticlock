import type {
  MediaAsset,
  ReelAdmin,
  ReelContentMode,
  ReelModerationStatus,
  ReelStatus,
} from '@anticlock/contracts';

export type ReelPreviewModel = {
  title: string;
  caption: string;
  creatorName: string;
  playbackUrl: string | null;
  posterUrl: string | null;
  likeCount: number;
  commentCount: number;
  saveCount: number;
  ctaLabel: string | null;
  status: ReelStatus | 'unsaved';
  contentMode: ReelContentMode;
  moderationStatus: ReelModerationStatus | null;
  mediaProcessingStatus: string | null;
};

export type ReelDraftFormPreview = {
  title: string;
  caption: string;
  creatorName: string;
  likeCount: number;
  commentCount: number;
  saveCount: number;
  contentMode: ReelContentMode;
  externalPlaybackUrl: string;
  externalPosterUrl: string;
};

export function previewFromReel(reel: ReelAdmin): ReelPreviewModel {
  return {
    title: reel.title,
    caption: reel.caption ?? '',
    creatorName: reel.creatorName,
    playbackUrl: reel.playbackUrl ?? null,
    posterUrl: reel.posterUrl ?? null,
    likeCount: reel.likeCount,
    commentCount: reel.commentCount,
    saveCount: reel.saveCount,
    ctaLabel: reel.cta?.ctaLabel ?? (reel.cta ? 'Book' : null),
    status: reel.status,
    contentMode: reel.contentMode,
    moderationStatus: reel.moderationStatus,
    mediaProcessingStatus: reel.mediaProcessingStatus ?? null,
  };
}

export function previewFromDraft(
  form: ReelDraftFormPreview,
  media: MediaAsset | null,
): ReelPreviewModel {
  const external = form.externalPlaybackUrl.trim();
  return {
    title: form.title,
    caption: form.caption,
    creatorName: form.creatorName,
    playbackUrl: media?.deliveryUrl ?? (external || null),
    posterUrl: form.externalPosterUrl.trim() || null,
    likeCount: form.likeCount,
    commentCount: form.commentCount,
    saveCount: form.saveCount,
    ctaLabel: null,
    status: 'unsaved',
    contentMode: form.contentMode,
    moderationStatus: null,
    mediaProcessingStatus: media?.processingStatus ?? (external ? 'ready' : null),
  };
}

export function describeMobileVisibility(model: ReelPreviewModel): {
  tone: 'live' | 'hidden' | 'warning';
  label: string;
  detail: string;
} {
  if (model.status === 'unsaved') {
    return {
      tone: 'warning',
      label: 'Unsaved draft',
      detail: 'Save the reel to persist changes. This preview updates as you edit.',
    };
  }
  if (model.contentMode === 'test') {
    return {
      tone: 'hidden',
      label: 'Hidden from Clips',
      detail: 'Test reels never appear in the mobile feed.',
    };
  }
  if (model.status !== 'published') {
    return {
      tone: 'hidden',
      label: 'Not on mobile yet',
      detail: `Status is ${model.status.replace('_', ' ')}. Publish to show in Clips.`,
    };
  }
  if (
    model.moderationStatus === 'restricted' ||
    model.moderationStatus === 'removed'
  ) {
    return {
      tone: 'hidden',
      label: 'Moderation blocked',
      detail: `Reel is ${model.moderationStatus.replace('_', ' ')} and excluded from Clips.`,
    };
  }
  if (model.mediaProcessingStatus && model.mediaProcessingStatus !== 'ready') {
    return {
      tone: 'warning',
      label: 'Video not ready',
      detail: 'Mobile playback requires a ready video asset.',
    };
  }
  return {
    tone: 'live',
    label: 'Live on Clips',
    detail: 'Published reel visible in the mobile Clips tab.',
  };
}

export function formatPreviewCount(n: number) {
  if (!Number.isFinite(n) || n < 0) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function previewAuthorHandle(creatorName: string) {
  const trimmed = creatorName.trim();
  if (!trimmed) return '@creator';
  const handle = trimmed.toLowerCase().replace(/\s+/g, '.');
  return `@${handle}`;
}

export function previewInitials(creatorName: string) {
  const parts = creatorName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');
}
