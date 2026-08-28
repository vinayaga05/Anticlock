import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { Card } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { AppIcon } from '@/shared/components/AppIcon';
import {
  challengeStatusLabel,
  type Challenge,
  type Team,
  type TeamPlayer,
} from '@/shared/data/community';
import { useCommunityStore } from '@/shared/data/community';

export function TeamCard({
  team,
  onPress,
}: {
  team: Team;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const playerCount = useCommunityStore(s => s.getPlayerCountForTeam(team.id));

  return (
    <Card onPress={onPress} padded={false} elevated style={styles.teamCard}>
      <Image source={{ uri: team.coverUrl }} style={styles.teamCover} />
      <View style={styles.teamBody}>
        <View style={styles.teamHeader}>
          <Image source={{ uri: team.logoUrl }} style={styles.teamLogo} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={[theme.typography.section, { color: theme.colors.textPrimary }]}
              numberOfLines={1}>
              {team.name}
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
              {team.sport} · {team.location}
            </Text>
          </View>
        </View>
        <Text
          style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}
          numberOfLines={2}>
          {team.description}
        </Text>
        <View style={styles.metaRow}>
          <AppIcon name="users" size={14} color={theme.colors.primary} />
          <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
            {playerCount} players
          </Text>
        </View>
      </View>
    </Card>
  );
}

export function DiscoverTeamCard({
  team,
  onView,
  onJoin,
  joinLabel,
  joinDisabled,
}: {
  team: Team;
  onView?: () => void;
  onJoin?: () => void;
  joinLabel?: string;
  joinDisabled?: boolean;
}) {
  const theme = useTheme();
  const playerCount = useCommunityStore(s => s.getPlayerCountForTeam(team.id));
  const label =
    joinLabel ??
    (team.joinPolicy === 'request' ? 'Request to Join' : 'Join');

  return (
    <Card elevated style={styles.discoverCard}>
      <View style={styles.discoverHeader}>
        <Image source={{ uri: team.logoUrl }} style={styles.discoverLogo} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={[theme.typography.section, { color: theme.colors.textPrimary }]}
            numberOfLines={1}>
            {team.name}
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            {team.sport} · {team.location}
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
            {playerCount} players
          </Text>
        </View>
      </View>
      <View style={styles.discoverActions}>
        <View style={{ flex: 1 }}>
          <Button title="View Team" variant="secondary" onPress={onView} />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title={label}
            onPress={onJoin}
            disabled={joinDisabled}
            variant={joinDisabled ? 'secondary' : 'primary'}
          />
        </View>
      </View>
    </Card>
  );
}

export function ChallengeCard({
  challenge,
  onPress,
  compact,
  eligibleTeam,
}: {
  challenge: Challenge;
  onPress?: () => void;
  compact?: boolean;
  eligibleTeam?: Team | null;
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
          {challenge.category} · {challenge.startDate} – {challenge.endDate}
        </Text>
        {challenge.location ? (
          <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
            {challenge.location}
          </Text>
        ) : null}
        {challenge.minTeamSize != null && challenge.maxTeamSize != null ? (
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            Team size: {challenge.minTeamSize}–{challenge.maxTeamSize}
          </Text>
        ) : null}
        <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]} numberOfLines={2}>
          {challenge.goalLabel}
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
          {challenge.requiresTeam
            ? `${challenge.teamCount} teams joined`
            : `${challenge.participantCount.toLocaleString()} participants`}
        </Text>
        {eligibleTeam ? (
          <View style={[styles.eligibleChip, { backgroundColor: theme.colors.primarySoft }]}>
            <Text style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '700' }]}>
              Your eligible team: {eligibleTeam.name}
            </Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

export function PlayerRow({
  player,
  onPress,
}: {
  player: TeamPlayer;
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
  teamCard: { overflow: 'hidden' },
  teamCover: { width: '100%', height: 110, backgroundColor: '#EEE' },
  teamBody: { padding: 12, gap: 8 },
  teamHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  teamLogo: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEE' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  discoverCard: { gap: 12 },
  discoverHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  discoverLogo: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#EEE' },
  discoverActions: { flexDirection: 'row', gap: 10 },
  challengeCompact: { width: 260 },
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
  eligibleChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    marginTop: 2,
  },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  playerAvatar: { width: 44, height: 44, borderRadius: 22 },
});
