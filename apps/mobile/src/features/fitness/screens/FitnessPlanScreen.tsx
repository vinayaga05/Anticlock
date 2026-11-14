import React, { useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import type {
  FitnessPlan,
  FitnessPlanVersion,
  FitnessProfile,
} from '@anticlock/contracts';
import { useFitnessMutation, useFitnessQuery } from '../api/fitnessApi';
import { FITNESS_REVIEW_GUIDANCE } from '../fitnessModel';
import { fitnessRangeLabel } from '../components/FitnessTargetCards';
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

export function FitnessPlanScreen() {
  const nav = useNavigation<any>();
  const query = useFitnessQuery<{ plans: FitnessPlan[] }>('/plans');
  const profile = useFitnessQuery<{ profile: FitnessProfile | null }>(
    '/profile',
  );
  const mutation = useFitnessMutation();
  const [error, setError] = useState('');
  const [showVersions, setShowVersions] = useState(false);
  const route = useRoute<any>();
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>(
    route.params?.version,
  );
  const currentPlan = route.params?.planId
    ? query.data?.plans.find(p => p.id === route.params.planId)
    : query.data?.plans[0];
  const versions = useFitnessQuery<{ versions: FitnessPlanVersion[] }>(
    `/plans/${currentPlan?.id ?? ''}/versions`,
    Boolean(currentPlan && (showVersions || selectedVersion)),
  );
  const historical = versions.data?.versions.find(
    v => v.version === selectedVersion,
  );
  const plan =
    currentPlan &&
    (selectedVersion
      ? historical
        ? {
            ...currentPlan,
            content: historical.content,
            currentVersion: historical.version,
          }
        : undefined
      : currentPlan);
  const baseline = profile.data?.profile?.baseline;
  async function generate() {
    try {
      setError('');
      await mutation.mutateAsync({ path: '/plans/generate', body: {} });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <FitnessScreen
      busy={mutation.isPending}
      title="Made for your rhythm"
      subtitle="A saved, versioned starting point. Review it with a qualified professional when needed."
    >
      {query.isPending || (selectedVersion && versions.isPending) ? (
        <FitnessLoading />
      ) : query.isError ? (
        <FitnessEmpty
          title="Plan unavailable"
          message={query.error.message}
          action="Retry"
          onPress={() => {
            void query.refetch();
          }}
        />
      ) : selectedVersion && !plan ? (
        <FitnessEmpty
          title="This plan version is unavailable"
          message={
            versions.error?.message ??
            'This version may no longer be accessible.'
          }
          action="Open latest saved version"
          onPress={() => setSelectedVersion(undefined)}
        />
      ) : route.params?.planId && !plan ? (
        <FitnessEmpty
          title="Plan unavailable"
          message="This saved plan could not be found in your account."
        />
      ) : !plan ? (
        <FitnessEmpty
          title="Ready for a starting point?"
          message="Create a plan from your completed assessment. Your plan will be saved for review."
          action={
            profile.data?.profile?.status === 'complete'
              ? 'Create my starter plan'
              : 'Complete assessment'
          }
          onPress={() =>
            profile.data?.profile?.status === 'complete'
              ? void generate()
              : nav.navigate('FitnessAssessment')
          }
        />
      ) : (
        <>
          <FitnessCard tone="soft">
            <FitnessSection
              title={plan.title}
              caption={`Version ${plan.currentVersion} · ${
                plan.providerId ? 'Expert authored' : 'Starter wellness plan'
              }`}
            />
            <FitnessText>{plan.content.description}</FitnessText>
            {(plan.content.requiresProfessionalReview ||
              plan.status === 'needs_review') && (
              <FitnessNotice message={FITNESS_REVIEW_GUIDANCE} />
            )}
          </FitnessCard>
          {selectedVersion && (
            <FitnessAction
              label="Return to the latest saved plan"
              secondary
              onPress={() => setSelectedVersion(undefined)}
            />
          )}
          {plan.content.expertFeedback && (
            <FitnessCard>
              <FitnessSection
                title="Expert feedback"
                caption={new Date(
                  plan.content.expertFeedback.createdAt,
                ).toLocaleDateString()}
              />
              <FitnessText>{plan.content.expertFeedback.note}</FitnessText>
              <FitnessText muted>
                Feedback on plan version {plan.content.expertFeedback.version}.
              </FitnessText>
            </FitnessCard>
          )}
          {baseline && (
            <FitnessCard>
              <FitnessSection
                title="Your baseline estimates"
                caption="These are estimates, not measurements or medical advice."
              />
              <FitnessText>
                Age {baseline.age} · BMI{' '}
                {baseline.bmi === null ? 'withheld' : baseline.bmi.toFixed(1)}
              </FitnessText>
              {(
                [
                  'bmr',
                  'tdee',
                  'calories',
                  'proteinG',
                  'carbsG',
                  'fatG',
                ] as const
              ).map(key => (
                <FitnessText key={key}>
                  {
                    {
                      bmr: 'Resting energy',
                      tdee: 'Daily energy',
                      calories: 'Calorie range',
                      proteinG: 'Protein (g)',
                      carbsG: 'Carbs (g)',
                      fatG: 'Fat (g)',
                    }[key]
                  }{' '}
                  ·{' '}
                  {baseline[key]
                    ? `${Math.round(baseline[key]!.min)}–${Math.round(
                        baseline[key]!.max,
                      )}`
                    : 'Withheld for professional review'}
                </FitnessText>
              ))}
              <FitnessText>
                Fibre ·{' '}
                {baseline.fibreG === null ? 'Withheld' : `${baseline.fibreG} g`}{' '}
                · Water ·{' '}
                {baseline.waterMl === null
                  ? 'Withheld'
                  : `${baseline.waterMl} ml`}
              </FitnessText>
              {[...baseline.assumptions, ...baseline.guidance].map(
                (line, i) => (
                  <FitnessText key={i} muted>
                    {line}
                  </FitnessText>
                ),
              )}
            </FitnessCard>
          )}
          <FitnessSection title="Movement" />
          {(plan.status === 'needs_review' ||
            plan.content.requiresProfessionalReview) &&
          !selectedVersion ? (
            <FitnessNotice message="Review this plan with an appropriately qualified professional before using exercise guidance. Your own activity journal remains available." />
          ) : plan.content.workouts.length ? (
            plan.content.workouts.map((workout, index) => (
              <FitnessCard key={index}>
                <FitnessSection
                  title={workout.name}
                  caption={`${
                    [
                      'Sunday',
                      'Monday',
                      'Tuesday',
                      'Wednesday',
                      'Thursday',
                      'Friday',
                      'Saturday',
                    ][workout.day]
                  } · ${workout.durationMinutes} minutes`}
                />
                {workout.exercises.map((exercise, i) => (
                  <FitnessText key={i}>
                    {exercise.name} · {exercise.sets} sets
                    {exercise.reps ? ` × ${exercise.reps} reps` : ''}
                    {exercise.durationSeconds
                      ? ` · ${exercise.durationSeconds} sec`
                      : ''}
                    {exercise.restSeconds
                      ? ` · rest ${exercise.restSeconds}s`
                      : ''}
                    {exercise.instructions ? `\n${exercise.instructions}` : ''}
                    {exercise.notes ? `\n${exercise.notes}` : ''}
                    {exercise.substitutions?.length
                      ? `\nAlternatives: ${exercise.substitutions.join(', ')}`
                      : ''}
                  </FitnessText>
                ))}
                <FitnessAction
                  label="Open workout log"
                  secondary
                  disabled={
                    plan.status === 'needs_review' ||
                    plan.content.requiresProfessionalReview ||
                    (selectedVersion !== undefined &&
                      selectedVersion !== currentPlan?.currentVersion)
                  }
                  onPress={() =>
                    nav.navigate('FitnessWorkout', {
                      planId: plan.id,
                      day: workout.day,
                    })
                  }
                />
              </FitnessCard>
            ))
          ) : (
            <FitnessText muted>
              No automatic exercise prescription. Ask an approved expert for a
              reviewed plan.
            </FitnessText>
          )}
          <FitnessCard>
            <FitnessSection title="Nourishment" />
            {plan.status === 'needs_review' && !selectedVersion ? (
              <FitnessNotice message="Nutrition guidance is awaiting review of your updated assessment." />
            ) : (
              plan.content.nutrition.guidance.map((line, i) => (
                <FitnessText key={i}>{line}</FitnessText>
              ))
            )}
            <FitnessAction
              label="Open meal journal"
              secondary
              onPress={() => nav.navigate('FitnessMeals')}
            />
          </FitnessCard>
          <FitnessCard>
            <FitnessSection
              title="This version’s saved nutrition ranges"
              caption="Explicit ranges saved with this plan version. Baseline estimates above remain separate."
            />
            {plan.content.requiresProfessionalReview ||
            plan.status === 'needs_review' ||
            baseline?.requiresProfessionalReview ? (
              <FitnessNotice message="Numeric targets are withheld for appropriate professional review." />
            ) : (
              <>
                <FitnessText>
                  Energy ·{' '}
                  {fitnessRangeLabel(
                    plan.content.nutrition.calories,
                    ' kcal',
                  ) ?? 'No numeric range saved'}
                </FitnessText>
                {(
                  ['proteinG', 'carbsG', 'fatG', 'fibreG', 'waterMl'] as const
                ).map(key => {
                  const range = plan.content.nutrition.targets?.[key];
                  return range ? (
                    <FitnessText key={key}>
                      {
                        {
                          proteinG: 'Protein',
                          carbsG: 'Carbs',
                          fatG: 'Fat',
                          fibreG: 'Fibre',
                          waterMl: 'Water',
                        }[key]
                      }{' '}
                      ·{' '}
                      {fitnessRangeLabel(
                        range,
                        key === 'waterMl' ? ' ml' : ' g',
                      )}
                    </FitnessText>
                  ) : null;
                })}
              </>
            )}
          </FitnessCard>
          <FitnessCard>
            <FitnessSection title="Everyday anchors" />
            {plan.content.habits.map(habit => (
              <FitnessText key={habit.key}>
                {habit.label} · {habit.target} {habit.unit}
              </FitnessText>
            ))}
            {plan.content.assumptions.map((line, i) => (
              <FitnessText key={i} muted>
                {line}
              </FitnessText>
            ))}
          </FitnessCard>
          <FitnessAction
            label={
              showVersions ? 'Hide plan history' : 'View plan version history'
            }
            secondary
            onPress={() => setShowVersions(v => !v)}
          />
          {showVersions &&
            (versions.isPending ? (
              <FitnessLoading />
            ) : versions.isError ? (
              <FitnessNotice error message={versions.error.message} />
            ) : (
              versions.data?.versions.map(version => (
                <FitnessCard key={version.id}>
                  <FitnessSection
                    title={`Version ${version.version} · ${version.content.name}`}
                    caption={new Date(version.createdAt).toLocaleDateString()}
                  />
                  <FitnessText muted>{version.content.description}</FitnessText>
                  {version.content.expertFeedback && (
                    <FitnessText>
                      {version.content.expertFeedback.note}
                    </FitnessText>
                  )}
                  <FitnessAction
                    label={`Read version ${version.version}`}
                    secondary
                    onPress={() => setSelectedVersion(version.version)}
                  />
                </FitnessCard>
              ))
            ))}
          <FitnessAction
            label="Review with an expert"
            onPress={() => nav.navigate('FitnessExperts')}
          />
          <FitnessAction
            label="Update my assessment"
            secondary
            onPress={() => nav.navigate('FitnessAssessment')}
          />
        </>
      )}
      <FitnessNotice error message={error} />
    </FitnessScreen>
  );
}
