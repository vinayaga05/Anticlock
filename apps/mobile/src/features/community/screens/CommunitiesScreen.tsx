import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { Button } from '@/shared/components/Button';
import { AppIcon, IconName } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';
import { communities } from '@/shared/data/mocks';

const TABS: { id: string; label: string; icon: IconName }[] = [
  { id: 'explore', label: 'Explore', icon: 'search' },
  { id: 'club', label: 'Club', icon: 'users' },
  { id: 'challenge', label: 'Challenge', icon: 'activity' },
  { id: 'friends', label: 'Friends', icon: 'user-plus' },
];

export function CommunitiesScreen() {
  const theme = useTheme();
  const [tab, setTab] = useState('explore');
  const [joined, setJoined] = useState<Record<string, boolean>>(
    Object.fromEntries(communities.map(c => [c.id, c.joined])),
  );

  return (
    <ScreenContainer scrollable>
      <AppHeader title="Community" />
      <View style={styles.tabs}>
        {TABS.map(t => {
          const active = t.id === tab;
          return (
            <PressableScale
              key={t.id}
              onPress={() => setTab(t.id)}
              accessibilityLabel={t.label}
              style={[
                styles.tab,
                {
                  backgroundColor: active ? theme.colors.primarySoft : theme.colors.surface,
                  borderColor: active ? theme.colors.primary : theme.colors.border,
                  borderRadius: theme.radius.md,
                },
              ]}>
              <AppIcon
                name={t.icon}
                size={18}
                color={active ? theme.colors.primary : theme.colors.textSecondary}
              />
              <Text
                style={[
                  theme.typography.caption,
                  {
                    color: active ? theme.colors.primary : theme.colors.textSecondary,
                    fontWeight: '600',
                  },
                ]}>
                {t.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      {communities.map(community => {
        const isJoined = joined[community.id];
        return (
          <View
            key={community.id}
            style={[styles.card, { borderRadius: theme.radius.xl, ...theme.shadows.card }]}>
            <Image source={{ uri: community.imageUrl }} style={styles.image} />
            <View style={styles.overlay}>
              <View style={{ flex: 1 }}>
                <Text style={[theme.typography.title, { color: '#fff', fontSize: 20 }]}>
                  {community.name}
                </Text>
                <View style={styles.members}>
                  <AppIcon name="users" size={14} color="rgba(255,255,255,0.85)" />
                  <Text style={[theme.typography.bodySmall, { color: 'rgba(255,255,255,0.85)' }]}>
                    {community.membersLabel}
                  </Text>
                </View>
              </View>
              <Button
                title={isJoined ? 'Joined' : 'Join'}
                variant={isJoined ? 'secondary' : 'primary'}
                onPress={() =>
                  setJoined(prev => ({ ...prev, [community.id]: !isJoined }))
                }
                style={{ minWidth: 96 }}
              />
            </View>
          </View>
        );
      })}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  card: {
    height: 190,
    overflow: 'hidden',
  },
  image: { ...StyleSheet.absoluteFill },
  overlay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.32)',
    gap: 12,
  },
  members: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
});
