import React, { useMemo } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useShallow } from 'zustand/react/shallow';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { EmptyState } from '@/shared/components/EmptyState';
import { AppIcon } from '@/shared/components/AppIcon';
import { useTheme } from '@/shared/hooks/useTheme';
import {
  ChallengeCard,
  PlayerRow,
} from '@/features/community/components/ClubChallengeCards';
import {
  CURRENT_USER_ID,
  useCommunityStore,
} from '@/shared/data/community';
import { getEvent } from '@/shared/data/services';
import { RootStackParamList } from '@/shared/navigation/types';

export function ClubDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'TeamDetail'>>();
  const { teamId } = route.params;

  const team = useCommunityStore(s => s.getTeam(teamId));
  const players = useCommunityStore(useShallow(s => s.getPlayersForTeam(teamId)));
  const playerCount = useCommunityStore(s => s.getPlayerCountForTeam(teamId));
  const challenges = useCommunityStore(useShallow(s => s.getChallengesForTeam(teamId)));
  const isMember = useCommunityStore(s => s.isMember(teamId));
  const isAdmin = useCommunityStore(s => s.isTeamAdmin(teamId));
  const joinTeam = useCommunityStore(s => s.joinTeam);
  const joinRequests = useCommunityStore(s => s.joinRequests);

  const pendingRequest = useMemo(
    () =>
      joinRequests.find(
        r =>
          r.teamId === teamId &&
          r.userId === CURRENT_USER_ID &&
          r.status === 'pending',
      ),
    [joinRequests, teamId],
  );

  const pendingCount = useMemo(
    () =>
      joinRequests.filter(r => r.teamId === teamId && r.status === 'pending').length,
    [joinRequests, teamId],
  );

  const coach = players.find(p => p.id === team?.coachPlayerId);
  const captain = players.find(p => p.id === team?.captainPlayerId);
  const rosterPreview = players.slice(0, 4);
  const events = (team?.eventIds ?? [])
    .map(id => getEvent(id))
    .filter((e): e is NonNullable<typeof e> => !!e);

  if (!team) {
    return (
      <ScreenContainer tabAware={false}>
        <AppHeader title="Team" showBrand={false} showActions={false} />
        <EmptyState icon="users" title="Team not found" />
      </ScreenContainer>
    );
  }

  const onJoin = () => {
    const result = joinTeam(teamId);
    if (result === 'joined') {
      Alert.alert('Joined', `Welcome to ${team.name}.`);
    } else if (result === 'requested') {
      Alert.alert('Request sent', 'An admin will review your join request.');
    }
  };

  const joinLabel = isMember
    ? 'Joined'
    : pendingRequest
      ? 'Request pending'
      : team.joinPolicy === 'request'
        ? 'Request to join'
        : 'Join team';

  return (
    <ScreenContainer scrollable tabAware={false} contentStyle={{ gap: 14 }}>
      <AppHeader title={team.name} showBrand={false} showActions={false} />

      <View style={styles.heroWrap}>
        <Image source={{ uri: team.coverUrl }} style={styles.cover} />
        <Image source={{ uri: team.logoUrl }} style={styles.logo} />
      </View>

      <View style={{ gap: 4 }}>
        <Text style={[theme.typography.largeTitle, { color: theme.colors.textPrimary }]}>
          {team.name}
        </Text>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          {team.sport} · {team.location}
        </Text>
        <View style={styles.tagRow}>
          {team.sportTags.map(tag => (
            <View
              key={tag}
              style={[styles.tag, { backgroundColor: theme.colors.primarySoft, borderRadius: theme.radius.pill }]}>
              <Text style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '700' }]}>
                {tag}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.metaRow}>
          <AppIcon name="users" size={14} color={theme.colors.primary} />
          <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
            {playerCount} players · {team.memberCount} members
          </Text>
        </View>
      </View>

      <Button
        title={joinLabel}
        icon={isMember || pendingRequest ? 'check' : 'plus'}
        variant={isMember || pendingRequest ? 'secondary' : 'primary'}
        disabled={isMember || !!pendingRequest}
        onPress={onJoin}
      />

      {isAdmin ? (
        <View style={styles.adminRow}>
          <View style={{ flex: 1 }}>
            <Button
              title={
                pendingCount > 0 ? `Join requests (${pendingCount})` : 'Join requests'
              }
              variant="secondary"
              icon="users"
              onPress={() => navigation.navigate('TeamJoinRequests', { teamId })}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="Add player"
              icon="plus"
              variant="secondary"
              onPress={() => navigation.navigate('TeamPlayerForm', { teamId })}
            />
          </View>
        </View>
      ) : null}

      <Card style={{ gap: 8 }}>
        <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
          About
        </Text>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          {team.description}
        </Text>
        {coach || captain ? (
          <View style={{ gap: 6, marginTop: 4 }}>
            {coach ? (
              <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
                Coach · {coach.name}
              </Text>
            ) : null}
            {captain ? (
              <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
                Captain · {captain.name}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Card>

      <View style={{ gap: 10 }}>
        <SectionHeader
          title="Player roster"
          actionLabel="See all"
          onAction={() => navigation.navigate('TeamRoster', { teamId })}
        />
        {rosterPreview.length === 0 ? (
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
            No players yet.
          </Text>
        ) : (
          rosterPreview.map(player => (
            <PlayerRow
              key={player.id}
              player={player}
              onPress={
                isAdmin
                  ? () =>
                      navigation.navigate('TeamPlayerForm', {
                        teamId,
                        playerId: player.id,
                      })
                  : undefined
              }
            />
          ))
        )}
      </View>

      {challenges.length > 0 ? (
        <View style={{ gap: 10 }}>
          <SectionHeader title="Upcoming challenges" />
          {challenges.map(challenge => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              onPress={() =>
                navigation.navigate('ChallengeDetail', { challengeId: challenge.id })
              }
            />
          ))}
        </View>
      ) : null}

      {events.length > 0 ? (
        <View style={{ gap: 10 }}>
          <SectionHeader title="Team activity" />
          {events.map(event => (
            <Card
              key={event.id}
              onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
              style={styles.eventRow}>
              <Image source={{ uri: event.imageUrl }} style={styles.eventThumb} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={[theme.typography.body, { color: theme.colors.textPrimary, fontWeight: '700' }]}
                  numberOfLines={1}>
                  {event.title}
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  {event.dateLabel} · {event.destination}
                </Text>
              </View>
              <AppIcon name="chevron-right" size={18} color={theme.colors.textTertiary} />
            </Card>
          ))}
        </View>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heroWrap: { marginBottom: 28 },
  cover: { width: '100%', height: 160, borderRadius: 20, backgroundColor: '#EEE' },
  logo: {
    position: 'absolute',
    left: 16,
    bottom: -24,
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: '#fff',
    backgroundColor: '#EEE',
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tag: { paddingHorizontal: 10, paddingVertical: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  adminRow: { flexDirection: 'row', gap: 10 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  eventThumb: { width: 52, height: 52, borderRadius: 12, backgroundColor: '#EEE' },
});
