import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
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
  challengeStatusLabel,
  useCommunityStore,
} from '@/shared/data/community';
import { getEvent } from '@/shared/data/services';
import { RootStackParamList } from '@/shared/navigation/types';

export function ChallengeDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'ChallengeDetail'>>();
  const { challengeId } = route.params;

  const challenge = useCommunityStore(s => s.getChallenge(challengeId));
  const participation = useCommunityStore(s => s.getParticipation(challengeId));

  if (!challenge) {
    return (
      <ScreenContainer tabAware={false}>
        <AppHeader title="Challenge" showBrand={false} showActions={false} />
        <EmptyState icon="zap" title="Challenge not found" />
      </ScreenContainer>
    );
  }

  const statusColor =
    challenge.status === 'active'
      ? theme.colors.primary
      : challenge.status === 'upcoming'
        ? theme.colors.warning
        : theme.colors.textTertiary;

  const linkedEvents = challenge.linkedEventIds
    .map(id => getEvent(id))
    .filter((e): e is NonNullable<typeof e> => !!e);

  return (
    <ScreenContainer scrollable tabAware={false} contentStyle={{ gap: 14 }}>
      <AppHeader title="Challenge" showBrand={false} showActions={false} />

      <Image source={{ uri: challenge.coverUrl }} style={styles.cover} />

      <View style={[styles.statusChip, { backgroundColor: `${statusColor}22` }]}>
        <Text style={[styles.statusChipText, { color: statusColor }]}>
          {challengeStatusLabel(challenge.status)}
        </Text>
      </View>

      <View style={{ gap: 4 }}>
        <Text style={[theme.typography.largeTitle, { color: theme.colors.textPrimary }]}>
          {challenge.title}
        </Text>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          Organized by {challenge.organizerName}
        </Text>
      </View>

      <Card style={{ gap: 8 }}>
        <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
          Goal
        </Text>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          {challenge.goalLabel}
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
          {challenge.startDate} – {challenge.endDate}
        </Text>
        <View style={styles.metaRow}>
          <AppIcon name="users" size={14} color={theme.colors.primary} />
          <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
            {challenge.participantCount.toLocaleString()} participants
          </Text>
        </View>
      </Card>

      <Card style={{ gap: 8 }}>
        <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
          About
        </Text>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          {challenge.description}
        </Text>
        <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
          {challenge.rules}
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
          Eligibility · {challenge.eligibility}
        </Text>
      </Card>

      {challenge.rewards.length > 0 ? (
        <Card style={{ gap: 6 }}>
          <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
            Rewards
          </Text>
          {challenge.rewards.map(reward => (
            <Text
              key={reward}
              style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
              · {reward}
            </Text>
          ))}
        </Card>
      ) : null}

      {linkedEvents.length > 0 ? (
        <View style={{ gap: 10 }}>
          <SectionHeader title="Linked events" />
          {linkedEvents.map(event => (
            <Card
              key={event.id}
              onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
              style={styles.eventRow}>
              <Image source={{ uri: event.imageUrl }} style={styles.eventThumb} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={[
                    theme.typography.body,
                    { color: theme.colors.textPrimary, fontWeight: '700' },
                  ]}
                  numberOfLines={1}>
                  {event.title}
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  {event.dateLabel}
                </Text>
              </View>
              <AppIcon name="chevron-right" size={18} color={theme.colors.textTertiary} />
            </Card>
          ))}
        </View>
      ) : null}

      {participation ? (
        <Card style={{ gap: 6 }}>
          <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
            Your participation
          </Text>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
            Status · {participation.status}
          </Text>
          {participation.progressLabel ? (
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
              Progress · {participation.progressLabel} ({participation.progress}%)
            </Text>
          ) : (
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
              Progress · {participation.progress}%
            </Text>
          )}
          {participation.eventId ? (
            <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
              Linked event · {getEvent(participation.eventId)?.title ?? participation.eventId}
            </Text>
          ) : null}
          <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
            Joined {participation.joinedAt}
          </Text>
        </Card>
      ) : challenge.status !== 'cancelled' && challenge.status !== 'completed' ? (
        <Button
          title="Participate"
          icon="zap"
          onPress={() =>
            navigation.navigate('ChallengeParticipate', { challengeId })
          }
        />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  cover: { width: '100%', height: 180, borderRadius: 20, backgroundColor: '#EEE' },
  statusChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusChipText: { fontSize: 11, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  eventThumb: { width: 52, height: 52, borderRadius: 12, backgroundColor: '#EEE' },
});
