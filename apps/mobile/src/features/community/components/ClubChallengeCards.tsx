import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { Card } from '@/shared/components/Card';
import { AppIcon } from '@/shared/components/AppIcon';
import {
  challengeStatusLabel,
  type Challenge,
  type Club,
  type ClubPlayer,
} from '@/shared/data/community';

export function ClubCard({
  club,
  onPress,
}: {
  club: Club;
  onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Card onPress={onPress} padded={false} elevated style={styles.clubCard}>
      <Image source={{ uri: club.coverUrl }} style={styles.clubCover} />
      <View style={styles.clubBody}>
        <View style={styles.clubHeader}>
          <Image source={{ uri: club.logoUrl }} style={styles.clubLogo} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={[theme.typography.section, { color: theme.colors.textPrimary }]}
              numberOfLines={1}>
              {club.name}
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
              {club.sport} · {club.location}
            </Text>
          </View>
        </View>
        <Text
          style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}
          numberOfLines={2}>
          {club.description}
        </Text>
        <View style={styles.metaRow}>
          <AppIcon name="users" size={14} color={theme.colors.primary} />
          <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
            {club.memberCount} members
          </Text>
        </View>
      </View>
    </Card>
  );
}

export function ChallengeCard({
  challenge,
  onPress,
  compact,
}: {
  challenge: Challenge;
  onPress?: () => void;
  compact?: boolean;
}) {
  const theme = useTheme();
  const statusColor =
    challenge.status === 'active'
      ? theme.colors.primary
      : challenge.status === 'upcoming'
        ? theme.colors.warning
        : theme.colors.textTertiary;

  return (
    <Card
      onPress={onPress}
      padded={false}
      elevated
      style={compact ? styles.challengeCompact : undefined}>
      <Image
        source={{ uri: challenge.coverUrl }}
        style={compact ? styles.challengeImageCompact : styles.challengeImage}
      />
      <View style={styles.challengeBody}>
        <View style={[styles.statusChip, { backgroundColor: `${statusColor}22` }]}>
          <Text style={[styles.statusChipText, { color: statusColor }]}>
            {challengeStatusLabel(challenge.status)}
          </Text>
        </View>
        <Text
          style={[theme.typography.section, { color: theme.colors.textPrimary }]}
          numberOfLines={2}>
          {challenge.title}
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
          {challenge.startDate} – {challenge.endDate}
        </Text>
        <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]} numberOfLines={2}>
          {challenge.goalLabel}
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
          {challenge.participantCount.toLocaleString()} participants
        </Text>
      </View>
    </Card>
  );
}

export function PlayerRow({
  player,
  onPress,
}: {
  player: ClubPlayer;
  onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Card onPress={onPress} style={styles.playerRow}>
      {player.imageUrl ? (
        <Image source={{ uri: player.imageUrl }} style={styles.playerAvatar} />
      ) : (
        <View
          style={[
            styles.playerAvatar,
            { backgroundColor: theme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
          ]}>
          <AppIcon name="user" size={20} color={theme.colors.primary} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[theme.typography.body, { color: theme.colors.textPrimary, fontWeight: '700' }]}>
          {player.name}
          {player.isCaptain ? ' · Captain' : ''}
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
          {[player.role, player.position, player.jerseyNumber != null ? `#${player.jerseyNumber}` : null]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
      <AppIcon name="chevron-right" size={18} color={theme.colors.textTertiary} />
    </Card>
  );
}

const styles = StyleSheet.create({
  clubCard: { overflow: 'hidden' },
  clubCover: { width: '100%', height: 110, backgroundColor: '#EEE' },
  clubBody: { padding: 12, gap: 8 },
  clubHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  clubLogo: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEE' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  challengeCompact: { width: 240 },
  challengeImage: { width: '100%', height: 140, backgroundColor: '#EEE' },
  challengeImageCompact: { width: '100%', height: 110, backgroundColor: '#EEE' },
  challengeBody: { padding: 12, gap: 6 },
  statusChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusChipText: { fontSize: 10, fontWeight: '800' },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  playerAvatar: { width: 44, height: 44, borderRadius: 22 },
});
