import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_VISIBLE_HEIGHT } from '@/shared/navigation/FloatingPillTabBar';

/** Bottom inset so scroll content clears the floating tab bar. */
export function useTabBarBottomInset(extra = 24): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_VISIBLE_HEIGHT + Math.max(insets.bottom, 8) + extra;
}

export function getTabBarBottomInset(
  safeAreaBottom: number,
  extra = 24,
): number {
  return TAB_BAR_VISIBLE_HEIGHT + Math.max(safeAreaBottom, 8) + extra;
}
