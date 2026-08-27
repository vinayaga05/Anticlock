import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';
import { useCommunityStore } from '@/shared/data/community';
import { getEvent } from '@/shared/data/services';
import { RootStackParamList } from '@/shared/navigation/types';

type JoinMode = 'individual' | 'event';

export function ChallengeParticipateScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'ChallengeParticipate'>>();
  const { challengeId } = route.params;

  const challenge = useCommunityStore(s => s.getChallenge(challengeId));
  const existing = useCommunityStore(s => s.getParticipation(challengeId));
  const joinChallenge = useCommunityStore(s => s.joinChallenge);

  const [mode, setMode] = useState<JoinMode>('individual');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const linkedEvents = useMemo(() => {
    if (!challenge) return [];
    return challenge.linkedEventIds
      .map(id => {
        const event = getEvent(id);
        return event ? { id, title: event.title } : { id, title: id };
      });
  }, [challenge]);

  if (!challenge) {
    return (
      <ScreenContainer tabAware={false}>
        <AppHeader title="Participate" showBrand={false} showActions={false} />
        <EmptyState icon="zap" title="Challenge not found" />
      </ScreenContainer>
    );
  }

  if (existing) {
    return (
      <ScreenContainer tabAware={false}>
        <AppHeader title="Participate" showBrand={false} showActions={false} />
        <EmptyState
          icon="check"
          title="Already joined"
          description="You are already participating in this challenge."
        />
        <Button title="Back to challenge" onPress={() => navigation.goBack()} />
      </ScreenContainer>
    );
  }

  const onJoin = () => {
    if (mode === 'event' && !selectedEventId) {
      Alert.alert('Pick an event', 'Select an event or create a new one.');
      return;
    }
    joinChallenge(challengeId, mode === 'event' ? { eventId: selectedEventId! } : undefined);
    Alert.alert('Joined', `You are in ${challenge.title}.`, [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <ScreenContainer scrollable tabAware={false} contentStyle={{ gap: 14 }}>
      <AppHeader title="Join challenge" showBrand={false} showActions={false} />
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
        How do you want to join {challenge.title}?
      </Text>

      <OptionCard
        active={mode === 'individual'}
        title="Join individually"
        subtitle="Track progress on your own"
        icon="user"
        onPress={() => {
          setMode('individual');
          setSelectedEventId(null);
        }}
      />

      <OptionCard
        active={mode === 'event'}
        title="Join with event"
        subtitle="Link participation to an event"
        icon="calendar"
        onPress={() => setMode('event')}
      />

      {mode === 'event' ? (
        <View style={{ gap: 10 }}>
          <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
            Linked events
          </Text>
          {linkedEvents.length === 0 ? (
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
              No linked events yet. Create one to join with.
            </Text>
          ) : (
            linkedEvents.map(event => {
              const active = selectedEventId === event.id;
              return (
                <PressableScale
                  key={event.id}
                  onPress={() => setSelectedEventId(event.id)}
                  style={[
                    styles.eventOption,
                    {
                      backgroundColor: active
                        ? theme.colors.primarySoft
                        : theme.colors.surface,
                      borderColor: active ? theme.colors.primary : theme.colors.border,
                      borderRadius: theme.radius.md,
                    },
                  ]}>
                  <AppIcon
                    name="calendar"
                    size={18}
                    color={active ? theme.colors.primary : theme.colors.textTertiary}
                  />
                  <Text
                    style={[
                      theme.typography.body,
                      {
                        color: active ? theme.colors.primary : theme.colors.textPrimary,
                        flex: 1,
                        fontWeight: '600',
                      },
                    ]}>
                    {event.title}
                  </Text>
                  {active ? (
                    <AppIcon name="check" size={18} color={theme.colors.primary} />
                  ) : null}
                </PressableScale>
              );
            })
          )}

          <Button
            title="Create new event"
            variant="secondary"
            icon="plus"
            onPress={() =>
              navigation.navigate('CreateExploreEvent', { challengeId })
            }
          />
        </View>
      ) : null}

      <Button title="Join challenge" icon="zap" onPress={onJoin} />
    </ScreenContainer>
  );
}

function OptionCard({
  active,
  title,
  subtitle,
  icon,
  onPress,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  icon: 'user' | 'calendar';
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Card
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderColor: active ? theme.colors.primary : theme.colors.borderSoft,
        backgroundColor: active ? theme.colors.primarySoft : theme.colors.surface,
      }}>
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: active ? theme.colors.surface : theme.colors.primarySoft,
            borderRadius: theme.radius.md,
          },
        ]}>
        <AppIcon name={icon} size={22} color={theme.colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
          {title}
        </Text>
        <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
          {subtitle}
        </Text>
      </View>
      {active ? <AppIcon name="check" size={18} color={theme.colors.primary} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
