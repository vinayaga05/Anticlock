import React from 'react';
import { Dimensions, Platform, StyleSheet, Text, View } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/shared/hooks/useTheme';
import { useCartStore } from '@/shared/store/cartStore';
import { AppIcon, IconName } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { CommentsBottomSheetHost } from '@/shared/navigation/CommentsBottomSheetHost';
import { useCommentsSheetStore } from '@/shared/store/commentsSheetStore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/** Visible control height for the floating pill (icons + labels). */
export const TAB_BAR_VISIBLE_HEIGHT = 66;

const TAB_ICONS: Record<string, IconName> = {
  PlayFeed: 'reels',
  Flash: 'zap',
  Needs: 'clipboard',
  Community: 'community',
  Knock: 'messages',
  Shop: 'shop',
};

export function FloatingPillTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const cartCount = useCartStore(s => s.count);
  const commentsOpen = useCommentsSheetStore(s => s.open || s.closing);
  const requestClose = useCommentsSheetStore(s => s.requestClose);

  const focusedRoute = state.routes[state.index]?.name;
  const onPlayFeed = focusedRoute === 'PlayFeed';
  const bottomPad = Math.max(insets.bottom, 8) + 8;
  const layoutHeight = TAB_BAR_VISIBLE_HEIGHT + bottomPad;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.root, { height: layoutHeight, zIndex: 100, elevation: 100 }]}>
      <View
        pointerEvents="box-none"
        style={[styles.wrap, { paddingBottom: bottomPad, zIndex: 30, elevation: 30 }]}>
        <View
          style={[
            styles.bar,
            {
              backgroundColor: onPlayFeed ? 'rgba(12,11,10,0.94)' : theme.colors.tabBar,
              borderColor: onPlayFeed ? 'rgba(255,255,255,0.12)' : theme.colors.borderSoft,
              ...theme.shadows.float,
            },
          ]}>
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const { options } = descriptors[route.key];
            const icon = TAB_ICONS[route.name] ?? 'home';
            const label = String(
              typeof options.tabBarAccessibilityLabel === 'string'
                ? options.tabBarAccessibilityLabel
                : route.name,
            );

            const onPress = () => {
              const go = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (focused) {
                  return;
                }
                if (!event.defaultPrevented) {
                  navigation.navigate(route.name, route.params);
                }
              };

              if (commentsOpen) {
                requestClose(go);
                return;
              }
              go();
            };

            const inactiveColor = onPlayFeed
              ? 'rgba(255,255,255,0.55)'
              : theme.colors.tabIcon;
            const activeColor = onPlayFeed ? '#FFFFFF' : theme.colors.tabIconActive;

            return (
              <PressableScale
                key={route.key}
                onPress={onPress}
                accessibilityLabel={label}
                scaleTo={0.96}
                style={
                  focused && !onPlayFeed
                    ? [
                        styles.item,
                        {
                          backgroundColor: theme.colors.primarySoft,
                          borderRadius: 18,
                        },
                      ]
                    : styles.item
                }>
                <View style={styles.iconHit}>
                  <AppIcon
                    name={icon}
                    size={23}
                    color={focused ? activeColor : inactiveColor}
                    strokeWidth={1.75}
                  />
                  {route.name === 'Shop' && cartCount > 0 ? (
                    <View style={[styles.badge, { backgroundColor: theme.colors.like }]}>
                      <Text style={styles.badgeText}>
                        {cartCount > 99 ? '99+' : cartCount}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color: focused ? activeColor : inactiveColor,
                      fontWeight: focused ? '700' : '500',
                    },
                  ]}
                  numberOfLines={1}>
                  {label}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      </View>

      <View
        pointerEvents="box-none"
        style={[styles.sheetLayer, { height: SCREEN_HEIGHT, zIndex: 50, elevation: 50 }]}>
        <CommentsBottomSheetHost />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 0,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 440,
    height: TAB_BAR_VISIBLE_HEIGHT,
    borderRadius: 30,
    paddingHorizontal: 4,
    borderWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      android: { elevation: 40 },
      default: {},
    }),
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: TAB_BAR_VISIBLE_HEIGHT - 8,
    gap: 3,
    paddingHorizontal: 2,
  },
  iconHit: {
    width: 28,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: 0.1,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '700',
  },
});
