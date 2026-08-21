import React, { useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { useTheme } from '@/shared/hooks/useTheme';
import { communities } from '@/shared/data/mocks';

const TABS = [
  { id: 'explore', label: 'Explore', icon: '🧭' },
  { id: 'club', label: 'Club', icon: '👥' },
  { id: 'challenge', label: 'Challenge', icon: '🏆' },
  { id: 'friends', label: 'Friends', icon: '➕' },
];

export function CommunitiesScreen() {
  const theme = useTheme();
  const [tab, setTab] = useState('explore');
  const [joined, setJoined] = useState<Record<string, boolean>>(
    Object.fromEntries(communities.map(c => [c.id, c.joined])),
  );

  return (
    <ScreenContainer scrollable>
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Communities</Text>
      <View style={styles.tabs}>
        {TABS.map(t => {
          const active = t.id === tab;
          return (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              style={[
                styles.tab,
                {
                  backgroundColor: active ? theme.colors.primary : theme.colors.backgroundElevated,
                  borderColor: theme.colors.primary,
                },
              ]}>
              <Text style={{ fontSize: 18 }}>{t.icon}</Text>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {communities.map(community => {
        const isJoined = joined[community.id];
        return (
          <View key={community.id} style={styles.card}>
            <Image source={{ uri: community.imageUrl }} style={styles.image} />
            <View style={styles.overlay}>
              <View>
                <Text style={styles.name}>{community.name}</Text>
                <Text style={styles.members}>{community.membersLabel}</Text>
              </View>
              <Pressable
                onPress={() =>
                  setJoined(prev => ({ ...prev, [community.id]: !isJoined }))
                }
                style={[
                  styles.join,
                  {
                    backgroundColor: isJoined ? 'rgba(0,0,0,0.45)' : theme.colors.primary,
                    borderColor: '#fff',
                    borderWidth: isJoined ? 1 : 0,
                  },
                ]}>
                <Text style={styles.joinText}>{isJoined ? 'Joined' : 'Join'}</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: 10,
    gap: 4,
  },
  card: {
    height: 180,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 4,
  },
  image: { ...StyleSheet.absoluteFill },
  overlay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  name: { color: '#fff', fontWeight: '700', fontSize: 18 },
  members: { color: '#eee', marginTop: 4 },
  join: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  joinText: { color: '#fff', fontWeight: '700' },
});
