import React, { useMemo } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
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
  const route = useRoute<RouteProp<RootStackParamList, 'ClubDetail'>>();
  const { clubId } = route.params;

  const club = useCommunityStore(s => s.getClub(clubId));
  const players = useCommunityStore(s => s.getPlayersForClub(clubId));
  const challenges = useCommunityStore(s => s.getChallengesForClub(clubId));
  const isMember = useCommunityStore(s => s.isMember(clubId));
  const isAdmin = useCommunityStore(s => s.isClubAdmin(clubId));
  const joinClub = useCommunityStore(s => s.joinClub);
  const joinRequests = useCommunityStore(s => s.joinRequests);

  const pendingRequest = useMemo(
    () =>
      joinRequests.find(
        r =>
          r.clubId === clubId &&
          r.userId === CURRENT_USER_ID &&
          r.status === 'pending',
      ),
    [joinRequests, clubId],
  );

  const pendingCount = useMemo(
    () =>
      joinRequests.filter(r => r.clubId === clubId && r.status === 'pending').length,
    [joinRequests, clubId],
  );

  const coach = players.find(p => p.id === club?.coachPlayerId);
  const captain = players.find(p => p.id === club?.captainPlayerId);
  const rosterPreview = players.slice(0, 3);
  const events = (club?.eventIds ?? [])
    .map(id => getEvent(id))
    .filter((e): e is NonNullable<typeof e> => !!e);

  if (!club) {
    return (
      <ScreenContainer tabAware={false}>
        <AppHeader title="Team" showBrand={false} showActions={false} />
        <EmptyState icon="users" title="Team not found" />
      </ScreenContainer>
    );
  }

  const onJoin = () => {
    const result = joinClub(clubId);
    if (result === 'joined') {
      Alert.alert('Joined', `Welcome to ${club.name}.`);
    } else if (result === 'requested') {
      Alert.alert('Request sent', 'An admin will review your join request.');
    }
  };

  const joinLabel = isMember
    ? 'Joined'
    : pendingRequest
      ? 'Request pending'
      : club.joinPolicy === 'request'
        ? 'Request to join'
        : 'Join team';

  return (
    <ScreenContainer scrollable tabAware={false} contentStyle={{ gap: 14 }}>
      <AppHeader title={club.name} showBrand={false} showActions={false} />

      <View style={styles.heroWrap}>
        <Image source={{ uri: club.coverUrl }} style={styles.cover} />
        <Image source={{ uri: club.logoUrl }} style={styles.logo} />
      </View>

      <View style={{ gap: 4 }}>
        <Text style={[theme.typography.largeTitle, { color: theme.colors.textPrimary }]}>
          {club.name}
        </Text>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          {club.sport} · {club.location}
        </Text>
        <View style={styles.metaRow}>
          <AppIcon name="users" size={14} color={theme.colors.primary} />
          <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
            {club.memberCount} members
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
              onPress={() => navigation.navigate('ClubJoinRequests', { clubId })}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="Add player"
              icon="plus"
              variant="secondary"
              onPress={() => navigation.navigate('ClubPlayerForm', { clubId })}
            />
          </View>
        </View>
      ) : null}

      <Card style={{ gap: 8 }}>
        <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
          About
        </Text>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          {club.description}
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
          title="Roster"
          actionLabel="See all"
          onAction={() => navigation.navigate('ClubRoster', { clubId })}
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
                      navigation.navigate('ClubPlayerForm', {
                        clubId,
                        playerId: player.id,
                      })
                  : undefined
              }
            />
          ))
        )}
      </View>

      {events.length > 0 ? (
        <View style={{ gap: 10 }}>
          <SectionHeader title="Events" />
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

      {challenges.length > 0 ? (
        <View style={{ gap: 10 }}>
          <SectionHeader title="Challenges" />
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
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  adminRow: { flexDirection: 'row', gap: 10 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  eventThumb: { width: 52, height: 52, borderRadius: 12, backgroundColor: '#EEE' },
});
