import React from 'react';
import { View } from 'react-native';
import type {
  FitnessDayComparison,
  FitnessDayTotals,
  FitnessProgress,
  FitnessSummary,
  FitnessTargets,
  FitnessWeightProgress,
  FitnessWeightSnapshot,
} from '@anticlock/contracts';
import { dayMetric, numberLabel } from '../fitnessModel';
import { FitnessDisclosure } from './FitnessControls';
import {
  FitnessCard,
  FitnessNotice,
  FitnessSection,
  FitnessText,
  useFitnessColors,
} from './FitnessUI';

export type FitnessRange = { min: number; max: number };
export function fitnessRangeLabel(
  range: FitnessRange | null | undefined,
  unit: string,
) {
  return range
    ? `${numberLabel(range.min)}${
        range.min === range.max ? '' : `–${numberLabel(range.max)}`
      }${unit}`
    : null;
}
export function FitnessTargetLine({
  label,
  actual,
  range,
  unit = '',
  unavailable = 'No daily target saved',
}: {
  label: string;
  actual: number | null;
  range?: FitnessRange | null;
  unit?: string;
  unavailable?: string;
}) {
  const colors = useFitnessColors();
  return (
    <View style={{ gap: 4 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <FitnessText>{label}</FitnessText>
        </View>
        <View style={{ flexShrink: 1 }}>
          <FitnessText>
            {actual === null
              ? 'No entry'
              : `${numberLabel(actual)}${unit} logged`}
          </FitnessText>
        </View>
      </View>
      <FitnessText muted>
        {range
          ? `Daily reference · ${fitnessRangeLabel(range, unit)}`
          : unavailable}
      </FitnessText>
      <View style={{ height: 1, backgroundColor: colors.line, marginTop: 6 }} />
    </View>
  );
}
export function FitnessDailyNutrition({
  day,
  targets,
  status,
}: {
  day: FitnessDayTotals;
  targets?: FitnessTargets | null;
  status?: string;
}) {
  const unavailable =
    status === 'needs_review'
      ? 'Targets withheld for professional review'
      : status === 'no_plan'
      ? 'No saved plan target'
      : 'No daily target saved';
  return (
    <FitnessCard>
      <FitnessSection
        title="Nourishment, with context"
        caption="Logged meals beside your saved daily reference ranges. Partial journals change these totals."
      />
      {status === 'needs_review' && (
        <FitnessNotice message="Numeric targets are withheld until appropriate professional review." />
      )}
      {(['calories', 'proteinG', 'carbsG', 'fatG', 'fibreG'] as const).map(
        key => (
          <FitnessTargetLine
            key={key}
            label={
              {
                calories: 'Energy',
                proteinG: 'Protein',
                carbsG: 'Carbs',
                fatG: 'Fat',
                fibreG: 'Fibre',
              }[key]
            }
            actual={dayMetric(day, key)}
            range={status === 'needs_review' ? null : targets?.[key]}
            unit={key === 'calories' ? ' kcal' : ' g'}
            unavailable={unavailable}
          />
        ),
      )}
    </FitnessCard>
  );
}
export function FitnessWeightJourney({
  snapshot,
  progress,
  current = false,
  compact = false,
  reviewRequired = false,
}: {
  snapshot?: FitnessWeightSnapshot | null;
  progress?: FitnessWeightProgress | null;
  current?: boolean;
  compact?: boolean;
  reviewRequired?: boolean;
}) {
  return (
    <FitnessCard>
      <FitnessSection
        title={current ? 'Your current weight record' : 'Your weight record'}
        caption={
          current
            ? 'Current saved snapshot, separate from the selected history period.'
            : undefined
        }
      />
      {snapshot ? (
        <>
          <FitnessText large>
            {numberLabel(snapshot.weightKg, ' kg')}
          </FitnessText>
          <FitnessText muted>
            {snapshot.date} ·{' '}
            {snapshot.source === 'measurement'
              ? 'Saved weight entry'
              : 'Saved assessment weight'}
          </FitnessText>
        </>
      ) : (
        <FitnessText muted>No weight record is available yet.</FitnessText>
      )}
      {progress && (
        <FitnessDisclosure
          title="Weight details"
          subtitle="Starting record and chosen target"
          defaultOpen={!compact}
        >
          <FitnessText>
            Starting record · {numberLabel(progress.startWeightKg, ' kg')} ·{' '}
            {progress.startDate}
          </FitnessText>
          <FitnessText muted>
            {progress.startSource === 'initial_assessment'
              ? 'From your first completed assessment.'
              : 'From your current assessment; an earlier starting record is unavailable.'}
          </FitnessText>
          <FitnessText>
            Change from that record · {numberLabel(progress.changeKg, ' kg')}
          </FitnessText>
          {progress.targetWeightKg === null || reviewRequired ? (
            <FitnessText muted>
              {reviewRequired
                ? 'Weight-target comparisons are withheld for professional review.'
                : 'No active weight target is available for comparison.'}
            </FitnessText>
          ) : (
            <>
              <FitnessText>
                Chosen target · {numberLabel(progress.targetWeightKg, ' kg')}
              </FitnessText>
              {progress.remainingKg !== null && (
                <FitnessText muted>
                  Difference from chosen target ·{' '}
                  {numberLabel(progress.remainingKg, ' kg')}
                </FitnessText>
              )}
              {progress.progressPercent !== null ? (
                <FitnessText>
                  {numberLabel(progress.progressPercent, '%')} of your chosen
                  change recorded
                </FitnessText>
              ) : (
                <FitnessText muted>
                  A target progress percentage is not available from these
                  records.
                </FitnessText>
              )}
              <FitnessText muted>
                Progress describes saved values; it does not judge your health
                or set a pace.
              </FitnessText>
            </>
          )}
        </FitnessDisclosure>
      )}
    </FitnessCard>
  );
}
export function FitnessWorkoutCompletion({
  workout,
  noPlan = false,
  reviewRequired = false,
}: {
  workout?: FitnessSummary['todayWorkout'];
  noPlan?: boolean;
  reviewRequired?: boolean;
}) {
  if (reviewRequired)
    return (
      <FitnessNotice message="Scheduled workout comparisons are withheld while your plan needs professional review. Your activity journal remains available." />
    );
  if (noPlan)
    return (
      <FitnessText muted>
        Create a saved plan to see scheduled workout comparisons.
      </FitnessText>
    );
  if (!workout)
    return (
      <FitnessText muted>
        {noPlan
          ? 'Create a saved plan to see scheduled workout comparisons.'
          : 'A scheduled workout comparison is not available.'}
      </FitnessText>
    );
  return (
    <>
      <FitnessText>
        {workout.completed} of {workout.planned} scheduled workouts recorded
        complete
      </FitnessText>
      <FitnessText muted>
        {workout.completionPercent === null
          ? 'No scheduled workout is due on this date.'
          : `${numberLabel(
              workout.completionPercent,
              '%',
            )} of this date’s saved schedule complete. Unscheduled activity is kept in your journal.`}
      </FitnessText>
    </>
  );
}
export function FitnessWeeklyConsistency({
  weekly,
  status,
}: {
  weekly: FitnessSummary['weekly'];
  status?: string;
}) {
  if (status === 'needs_review')
    return (
      <FitnessNotice message="Consistency comparisons are withheld while your plan needs professional review." />
    );
  if (status === 'no_plan')
    return (
      <FitnessText muted>
        Save a plan to compare your week with its schedule.
      </FitnessText>
    );
  if (weekly.consistencyPercent === undefined)
    return (
      <FitnessText muted>
        {status === 'no_plan'
          ? 'Save a plan to compare your week with its schedule.'
          : 'Your saved schedule comparison is not available yet.'}
      </FitnessText>
    );
  return (
    <>
      <FitnessText large>
        {weekly.consistencyPercent === null
          ? '—'
          : numberLabel(weekly.consistencyPercent, '%')}
      </FitnessText>
      <FitnessText>Scheduled-day consistency</FitnessText>
      <FitnessText muted>
        {weekly.consistencyPercent === null
          ? 'No scheduled days are due in this period.'
          : `${weekly.completedPlannedDays} of ${weekly.plannedDays} scheduled days recorded complete. Only dates already due are compared; future dates are excluded.`}
      </FitnessText>
      {weekly.plannedWorkouts !== undefined && (
        <FitnessText>
          {weekly.completedPlannedWorkouts ?? 0} of {weekly.plannedWorkouts} due
          workouts complete
          {weekly.completionPercent === null ||
          weekly.completionPercent === undefined
            ? ''
            : ` · ${numberLabel(weekly.completionPercent, '%')}`}
        </FitnessText>
      )}
    </>
  );
}
export function FitnessAdherence({
  adherence,
  notice,
  status,
}: {
  adherence?: FitnessProgress['adherence'];
  notice?: string;
  status?: string;
}) {
  return (
    <FitnessCard>
      <FitnessSection
        title="Workouts & nutrition"
        caption={'Compared with your saved plan'}
      />
      {status === 'needs_review' ? (
        <FitnessNotice message="Numeric target and scheduled workout comparisons are withheld for professional review." />
      ) : adherence ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18 }}>
            <View style={{ flex: 1, minWidth: 120, gap: 5 }}>
              <FitnessText large>
                {adherence.completedPlannedWorkouts} /{' '}
                {adherence.plannedWorkouts}
              </FitnessText>
              <FitnessText muted>Due workouts complete</FitnessText>
            </View>
            <View style={{ flex: 1, minWidth: 120, gap: 5 }}>
              <FitnessText large>
                {adherence.nutritionInRangeDays} /{' '}
                {adherence.nutritionRecordedDays}
              </FitnessText>
              <FitnessText muted>Recorded meal days in range</FitnessText>
            </View>
          </View>
          <FitnessDisclosure
            title="About these comparisons"
            subtitle="Recorded entries only"
          >
            <FitnessText>
              {adherence.completedPlannedWorkouts} of{' '}
              {adherence.plannedWorkouts} due scheduled workouts recorded
              complete
              {adherence.completionPercent === null
                ? ''
                : ` · ${numberLabel(adherence.completionPercent, '%')}`}
            </FitnessText>
            <FitnessText>
              {adherence.nutritionInRangeDays} of{' '}
              {adherence.nutritionRecordedDays} recorded meal days within the
              compared calorie range
              {adherence.nutritionInRangePercent === null
                ? ''
                : ` · ${numberLabel(adherence.nutritionInRangePercent, '%')}`}
            </FitnessText>
            {notice && <FitnessText muted>{notice}</FitnessText>}
            <FitnessText muted>
              {adherence.nutritionInRangePercent === null
                ? 'No recorded calorie-range comparison is available.'
                : 'This compares logged calorie totals, including partially recorded days. It is not a nutrition quality score.'}
            </FitnessText>
          </FitnessDisclosure>
        </>
      ) : (
        <FitnessText muted>
          {status === 'no_plan'
            ? 'Save a plan to see target comparisons.'
            : 'Target comparisons are not available for this period.'}
        </FitnessText>
      )}
    </FitnessCard>
  );
}
export function FitnessDailyComparison({
  comparison,
}: {
  comparison: FitnessDayComparison;
}) {
  const basis =
    comparison.basis === 'saved_plan_version'
      ? `Saved plan version ${comparison.version ?? 'unavailable'}`
      : comparison.basis === 'current_targets'
      ? 'Current saved targets · comparison only'
      : 'No saved target basis';
  return (
    <FitnessCard>
      <FitnessSection title={comparison.date} caption={basis} />
      {comparison.basis === 'current_targets' && (
        <FitnessNotice message="These are current saved targets, not recommendations that applied on this date." />
      )}
      {!comparison.targets ? (
        <FitnessText muted>
          No saved targets are available for this date.
        </FitnessText>
      ) : (
        <>
          {comparison.nutrition ? (
            (['calories', 'proteinG', 'carbsG', 'fatG', 'fibreG'] as const).map(
              key => {
                const value = comparison.nutrition?.[key];
                return value ? (
                  <FitnessTargetLine
                    key={key}
                    label={
                      {
                        calories: 'Energy',
                        proteinG: 'Protein',
                        carbsG: 'Carbs',
                        fatG: 'Fat',
                        fibreG: 'Fibre',
                      }[key]
                    }
                    actual={value.actual}
                    range={{ min: value.targetMin, max: value.targetMax }}
                    unit={key === 'calories' ? ' kcal' : ' g'}
                  />
                ) : null;
              },
            )
          ) : (
            <FitnessText muted>
              No meal entry is recorded for a calorie or macro comparison.
            </FitnessText>
          )}
          {(['water', 'steps', 'sleep'] as const).map(key => {
            const value = comparison[key];
            return value ? (
              <FitnessTargetLine
                key={key}
                label={{ water: 'Water', steps: 'Steps', sleep: 'Sleep' }[key]}
                actual={value.actual}
                range={{ min: value.targetMin, max: value.targetMax }}
                unit={{ water: ' ml', steps: '', sleep: ' min' }[key]}
              />
            ) : null;
          })}
          {comparison.workout && (
            <>
              <FitnessText>
                {comparison.workout.completed} of {comparison.workout.planned}{' '}
                scheduled workouts recorded complete
              </FitnessText>
              <FitnessText muted>
                {comparison.workout.completionPercent === null
                  ? 'No scheduled workout was due on this date.'
                  : `${numberLabel(
                      comparison.workout.completionPercent,
                      '%',
                    )} of this date’s saved schedule complete.`}
              </FitnessText>
            </>
          )}
        </>
      )}
    </FitnessCard>
  );
}
