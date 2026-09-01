import React, { useMemo, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/shared/hooks/useTheme';
import { useThemeStore } from '@/shared/store/themeStore';
import { useAuth } from '@/shared/context/AuthProvider';
import { AppIcon, IconName } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { CURRENT_USER, getProfileMeta, getProfileShortcuts } from '@/shared/data/flash';
import { useEngagementStore } from '@/shared/services/engagementRepository';
import { useMyProviderApplicationQuery } from '@/shared/api/providerHooks';
import { useStoryStore } from '@/shared/data/flash/storyStore';

type MenuItem = {
  id: string;
  label: string;
  icon: IconName;
  onPress: () => void;
};

type Shortcut = {
  id: string;
  label: string;
  imageUrl: string;
  onPress: () => void;
};

type AccordionSection = {
  id: string;
  label: string;
  icon: IconName;
  items: { label: string; onPress: () => void }[];
};

function MenuRow({
  icon,
  label,
  onPress,
  showDivider = true,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  showDivider?: boolean;
}) {
  const theme = useTheme();
  return (
    <>
      <PressableScale onPress={onPress} style={styles.menuRow}>
        <View style={[styles.menuIconWrap, { backgroundColor: theme.colors.surfaceMuted }]}>
          <AppIcon name={icon} size={22} color={theme.colors.textPrimary} strokeWidth={1.75} />
        </View>
        <Text style={[styles.menuLabel, { color: theme.colors.textPrimary }]}>{label}</Text>
      </PressableScale>
      {showDivider ? (
        <View style={[styles.divider, { backgroundColor: theme.colors.borderSoft }]} />
      ) : null}
    </>
  );
}

export function ProfileScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const setMode = useThemeStore(s => s.setMode);
  const mode = useThemeStore(s => s.mode);
  const { user, logout } = useAuth();
  const displayName = user?.displayName ?? CURRENT_USER.name;
  const avatarUrl = user?.avatarUrl ?? CURRENT_USER.avatarUrl;
  const profileId = user?.id ?? CURRENT_USER.id;
  const meta = getProfileMeta(profileId);
  const saved = useEngagementStore(s => s.saved);
  const storyRevision = useStoryStore(s => `${s.stories.length}-${s.archive.length}`);
  const { data: providerApplication } = useMyProviderApplicationQuery();
  const isServiceProvider = Boolean(user?.roles?.includes('service_provider'));

  const shortcuts: Shortcut[] = useMemo(() => {
    return getProfileShortcuts(profileId).map(item => ({
      id: item.id,
      label: item.label,
      imageUrl: item.imageUrl,
      onPress: () => {
        if (item.kind === 'team' && item.refId) {
          navigation.navigate('TeamDetail', { teamId: item.refId });
          return;
        }
        if (item.kind === 'saved') {
          navigation.navigate('SavedHub');
          return;
        }
        if (item.kind === 'story') {
          navigation.navigate('StoryViewer', { authorId: profileId });
          return;
        }
      },
    }));
  }, [navigation, profileId, saved.length, storyRevision]);

  const savedBadge = saved.length > 9 ? '9+' : saved.length > 0 ? String(saved.length) : null;

  const [showMore, setShowMore] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const primaryItems: MenuItem[] = useMemo(
    () => [
      {
        id: 'ai',
        label: 'Anticlock AI',
        icon: 'sparkles',
        onPress: () => navigation.navigate('ComingSoon', { title: 'Anticlock AI' }),
      },
      {
        id: 'provider',
        label: isServiceProvider ? 'Provider dashboard' : 'Become a Service Provider',
        icon: 'badge-check',
        onPress: () =>
          isServiceProvider
            ? navigation.navigate('ProviderDashboard')
            : providerApplication
              ? navigation.navigate('ProviderApplicationStatus', {
                  applicationId: providerApplication.id,
                })
              : navigation.navigate('ProviderApplicationIntro'),
      },
      {
        id: 'saved',
        label: 'Saved',
        icon: 'save',
        onPress: () => navigation.navigate('SavedHub'),
      },
      {
        id: 'bookings',
        label: 'My Bookings',
        icon: 'calendar',
        onPress: () => navigation.navigate('MyBookings'),
      },
      {
        id: 'shop',
        label: 'Shop',
        icon: 'shop',
        onPress: () => navigation.navigate('Main', { screen: 'Shop' }),
      },
      {
        id: 'communities',
        label: 'Communities',
        icon: 'community',
        onPress: () => navigation.navigate('Main', { screen: 'Community' }),
      },
    ],
    [navigation, isServiceProvider, providerApplication],
  );

  const moreItems: MenuItem[] = useMemo(
    () => [
      {
        id: 'orders',
        label: 'My Orders',
        icon: 'package',
        onPress: () => navigation.navigate('MyOrders'),
      },
      {
        id: 'trips',
        label: 'My Trips',
        icon: 'globe',
        onPress: () => navigation.navigate('MyTrips'),
      },
      {
        id: 'courses',
        label: 'My Courses',
        icon: 'graduation-cap',
        onPress: () => navigation.navigate('MyLearning'),
      },
      {
        id: 'requests',
        label: 'Service Requests',
        icon: 'home',
        onPress: () => navigation.navigate('MyServiceRequests'),
      },
      {
        id: 'messages',
        label: 'Messages',
        icon: 'messages',
        onPress: () => navigation.navigate('Main', { screen: 'Knock' }),
      },
    ],
    [navigation],
  );

  const accordionSections: AccordionSection[] = useMemo(
    () => [
      {
        id: 'help',
        label: 'Help and support',
        icon: 'support',
        items: [
          { label: 'Help Center', onPress: () => navigation.navigate('ComingSoon', { title: 'Help Center' }) },
          { label: 'Contact us', onPress: () => navigation.navigate('ComingSoon', { title: 'Contact us' }) },
        ],
      },
      {
        id: 'settings',
        label: 'Settings and privacy',
        icon: 'settings',
        items: [
          {
            label: `Appearance: ${mode}`,
            onPress: () => setMode(mode === 'dark' ? 'light' : 'dark'),
          },
          { label: 'Privacy', onPress: () => navigation.navigate('ComingSoon', { title: 'Privacy' }) },
          { label: 'Notifications', onPress: () => navigation.navigate('ComingSoon', { title: 'Notifications' }) },
          {
            label: 'Log out',
            onPress: () => {
              void logout();
            },
          },
        ],
      },
      {
        id: 'upgrades',
        label: 'Upgrades',
        icon: 'grid',
        items: [
          { label: 'Anticlock Plus', onPress: () => navigation.navigate('ComingSoon', { title: 'Anticlock Plus' }) },
          {
            label: isServiceProvider ? 'Provider dashboard' : 'Provider tools',
            onPress: () =>
              isServiceProvider
                ? navigation.navigate('ProviderDashboard')
                : providerApplication
                  ? navigation.navigate('ProviderApplicationStatus', {
                      applicationId: providerApplication.id,
                    })
                  : navigation.navigate('ProviderApplicationIntro'),
          },
        ],
      },
    ],
    [mode, navigation, setMode, logout, isServiceProvider, providerApplication],
  );

  const visibleItems = showMore ? [...primaryItems, ...moreItems] : primaryItems;

  const toggleSection = (id: string) => {
    setExpanded(prev => (prev === id ? null : id));
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + 8,
            backgroundColor: theme.colors.background,
            borderBottomColor: theme.colors.borderSoft,
          },
        ]}>
        <PressableScale onPress={() => navigation.goBack()} style={styles.topHit}>
          <AppIcon name="back" size={24} color={theme.colors.textPrimary} strokeWidth={2} />
        </PressableScale>
        <Text style={[styles.topTitle, { color: theme.colors.textPrimary }]}>Menu</Text>
        <View style={styles.topHit} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}>
        <PressableScale
          onPress={() => navigation.navigate('Profile', { userId: profileId })}
          style={[
            styles.profileCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.borderSoft,
              ...theme.shadows.soft,
            },
          ]}>
          <Image source={{ uri: avatarUrl ?? CURRENT_USER.avatarUrl }} style={styles.profileAvatar} />
          <Text style={[styles.profileName, { color: theme.colors.textPrimary }]}>
            {displayName}
          </Text>
          <View style={styles.profileActions}>
              <View style={[styles.switcherBtn, { backgroundColor: theme.colors.surfaceMuted }]}>
              <Image
                source={{ uri: avatarUrl ?? CURRENT_USER.avatarUrl }}
                style={styles.switcherAvatar}
              />
              {savedBadge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{savedBadge}</Text>
                </View>
              ) : null}
            </View>
            <View style={[styles.switcherBtn, { backgroundColor: theme.colors.surfaceMuted }]}>
              <AppIcon
                name="chevron-down"
                size={18}
                color={theme.colors.textPrimary}
                strokeWidth={2.5}
              />
            </View>
          </View>
        </PressableScale>

        {shortcuts.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
              Your shortcuts
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.shortcutsRow}>
              {shortcuts.map(item => (
                <PressableScale
                  key={item.id}
                  onPress={item.onPress}
                  style={styles.shortcutItem}>
                  <Image source={{ uri: item.imageUrl }} style={styles.shortcutImage} />
                  <Text
                    style={[styles.shortcutLabel, { color: theme.colors.textPrimary }]}
                    numberOfLines={1}>
                    {item.label}
                  </Text>
                </PressableScale>
              ))}
            </ScrollView>
          </>
        ) : null}

        <View
          style={[
            styles.menuCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.borderSoft,
            },
          ]}>
          {visibleItems.map((item, index) => (
            <MenuRow
              key={item.id}
              icon={item.icon}
              label={item.label}
              onPress={item.onPress}
              showDivider={index < visibleItems.length - 1}
            />
          ))}

          {!showMore ? (
            <PressableScale
              onPress={() => setShowMore(true)}
              style={[styles.seeMoreBtn, { backgroundColor: theme.colors.surfaceMuted }]}>
              <Text style={[styles.seeMoreText, { color: theme.colors.textPrimary }]}>
                See more
              </Text>
            </PressableScale>
          ) : null}
        </View>

        <View
          style={[
            styles.menuCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.borderSoft,
              marginTop: 12,
            },
          ]}>
          {accordionSections.map((section, index) => {
            const isOpen = expanded === section.id;
            return (
              <View key={section.id}>
                <PressableScale
                  onPress={() => toggleSection(section.id)}
                  style={styles.accordionHeader}>
                  <View
                    style={[
                      styles.menuIconWrap,
                      { backgroundColor: theme.colors.surfaceMuted },
                    ]}>
                    <AppIcon
                      name={section.icon}
                      size={22}
                      color={theme.colors.textPrimary}
                      strokeWidth={1.75}
                    />
                  </View>
                  <Text style={[styles.menuLabel, { color: theme.colors.textPrimary, flex: 1 }]}>
                    {section.label}
                  </Text>
                  <AppIcon
                    name="chevron-down"
                    size={20}
                    color={theme.colors.textSecondary}
                    strokeWidth={2}
                    style={isOpen ? { transform: [{ rotate: '180deg' }] } : undefined}
                  />
                </PressableScale>
                {isOpen
                  ? section.items.map(item => (
                      <PressableScale
                        key={item.label}
                        onPress={item.onPress}
                        style={styles.accordionItem}>
                        <Text style={[styles.accordionItemText, { color: theme.colors.textSecondary }]}>
                          {item.label}
                        </Text>
                      </PressableScale>
                    ))
                  : null}
                {index < accordionSections.length - 1 ? (
                  <View style={[styles.divider, { backgroundColor: theme.colors.borderSoft }]} />
                ) : null}
              </View>
            );
          })}
        </View>

        <Text style={[styles.footerMeta, { color: theme.colors.textTertiary }]}>
          {meta.username} · {meta.location}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topHit: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  profileName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  profileActions: {
    flexDirection: 'row',
    gap: 8,
  },
  switcherBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  switcherAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E41E3F',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  shortcutsRow: {
    gap: 14,
    paddingRight: 8,
  },
  shortcutItem: {
    width: 78,
    alignItems: 'center',
    gap: 8,
  },
  shortcutImage: {
    width: 78,
    height: 78,
    borderRadius: 12,
  },
  shortcutLabel: {
    fontSize: 12,
    textAlign: 'center',
    width: '100%',
  },
  menuCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingVertical: 4,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 14,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 64,
  },
  seeMoreBtn: {
    marginHorizontal: 14,
    marginVertical: 10,
    minHeight: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seeMoreText: {
    fontSize: 15,
    fontWeight: '600',
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 14,
  },
  accordionItem: {
    paddingLeft: 64,
    paddingRight: 14,
    paddingVertical: 12,
  },
  accordionItemText: {
    fontSize: 15,
  },
  footerMeta: {
    textAlign: 'center',
    fontSize: 13,
    marginTop: 8,
  },
});
