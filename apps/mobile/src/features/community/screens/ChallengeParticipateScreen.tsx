import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useShallow } from 'zustand/react/shallow';
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

type EventStep = 'none' | 'pick' | 'create';

export function ChallengeParticipateScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'ChallengeParticipate'>>();
  const { challengeId } = route.params;

  const challenge = useCommunityStore(s => s.getChallenge(challengeId));
  const existing = useCommunityStore(s => s.getParticipation(challengeId));
  const myTeams = useCommunityStore(useShallow(s => s.getMyTeams()));
  const getTeamEligibility = useCommunityStore(s => s.getTeamEligibility);
  const getPlayerCountForTeam = useCommunityStore(s => s.getPlayerCountForTeam);
  const joinChallenge = useCommunityStore(s => s.joinChallenge);

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventStep, setEventStep] = useState<EventStep>('none');

  const linkedEvents = useMemo(() => {
    if (!challenge) return [];
    return challenge.linkedEventIds.map(id => {
      const event = getEvent(id);
      return event ? { id, title: event.title } : { id, title: id };
    });
  }, [challenge]);

  const showEventFlow = linkedEvents.length > 0 || challenge?.linkedEventIds.length === 0;

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

  const onConfirm = () => {
    if (challenge.requiresTeam && !selectedTeamId) {
      Alert.alert('Choose a team', 'Select an eligible team to participate.');
      return;
    }
    if (eventStep === 'pick' && !selectedEventId) {
      Alert.alert('Pick an event', 'Select an event or create a new one.');
      return;
    }

    joinChallenge(challengeId, {
      teamId: selectedTeamId ?? undefined,
      eventId: eventStep === 'pick' ? selectedEventId ?? undefined : undefined,
    });

    Alert.alert('Confirmed', `Your team is registered for ${challenge.title}.`, [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <ScreenContainer scrollable tabAware={false} contentStyle={{ gap: 14 }}>
      <AppHeader title="Participate" showBrand={false} showActions={false} />

      {challenge.requiresTeam ? (
        <>
          <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
            Choose team
          </Text>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
            Only eligible teams you belong to are shown.
          </Text>

          {myTeams.length === 0 ? (
            <EmptyState
              icon="users"
              title="No teams yet"
              description="Create or join a team before participating in this challenge."
            />
          ) : (
            myTeams.map(team => {
              const eligibility = getTeamEligibility(team.id, challengeId);
              const active = selectedTeamId === team.id;
              const count = getPlayerCountForTeam(team.id);

              return (
                <PressableScale
                  key={team.id}
                  onPress={() => eligibility.eligible && setSelectedTeamId(team.id)}
                  disabled={!eligibility.eligible}
                  style={[
                    styles.teamOption,
                    {
                      backgroundColor: active
                        ? theme.colors.primarySoft
                        : theme.colors.surface,
                      borderColor: active ? theme.colors.primary : theme.colors.border,
                      borderRadius: theme.radius.md,
                      opacity: eligibility.eligible ? 1 : 0.72,
                    },
                  ]}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text
                      style={[
                        theme.typography.body,
                        {
                          color: active ? theme.colors.primary : theme.colors.textPrimary,
                          fontWeight: '700',
                        },
                      ]}>
                      {team.name}
                    </Text>
                    <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                      {team.sport} · {count} players
                    </Text>
                    <Text
                      style={[
                        theme.typography.caption,
                        {
                          color: eligibility.eligible
                            ? theme.colors.primary
                            : theme.colors.warning,
                          fontWeight: '600',
                        },
                      ]}>
                      {eligibility.eligible ? 'Eligible' : eligibility.reason}
                    </Text>
                  </View>
                  {active ? (
                    <AppIcon name="check" size={20} color={theme.colors.primary} />
                  ) : null}
                </PressableScale>
              );
            })
          )}
        </>
      ) : (
        <Card style={{ gap: 6 }}>
          <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
            Individual participation
          </Text>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
            This challenge does not require a team. You can optionally link an event below.
          </Text>
        </Card>
      )}

      {showEventFlow ? (
        <View style={{ gap: 10 }}>
          <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
            Link an event (optional)
          </Text>

          <OptionCard
            active={eventStep === 'none'}
            title="No event"
            subtitle="Participate without linking an event"
            icon="user"
            onPress={() => {
              setEventStep('none');
              setSelectedEventId(null);
            }}
          />

          {linkedEvents.length > 0 ? (
            <>
              <OptionCard
                active={eventStep === 'pick'}
                title="Select existing event"
                subtitle="Choose from linked events"
                icon="calendar"
                onPress={() => setEventStep('pick')}
              />
              {eventStep === 'pick'
                ? linkedEvents.map(event => {
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
                : null}
            </>
          ) : null}

          <Button
            title="Create new event"
            variant="secondary"
            icon="plus"
            onPress={() => navigation.navigate('CreateExploreEvent', { challengeId })}
          />
        </View>
      ) : null}

      <Button
        title="Confirm participation"
        icon="zap"
        onPress={onConfirm}
        disabled={challenge.requiresTeam && !selectedTeamId}
      />
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
  teamOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
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
