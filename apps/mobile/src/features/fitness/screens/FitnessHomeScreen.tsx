import React from 'react';
import { View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { FitnessSummary } from '@anticlock/contracts';
import { useAuth } from '@/shared/context/AuthProvider';
import { useFitnessQuery } from '../api/fitnessApi';
import {
  dayMetric,
  FITNESS_REVIEW_GUIDANCE,
  fitnessTimezone,
  localFitnessDate,
  numberLabel,
} from '../fitnessModel';
import {
  FitnessAction,
  FitnessCard,
  FitnessEmpty,
  FitnessLoading,
  FitnessNotice,
  FitnessScreen,
  FitnessSection,
  FitnessText,
} from '../components/FitnessUI';
import { FitnessChart } from '../components/FitnessChart';
import { FitnessExpertHome } from '../experts/components/FitnessExpertHome';
import {
  FitnessDailyNutrition,
  FitnessTargetLine,
  FitnessWeeklyConsistency,
  FitnessWeightJourney,
  FitnessWorkoutCompletion,
  fitnessRangeLabel,
} from '../components/FitnessTargetCards';

export function FitnessHomeScreen() {
  const nav = useNavigation<any>();
  const { user } = useAuth();
  const query = useFitnessQuery<FitnessSummary>(
    `/summary?date=${localFitnessDate()}&timezone=${encodeURIComponent(
      fitnessTimezone(),
    )}`,
  );
  useFocusEffect(
    React.useCallback(() => {
      if (user && user.id !== 'temporary-guest') void query.refetch();
    }, [user?.id]),
  );
  const data = query.data;
  const today = data?.today;
  const plan = data?.plan;
  const reviewRequired = Boolean(
    data?.profile?.baseline?.requiresProfessionalReview ||
      plan?.content.requiresProfessionalReview ||
      plan?.status === 'needs_review' ||
      data?.targetStatus === 'needs_review',
  );
  const targetStatus =
    data?.targetStatus ??
    (reviewRequired ? 'needs_review' : plan ? 'unavailable' : 'no_plan');
  const safeTargets = reviewRequired ? null : data?.targets;
  const calories = today ? dayMetric(today, 'calories') : null;
  const water = today ? dayMetric(today, 'waterMl') : null;
  const workoutMinutes = today ? dayMetric(today, 'workoutMinutes') : null;
  const todayWorkout = reviewRequired
    ? undefined
    : plan?.content.workouts.find(
        workout => workout.day === new Date().getDay(),
      );
  const route = (name: string, params?: any) => nav.navigate(name, params);
  if (!user || user.id === 'temporary-guest')
    return (
      <FitnessScreen title="A little better, daily.">
        <FitnessEmpty
          title="Your space to feel well"
          message="Sign in to save your private assessment, plan and daily progress."
          action="Sign in"
          onPress={() => route('Login')}
        />
      </FitnessScreen>
    );
  return (
    <FitnessScreen
      title="A little better, daily."
      subtitle={new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })}
    >
      {query.isPending ? (
        <FitnessLoading />
      ) : query.isError ? (
        <FitnessEmpty
          title="Your space is taking a moment"
          message={query.error.message}
          action="Try again"
          onPress={() => {
            void query.refetch();
          }}
        />
      ) : !data?.profile || data.profile.status === 'draft' ? (
        <FitnessEmpty
          title={
            data?.profile
              ? 'Pick up where you left off'
              : 'Start with your story'
          }
          message="A few thoughtful questions help create a plan around your goals, your routine and your preferences."
          action={
            data?.profile ? 'Continue assessment' : 'Build my starting point'
          }
          onPress={() => route('FitnessAssessment')}
        />
      ) : (
        <>
          <FitnessCard tone="soft">
            <FitnessSection
              title={
                plan
                  ? 'Small steps. Lasting rhythm.'
                  : 'Your starting point is saved.'
              }
              caption={
                plan
                  ? plan.title
                  : 'Your assessment is ready. Create a saved starter plan to get going.'
              }
            />
            {plan ? (
              <>
                <FitnessText muted>{plan.content.description}</FitnessText>
                <FitnessAction
                  label="Explore my plan"
                  icon="arrow-right"
                  onPress={() => route('FitnessPlan')}
                />
              </>
            ) : (
              <FitnessAction
                label="Create my plan"
                onPress={() => route('FitnessPlan')}
              />
            )}
          </FitnessCard>
          {(data.profile.baseline?.requiresProfessionalReview ||
            plan?.content.requiresProfessionalReview) && (
            <FitnessNotice message={FITNESS_REVIEW_GUIDANCE} />
          )}
          <FitnessSection
            title="Today, at a glance"
            caption="Saved entries only. A fresh start is always welcome."
          />
          <FitnessCard>
            <FitnessSection
              title={todayWorkout?.name ?? 'Your movement journal'}
              caption={
                todayWorkout
                  ? `${todayWorkout.durationMinutes} minutes · from your saved plan`
                  : reviewRequired
                  ? 'Saved exercise guidance awaits professional review.'
                  : !plan
                  ? 'A saved plan adds scheduled sessions here.'
                  : 'No workout is scheduled in your saved plan for this date.'
              }
            />
            <FitnessText large>
              {numberLabel(workoutMinutes)}{' '}
              <FitnessText muted>minutes recorded complete</FitnessText>
            </FitnessText>
            <FitnessWorkoutCompletion
              workout={data.todayWorkout}
              noPlan={!plan}
              reviewRequired={reviewRequired}
            />
            <FitnessAction
              label={
                todayWorkout ? 'Open scheduled workout' : 'Log my own activity'
              }
              icon="dumbbell"
              onPress={() =>
                route(
                  'FitnessWorkout',
                  todayWorkout
                    ? {
                        planId: plan?.id,
                        day: todayWorkout.day,
                        date: data.date,
                      }
                    : { date: data.date },
                )
              }
            />
          </FitnessCard>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <FitnessCard>
                <FitnessText muted>NOURISH</FitnessText>
                <FitnessText large>{numberLabel(calories)}</FitnessText>
                <FitnessText muted>
                  {calories === null ? 'No meal entry yet' : 'kcal logged'}
                </FitnessText>
                <FitnessAction
                  label="Add meal"
                  secondary
                  onPress={() => route('FitnessMeals')}
                />
              </FitnessCard>
            </View>
            <View style={{ flex: 1 }}>
              <FitnessCard>
                <FitnessText muted>HYDRATE</FitnessText>
                <FitnessText large>
                  {numberLabel(water === null ? null : water / 1000)}
                </FitnessText>
                <FitnessText muted>
                  {water === null ? 'No water entry yet' : 'litres logged'}
                </FitnessText>
                {safeTargets?.waterMl && (
                  <FitnessText muted>
                    Daily reference{' '}
                    {fitnessRangeLabel(safeTargets.waterMl, ' ml')}
                  </FitnessText>
                )}
                <FitnessAction
                  label="Add water"
                  secondary
                  onPress={() => route('FitnessLog', { kind: 'water' })}
                />
              </FitnessCard>
            </View>
          </View>
          <FitnessDailyNutrition
            day={data.today}
            targets={safeTargets}
            status={targetStatus}
          />
          <FitnessCard>
            <FitnessSection title="The everyday essentials" />
            <FitnessTargetLine
              label="Steps"
              actual={dayMetric(data.today, 'steps')}
              range={safeTargets?.steps}
              unavailable={
                reviewRequired
                  ? 'Target withheld for review'
                  : 'No daily step target saved'
              }
            />
            <FitnessAction
              label="Log steps"
              icon="footprints"
              secondary
              onPress={() => route('FitnessLog', { kind: 'steps' })}
            />
            <FitnessTargetLine
              label="Sleep"
              actual={dayMetric(data.today, 'sleepMinutes')}
              range={safeTargets?.sleepMinutes}
              unit=" min"
              unavailable={
                reviewRequired
                  ? 'Target withheld for review'
                  : 'No daily sleep target saved'
              }
            />
            <FitnessAction
              label="Log sleep"
              icon="moon"
              secondary
              onPress={() => route('FitnessLog', { kind: 'sleep' })}
            />
            <FitnessText>
              Habits ·{' '}
              {dayMetric(data.today, 'habitsCompleted') === null
                ? 'No check in recorded'
                : `${data.today.habitsCompleted} recorded complete`}
            </FitnessText>
            {safeTargets?.habits.map(habit => (
              <FitnessText muted key={habit.key}>
                {habit.label} · {habit.target} {habit.unit}
              </FitnessText>
            ))}
            <FitnessAction
              label="Check in on a habit"
              icon="check"
              secondary
              onPress={() => route('FitnessLog', { kind: 'habit' })}
            />
          </FitnessCard>
          <FitnessCard>
            <FitnessSection
              title="Your weekly rhythm"
              caption={`${data.weekly.activeDays} active days · ${data.weekly.streak} day streak · ${data.weekly.workouts} workouts`}
            />
            <FitnessWeeklyConsistency
              weekly={data.weekly}
              status={targetStatus}
            />
            <FitnessChart
              bars
              title="Weekly activity minutes"
              values={data.weekly.days.map(day =>
                dayMetric(day, 'workoutMinutes'),
              )}
              labels={data.weekly.days.map(day => day.date.slice(5))}
              unit=" min"
            />
            <FitnessAction
              label="See my progress"
              secondary
              onPress={() => route('FitnessProgress')}
            />
          </FitnessCard>
          <FitnessWeightJourney
            snapshot={data.latestWeight}
            progress={data.weightProgress}
            reviewRequired={reviewRequired}
          />
          <FitnessAction
            label="Log weight"
            icon="scale"
            secondary
            onPress={() => route('FitnessLog', { kind: 'weight' })}
          />
          <FitnessExpertHome />
          <FitnessAction
            label="My log history"
            secondary
            icon="clipboard-list"
            onPress={() => route('FitnessHistory')}
          />
          <FitnessAction
            label="Privacy, sharing & reminders"
            secondary
            icon="lock"
            onPress={() => route('FitnessPrivacy')}
          />
        </>
      )}
    </FitnessScreen>
  );
}
