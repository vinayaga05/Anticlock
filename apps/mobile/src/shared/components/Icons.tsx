import React from 'react';
import { AppIcon, IconName } from '@/shared/components/AppIcon';

type LegacyProps = {
  size?: number;
  color?: string;
  filled?: boolean;
};

function Legacy({
  name,
  size = 26,
  color = '#F5F5F7',
  filled,
}: LegacyProps & { name: IconName }) {
  return (
    <AppIcon
      name={name}
      size={size}
      color={color}
      strokeWidth={filled ? 2.2 : 1.75}
    />
  );
}

export const HomeIcon = (p: LegacyProps) => <Legacy name="home" {...p} />;
export const SearchIcon = (p: LegacyProps) => <Legacy name="search" {...p} />;
export const ReelsIcon = (p: LegacyProps) => <Legacy name="reels" {...p} />;
export const ShopIcon = (p: LegacyProps) => <Legacy name="shop" {...p} />;
export const ProfileIcon = (p: LegacyProps) => <Legacy name="profile" {...p} />;
export const HeartIcon = (p: LegacyProps) => <Legacy name="heart" {...p} />;
export const CommentIcon = (p: LegacyProps) => <Legacy name="comment" {...p} />;
export const ShareIcon = (p: LegacyProps) => <Legacy name="share" {...p} />;
export const BookmarkIcon = (p: LegacyProps) => <Legacy name="bookmark" {...p} />;
export const SettingsIcon = (p: LegacyProps) => <Legacy name="settings" {...p} />;
export const PlusIcon = (p: LegacyProps) => <Legacy name="plus" {...p} />;
export const CrossIcon = (p: LegacyProps) => <Legacy name="create" {...p} />;
export const HeartBeatIcon = (p: LegacyProps) => <Legacy name="health" {...p} />;
export const BackIcon = (p: LegacyProps) => <Legacy name="back" {...p} />;
export const LocationIcon = (p: LegacyProps) => <Legacy name="location" {...p} />;
export const CartIcon = (p: LegacyProps) => <Legacy name="cart" {...p} />;
export const BookIcon = (p: LegacyProps) => <Legacy name="calendar" {...p} />;
export const CallIcon = (p: LegacyProps) => <Legacy name="messages" {...p} />;
export const ThumbDownIcon = (p: LegacyProps) => <Legacy name="unlike" {...p} />;
export const MessengerIcon = (p: LegacyProps) => <Legacy name="messages" {...p} />;
export const MenuIcon = (p: LegacyProps) => <Legacy name="more" {...p} />;
export const MoreIcon = (p: LegacyProps) => <Legacy name="more" {...p} />;
export const VerifiedBadge = (p: LegacyProps) => (
  <Legacy name="check-circle" color={p.color ?? '#2DD4BF'} size={p.size ?? 14} />
);
