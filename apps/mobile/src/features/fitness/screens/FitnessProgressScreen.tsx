import React, { useState } from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { FitnessPlan, FitnessProgress } from '@anticlock/contracts';
import { useFitnessQuery } from '../api/fitnessApi';
import {
  dayMetric,
  fitnessDateValid,
  fitnessRange,
  fitnessTimezone,
  localFitnessDate,
  numberLabel,
} from '../fitnessModel';
import { FitnessChart } from '../components/FitnessChart';
import {
  FitnessDatePicker,
  FitnessDisclosure,
} from '../components/FitnessControls';
import { FitnessRing } from '../components/FitnessVisuals';
import { FitnessPrivateMedia } from '../components/FitnessPrivateMedia';
import {
  FitnessAdherence,
  FitnessDailyComparison,
  FitnessWeightJourney,
  fitnessRangeLabel,
} from '../components/FitnessTargetCards';
import {
  FitnessAction,
  FitnessCard,
  FitnessChoices,
  FitnessEmpty,
  FitnessLoading,
  FitnessNotice,
  FitnessScreen,
  FitnessSection,
  FitnessText,
} from '../components/FitnessUI';

const metrics = {
  weightKg: 'Weight (kg)',
  workouts: 'Workouts',
  workoutMinutes: 'Workout minutes',
  calories: 'Calories logged',
  proteinG: 'Protein (g)',
  carbsG: 'Carbs (g)',
  fatG: 'Fat (g)',
  fibreG: 'Fibre (g)',
  waterMl: 'Water (ml)',
  sleepMinutes: 'Sleep (minutes)',
  steps: 'Steps',
  habitsCompleted: 'Habits completed',
};
export function FitnessProgressScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const initial =
    route.params?.from && route.params?.to
      ? { from: route.params.from, to: route.params.to }
      : fitnessRange('week');
  const [period, setPeriod] = useState(route.params?.from ? 'Custom' : 'Week');
  const [range, setRange] = useState(initial);
  const [metric, setMetric] = useState('weightKg');
  const [showComparisons, setShowComparisons] = useState(false);
  const [comparisonLimit, setComparisonLimit] = useState(14);
  const valid =
    fitnessDateValid(range.from) &&
    fitnessDateValid(range.to) &&
    range.from <= range.to;
  const query = useFitnessQuery<FitnessProgress>(
    `/progress?from=${range.from}&to=${range.to}&timezone=${encodeURIComponent(
      fitnessTimezone(),
    )}`,
    valid,
  );
  const data = query.data;
  const comparableDays =
    data?.targetStatus === 'needs_review'
      ? []
      : data?.comparisons?.filter(
          day =>
            day.nutrition ||
            day.water ||
            day.steps ||
            day.sleep ||
            (day.workout?.planned ?? 0) > 0,
        ) ?? [];
  const plans = useFitnessQuery<{ plans: FitnessPlan[] }>('/plans');
  const media = useFitnessQuery<{
    media: Array<{
      id: string;
      purpose: string;
      comparisonOptIn?: boolean;
      createdAt: string;
    }>;
  }>('/media');
  const photos =
    media.data?.media
      .filter(
        item =>
          item.purpose === 'progress' &&
          item.comparisonOptIn &&
          localFitnessDate(new Date(item.createdAt)) >= range.from &&
          localFitnessDate(new Date(item.createdAt)) <= range.to,
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)) ?? [];
  return (
    <FitnessScreen
      title="Your progress"
      subtitle="Small steps, seen over time."
    >
      <FitnessChoices
        label="Period"
        options={['Week', 'Month', 'Custom']}
        selected={period}
        onChange={v => {
          setPeriod(v);
          if (v !== 'Custom')
            setRange(fitnessRange(v === 'Week' ? 'week' : 'month'));
        }}
      />
      {period === 'Custom' && (
        <>
          <FitnessDatePicker
            label="From date"
            value={range.from}
            onChange={from => setRange(r => ({ ...r, from }))}
            maximumDate={range.to}
          />
          <FitnessDatePicker
            label="To date"
            value={range.to}
            onChange={to => setRange(r => ({ ...r, to }))}
            minimumDate={range.from}
            maximumDate={new Date()}
          />
        </>
      )}
      {!valid ? (
        <FitnessNotice error message="Choose a valid start and end date." />
      ) : query.isPending ? (
        <FitnessLoading />
      ) : query.isError ? (
        <FitnessEmpty
          title="Progress could not be loaded"
          message={query.error.message}
          action="Retry"
          onPress={() => {
            void query.refetch();
          }}
        />
      ) : (
        data && (
          <>
            <FitnessCard tone="soft">
              <View
                style={{
                  flexDirection: 'row',
                  gap: 18,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <FitnessRing
                  value={
                    data.targetStatus === 'needs_review'
                      ? undefined
                      : data.adherence?.completionPercent ?? undefined
                  }
                  size={112}
                  label="Scheduled workout completion"
                >
                  <FitnessText large>
                    {data.targetStatus === 'needs_review' ||
                    data.adherence?.completionPercent == null
                      ? '—'
                      : numberLabel(data.adherence.completionPercent, '%')}
                  </FitnessText>
                </FitnessRing>
                <View style={{ flex: 1, minWidth: 130, gap: 6 }}>
                  <FitnessSection title="Your consistency" />
                  <FitnessText muted>
                    {data.targetStatus === 'needs_review'
                      ? 'Plan comparisons await review.'
                      : data.adherence
                      ? `${data.adherence.completedPlannedWorkouts} of ${data.adherence.plannedWorkouts} due scheduled workouts complete`
                      : 'Save a plan to compare your schedule.'}
                  </FitnessText>
                  <FitnessText>
                    {data.totals.activeDays} active days
                  </FitnessText>
                  <FitnessText muted>
                    {data.currentStreak === undefined
                      ? 'Period streak'
                      : 'Current streak'}{' '}
                    · {data.currentStreak ?? data.streak} days
                  </FitnessText>
                </View>
              </View>
            </FitnessCard>
            <FitnessCard>
              <FitnessSection
                title="Weight over time"
                caption={
                  data.weightChangeKg === null
                    ? 'Add a saved weight to begin.'
                    : `${numberLabel(
                        data.weightChangeKg,
                        ' kg',
                      )} in this period`
                }
              />
              <FitnessChart
                title="Weight (kg)"
                values={data.days.map(day => dayMetric(day, 'weightKg'))}
                labels={data.days.map(day => day.date.slice(5))}
                unit=" kg"
              />
            </FitnessCard>
            <FitnessAdherence
              adherence={data.adherence}
              notice={data.targetBasisNotice}
              status={data.targetStatus}
            />
            <FitnessWeightJourney
              current
              compact
              snapshot={data.latestWeight}
              progress={data.currentWeightProgress}
              reviewRequired={data.targetStatus === 'needs_review'}
            />
            <FitnessCard tone="soft">
              <FitnessSection title="Your next step" />
              <FitnessText muted>
                {data.targetStatus === 'needs_review'
                  ? 'Review your plan with a qualified professional before using its targets.'
                  : data.totals.activeDays
                  ? 'Keep building your record. Every saved activity helps you see your rhythm.'
                  : 'Start with one activity. Your record grows from what you save.'}
              </FitnessText>
              <FitnessAction
                label={
                  data.targetStatus === 'needs_review'
                    ? 'Find an expert'
                    : 'Log an activity'
                }
                onPress={() =>
                  nav.navigate(
                    data.targetStatus === 'needs_review'
                      ? 'FitnessExperts'
                      : 'FitnessWorkout',
                  )
                }
              />
            </FitnessCard>
            <FitnessDisclosure
              title="Explore the details"
              subtitle="Measures, targets, strength and private photos"
            >
              <FitnessChoices
                label="Explore a measure"
                options={Object.values(metrics)}
                selected={metrics[metric as keyof typeof metrics]}
                onChange={label =>
                  setMetric(
                    Object.keys(metrics).find(
                      key => metrics[key as keyof typeof metrics] === label,
                    ) ?? 'weightKg',
                  )
                }
              />
              <FitnessCard>
                <FitnessSection
                  title={metrics[metric as keyof typeof metrics]}
                  caption={`${data.from} — ${data.to}`}
                />
                <FitnessChart
                  title={metrics[metric as keyof typeof metrics]}
                  values={data.days.map(day => dayMetric(day, metric))}
                  labels={data.days.map(day => day.date.slice(5))}
                  bars={metric !== 'weightKg'}
                />
              </FitnessCard>
              <FitnessCard>
                <FitnessSection
                  title="Current daily reference ranges"
                  caption="These are your current saved targets, separate from any historical recommendations."
                />
                {data.targetStatus === 'needs_review' ? (
                  <FitnessNotice message="Numeric reference ranges are withheld for appropriate professional review." />
                ) : !data.currentTargets ? (
                  <FitnessText muted>
                    {data.targetStatus === 'no_plan'
                      ? 'No active saved plan is available.'
                      : 'Current targets are not available.'}
                  </FitnessText>
                ) : (
                  <>
                    {(
                      [
                        'calories',
                        'proteinG',
                        'carbsG',
                        'fatG',
                        'fibreG',
                        'waterMl',
                        'steps',
                        'sleepMinutes',
                      ] as const
                    ).map(key => (
                      <FitnessText key={key}>
                        {
                          {
                            calories: 'Energy',
                            proteinG: 'Protein',
                            carbsG: 'Carbs',
                            fatG: 'Fat',
                            fibreG: 'Fibre',
                            waterMl: 'Water',
                            steps: 'Steps',
                            sleepMinutes: 'Sleep',
                          }[key]
                        }{' '}
                        ·{' '}
                        {fitnessRangeLabel(
                          data.currentTargets?.[key],
                          {
                            calories: ' kcal',
                            proteinG: ' g',
                            carbsG: ' g',
                            fatG: ' g',
                            fibreG: ' g',
                            waterMl: ' ml',
                            steps: '',
                            sleepMinutes: ' min',
                          }[key],
                        ) ?? 'No numeric target saved'}
                      </FitnessText>
                    ))}
                    {data.currentTargets.habits.map(habit => (
                      <FitnessText muted key={habit.key}>
                        {habit.label} · {habit.target} {habit.unit}
                      </FitnessText>
                    ))}
                  </>
                )}
              </FitnessCard>
              {!!comparableDays.length && (
                <FitnessAction
                  label={
                    showComparisons
                      ? 'Hide daily target comparisons'
                      : 'Review daily target comparisons'
                  }
                  secondary
                  onPress={() => setShowComparisons(show => !show)}
                />
              )}
              {showComparisons &&
                comparableDays
                  .slice(0, comparisonLimit)
                  .map(comparison => (
                    <FitnessDailyComparison
                      key={comparison.date}
                      comparison={comparison}
                    />
                  ))}
              {showComparisons && comparisonLimit < comparableDays.length && (
                <FitnessAction
                  label="Show more recorded comparisons"
                  secondary
                  onPress={() => setComparisonLimit(limit => limit + 14)}
                />
              )}
              <FitnessCard>
                <FitnessSection title="The everyday record" />
                <FitnessText>
                  Water {data.totals.waterMl} ml · Steps {data.totals.steps}
                </FitnessText>
                <FitnessText>
                  Sleep {numberLabel(data.totals.sleepMinutes / 60)} hours
                  logged · Habits {data.totals.habitsCompleted} completed
                </FitnessText>
                <FitnessText>
                  Energy {numberLabel(data.totals.nutrients.calories)} kcal
                  logged
                </FitnessText>
                <FitnessText muted>
                  Totals reflect only entries in this period; they are not daily
                  recommendations.
                </FitnessText>
              </FitnessCard>
              <FitnessSection title="Strength, from your sets" />
              {data.strength.length ? (
                data.strength.map(item => {
                  const series = [...(item.series ?? [])]
                    .filter(
                      point =>
                        Number.isFinite(point.maxWeightKg) &&
                        point.maxWeightKg > 0,
                    )
                    .sort((a, b) => a.date.localeCompare(b.date));
                  const hasLoad = item.hasRecordedLoad ?? item.maxWeightKg > 0;
                  return (
                    <FitnessCard key={item.exercise}>
                      <FitnessText>{item.exercise}</FitnessText>
                      <FitnessText muted>
                        {hasLoad
                          ? `Highest recorded external load ${item.maxWeightKg} kg`
                          : 'No external load recorded'}{' '}
                        · {item.totalReps} reps logged
                      </FitnessText>
                      {series.length >= 2 ? (
                        <>
                          <FitnessText>
                            First recorded · {series[0].date} ·{' '}
                            {numberLabel(series[0].maxWeightKg, ' kg')}
                          </FitnessText>
                          <FitnessText>
                            Latest recorded · {series[series.length - 1].date} ·{' '}
                            {numberLabel(
                              series[series.length - 1].maxWeightKg,
                              ' kg',
                            )}
                          </FitnessText>
                          {item.weightChangeKg !== null &&
                            item.weightChangeKg !== undefined && (
                              <FitnessText muted>
                                Change in recorded load ·{' '}
                                {numberLabel(item.weightChangeKg, ' kg')}
                              </FitnessText>
                            )}
                          <FitnessChart
                            bars
                            title={`${item.exercise} recorded external load`}
                            values={series.map(point => point.maxWeightKg)}
                            labels={series.map(point => point.date)}
                            unit=" kg"
                          />
                          <FitnessText muted>
                            Each bar is a date with an explicitly recorded
                            external load. Unrecorded dates and bodyweight sets
                            are excluded.
                          </FitnessText>
                        </>
                      ) : series.length === 1 ? (
                        <FitnessText muted>
                          Recorded on {series[0].date}. A second dated load is
                          needed for a time comparison.
                        </FitnessText>
                      ) : (
                        <FitnessText muted>
                          Record dated external loads to see a time comparison.
                          Bodyweight work remains in your journal.
                        </FitnessText>
                      )}
                    </FitnessCard>
                  );
                })
              ) : (
                <FitnessText muted>
                  Record exercise sets to see your strength history.
                </FitnessText>
              )}
              <FitnessSection title="A few observations" />
              {data.insights.length ? (
                data.insights.map((insight, i) => (
                  <FitnessCard key={i}>
                    <FitnessText>{insight}</FitnessText>
                  </FitnessCard>
                ))
              ) : (
                <FitnessText muted>
                  More saved entries will help describe your rhythm over time.
                </FitnessText>
              )}
              {plans.data?.plans
                .filter(plan => plan.content.expertFeedback)
                .map(plan => (
                  <FitnessCard key={plan.id}>
                    <FitnessSection
                      title="Feedback from your expert"
                      caption={new Date(
                        plan.content.expertFeedback!.createdAt,
                      ).toLocaleDateString()}
                    />
                    <FitnessText>
                      {plan.content.expertFeedback!.note}
                    </FitnessText>
                    <FitnessAction
                      label="Open plan & feedback"
                      secondary
                      onPress={() =>
                        nav.navigate('FitnessPlan', {
                          planId: plan.id,
                          version: plan.content.expertFeedback!.version,
                        })
                      }
                    />
                  </FitnessCard>
                ))}
              <FitnessSection
                title="Your private photo journal"
                caption="Only photos you opted into comparisons appear here. Photos are never analyzed for body changes."
              />
              {media.isPending ? (
                <FitnessLoading />
              ) : media.isError ? (
                <>
                  <FitnessNotice error message={media.error.message} />
                  <FitnessAction
                    label="Retry progress photos"
                    secondary
                    onPress={() => {
                      void media.refetch();
                    }}
                  />
                </>
              ) : photos.length >= 2 ? (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {[photos[0], photos[photos.length - 1]].map(photo => (
                    <View style={{ flex: 1 }} key={photo.id}>
                      <FitnessPrivateMedia mediaId={photo.id} compact />
                      <FitnessText muted>
                        {new Date(photo.createdAt).toLocaleDateString()}
                      </FitnessText>
                    </View>
                  ))}
                </View>
              ) : photos.length === 1 ? (
                <FitnessCard>
                  <FitnessPrivateMedia mediaId={photos[0].id} />
                  <FitnessText muted>
                    {new Date(photos[0].createdAt).toLocaleDateString()}
                  </FitnessText>
                </FitnessCard>
              ) : (
                <FitnessText muted>
                  No comparison photos in this period. Add one privately and opt
                  in from Privacy.
                </FitnessText>
              )}
              <FitnessAction
                label="Manage private progress photos"
                secondary
                onPress={() => nav.navigate('FitnessPrivacy')}
              />

              <FitnessAction
                label="Open journal history"
                secondary
                onPress={() => nav.navigate('FitnessHistory')}
              />
            </FitnessDisclosure>
          </>
        )
      )}
    </FitnessScreen>
  );
}
