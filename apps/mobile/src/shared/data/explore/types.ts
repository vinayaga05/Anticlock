export type ExploreKind = 'event' | 'product';

/** Review workflow — independent from audience visibility. */
export type ExploreReviewStatus =
  | 'draft'
  | 'submitted'
  | 'pending_review'
  | 'approved'
  | 'changes_requested'
  | 'rejected'
  | 'suspended'
  | 'archived'
  | 'needs_changes'
  | 'rejected_policy';

/** Who can see the listing. */
export type ExploreVisibility = 'followers_only' | 'public';

export type ExploreSubmissionMeta = {
  reviewStatus: ExploreReviewStatus;
  visibility: ExploreVisibility;
  submittedBy: string;
  submittedAt: string;
  reviewNote?: string;
};

export type ExploreEventItem = {
  kind: 'event';
  id: string;
  title: string;
  imageUrl: string;
  organizer: string;
  dateLabel: string;
  timeLabel?: string;
  location: string;
  distanceKm?: number;
  price: number;
  spotsLeft: number;
  category?: string;
  meta: ExploreSubmissionMeta;
};

export type ExploreProductItem = {
  kind: 'product';
  id: string;
  title: string;
  imageUrl: string;
  seller: string;
  price: number;
  compareAtPrice?: number;
  rating: number;
  reviewCount: number;
  category?: string;
  meta: ExploreSubmissionMeta;
};

export type ExploreItem = ExploreEventItem | ExploreProductItem;

export function reviewStatusLabel(status: ExploreReviewStatus): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'submitted':
    case 'pending_review':
      return 'Pending Review';
    case 'approved':
      return 'Approved';
    case 'needs_changes':
    case 'changes_requested':
      return 'Needs Changes';
    case 'rejected_policy':
    case 'rejected':
      return 'Rejected';
    case 'suspended':
      return 'Suspended';
    case 'archived':
      return 'Archived';
  }
}

export function visibilityLabel(visibility: ExploreVisibility): string {
  return visibility === 'public' ? 'Public in Explore' : 'Visible to followers only';
}
