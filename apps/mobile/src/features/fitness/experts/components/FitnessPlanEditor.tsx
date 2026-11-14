import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import type {
  FitnessExpertKind,
  FitnessPlanContent,
  FitnessPlanRevision,
} from '@anticlock/contracts';
import {
  FitnessAction,
  FitnessCard,
  FitnessChoices,
  FitnessField,
  FitnessNotice,
  FitnessSection,
  FitnessText,
} from '../../components/FitnessUI';
import {
  emptyExercise,
  emptyWorkout,
  savedWorkouts,
  updateWorkoutDay,
  validRevisionDraft,
  workoutDrafts,
  type ExerciseDraft,
} from '../fitnessPlanDraft';

type TargetKey = 'proteinG' | 'carbsG' | 'fatG' | 'fibreG' | 'waterMl';
const TARGETS: Array<{
  key: TargetKey;
  label: string;
  unit: string;
  bounds: string;
}> = [
  { key: 'proteinG', label: 'Protein', unit: 'g', bounds: '0–250' },
  { key: 'carbsG', label: 'Carbohydrate', unit: 'g', bounds: '0–800' },
  { key: 'fatG', label: 'Fat', unit: 'g', bounds: '0–200' },
  { key: 'fibreG', label: 'Fibre', unit: 'g', bounds: '0–70' },
  { key: 'waterMl', label: 'Drinking water', unit: 'ml', bounds: '500–5,000' },
];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const rangeLabel = (
  range: { min: number; max: number } | number | null | undefined,
  unit: string,
) =>
  typeof range === 'number'
    ? `${range} ${unit}`
    : range
    ? `${range.min}–${range.max} ${unit}`
    : 'Not estimated';
export function FitnessPlanEditor({
  content,
  version,
  kind,
  busy,
  onPublish,
}: {
  content: FitnessPlanContent;
  version: number;
  kind: FitnessExpertKind;
  busy?: boolean;
  onPublish: (revision: FitnessPlanRevision) => Promise<unknown>;
}) {
  const [section, setSection] = useState('habits'),
    [title, setTitle] = useState(content.name),
    [note, setNote] = useState(''),
    [error, setError] = useState<string | null>(null);
  const [guidance, setGuidance] = useState(
      content.nutrition.guidance.join('\n'),
    ),
    [minCalories, setMinCalories] = useState(
      content.requiresProfessionalReview
        ? ''
        : content.nutrition.calories?.min.toString() ?? '',
    ),
    [maxCalories, setMaxCalories] = useState(
      content.requiresProfessionalReview
        ? ''
        : content.nutrition.calories?.max.toString() ?? '',
    );
  const [targets, setTargets] = useState(
    () =>
      Object.fromEntries(
        TARGETS.map(target => [
          target.key,
          {
            min: content.requiresProfessionalReview
              ? ''
              : content.nutrition.targets?.[target.key]?.min.toString() ?? '',
            max: content.requiresProfessionalReview
              ? ''
              : content.nutrition.targets?.[target.key]?.max.toString() ?? '',
          },
        ]),
      ) as Record<TargetKey, { min: string; max: string }>,
  );
  const [drafts, setDrafts] = useState(() => workoutDrafts(content.workouts)),
    [day, setDay] = useState(String(content.workouts[0]?.day ?? 1));
  const habitValue = (key: string) =>
    content.habits
      .find(
        value =>
          value.key === key || (key === 'sleep' && value.key === 'sleep_hours'),
      )
      ?.target.toString() ?? '';
  const [habit, setHabit] = useState('water'),
    [habitTarget, setHabitTarget] = useState(() => habitValue('water'));
  const current =
    drafts.find(workout => workout.day === Number(day)) ??
    emptyWorkout(Number(day));
  const updateDay = (change: (draft: typeof current) => typeof current) =>
    setDrafts(value => updateWorkoutDay(value, Number(day), change));
  const updateExercise = (index: number, patch: Partial<ExerciseDraft>) =>
    updateDay(workout => ({
      ...workout,
      exercises: workout.exercises.map((exercise, i) =>
        i === index ? { ...exercise, ...patch } : exercise,
      ),
    }));
  const publish = () => {
    setError(null);
    const request: FitnessPlanRevision = {
      expectedVersion: version,
      title: title.trim() || undefined,
      note: note.trim(),
    };
    if (section === 'nutrition') {
      if (Boolean(minCalories.trim()) !== Boolean(maxCalories.trim())) {
        setError('Enter both calorie limits, or clear both.');
        return;
      }
      const explicit: NonNullable<
          NonNullable<FitnessPlanRevision['nutrition']>['targets']
        > = {},
        clearTargets: TargetKey[] = [];
      for (const target of TARGETS) {
        const draft = targets[target.key];
        if (Boolean(draft.min.trim()) !== Boolean(draft.max.trim())) {
          setError(
            `Enter both ${target.label.toLowerCase()} limits, or clear both to use the saved estimate.`,
          );
          return;
        }
        if (draft.min.trim() && draft.max.trim())
          explicit[target.key] = {
            min: Number(draft.min),
            max: Number(draft.max),
          };
        else if (content.nutrition.targets?.[target.key])
          clearTargets.push(target.key);
      }
      request.nutrition = {
        guidance: guidance
          .split('\n')
          .map(value => value.trim())
          .filter(Boolean),
        calories: minCalories.trim()
          ? { min: Number(minCalories), max: Number(maxCalories) }
          : null,
        ...(Object.keys(explicit).length ? { targets: explicit } : {}),
        ...(clearTargets.length ? { clearTargets } : {}),
      };
    } else if (section === 'workouts') {
      if (!current.name.trim() || !current.exercises.length) {
        setError(
          `Add a workout name and at least one exercise for ${
            DAYS[Number(day)]
          }.`,
        );
        return;
      }
      request.workouts = savedWorkouts(drafts);
    } else {
      if (!habitTarget.trim()) {
        setError('Enter the daily habit target before publishing.');
        return;
      }
      const key = habit,
        target = Number(habitTarget);
      request.habits = [
        ...content.habits.filter(
          value =>
            value.key !== key &&
            !(key === 'sleep' && value.key === 'sleep_hours'),
        ),
        {
          key,
          label:
            habit === 'water' ? 'Water' : habit === 'steps' ? 'Steps' : 'Sleep',
          target,
          unit:
            habit === 'water' ? 'ml' : habit === 'steps' ? 'steps' : 'hours',
        },
      ];
    }
    if (!validRevisionDraft(request)) {
      setError(
        note.trim().length < 3
          ? 'Add a short explanation of this revision for your client.'
          : section === 'workouts'
          ? 'Review each workout and exercise. Names, sets, reps and timing must be complete and within the supported limits.'
          : section === 'nutrition'
          ? 'Review your target ranges. Enter finite values within each displayed limit, with the minimum no higher than the maximum.'
          : 'Review the habit target and its unit.',
      );
      return;
    }
    Alert.alert(
      'Publish a new plan version?',
      `Your client will receive a notification. Version ${version} stays in their history.${
        section === 'workouts'
          ? `\n${
              request.workouts!.length
            } workout(s), ${request.workouts!.reduce(
              (sum, workout) => sum + workout.exercises.length,
              0,
            )} exercises in this version.`
          : ''
      }`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Publish revision',
          onPress: () =>
            void onPublish(request).catch(cause =>
              setError(
                cause instanceof Error
                  ? cause.message
                  : 'The revision could not be confirmed. Your draft is still here.',
              ),
            ),
        },
      ],
    );
  };
  return (
    <FitnessCard tone="soft">
      <FitnessSection
        title="Revise their plan"
        caption={`Current version ${version}. Every revision remains in the client's history.`}
      />
      <FitnessChoices
        label="Plan section"
        options={
          kind === 'nutritionist'
            ? ['nutrition', 'habits']
            : content.requiresProfessionalReview
            ? ['habits']
            : ['workouts', 'habits']
        }
        selected={section}
        onChange={setSection}
      />
      <FitnessField
        label="Plan title"
        value={title}
        onChangeText={setTitle}
        maxLength={160}
      />
      {section === 'nutrition' ? (
        <>
          <FitnessField
            label="Nutrition guidance (one point per line)"
            multiline
            value={guidance}
            onChangeText={setGuidance}
          />
          <FitnessField
            label="Daily calorie range minimum (optional)"
            editable={!content.requiresProfessionalReview}
            keyboardType="numeric"
            value={minCalories}
            onChangeText={setMinCalories}
          />
          <FitnessField
            label="Daily calorie range maximum (optional)"
            editable={!content.requiresProfessionalReview}
            keyboardType="numeric"
            value={maxCalories}
            onChangeText={setMaxCalories}
          />
          {content.requiresProfessionalReview && (
            <FitnessNotice message="Clinical review is required. Numeric nutrition targets and exercise prescriptions remain unavailable; general guidance can still be revised." />
          )}
          <FitnessText muted>
            Only completed pairs become expert targets. Clear both values to
            return that target to the saved baseline estimate. Targets need
            individual professional judgment.
          </FitnessText>
          {TARGETS.map(target => {
            const baseline = content.requiresProfessionalReview
              ? undefined
              : content.baselineTargets?.[target.key];
            return (
              <FitnessCard key={target.key}>
                <FitnessSection
                  title={`${target.label} (${target.unit}/day)`}
                  caption={`Saved baseline: ${rangeLabel(
                    baseline,
                    target.unit,
                  )}. Supported range ${target.bounds} ${target.unit}.`}
                />
                <FitnessField
                  label={`${target.label} minimum (${target.unit})`}
                  editable={!content.requiresProfessionalReview}
                  value={targets[target.key].min}
                  keyboardType="numeric"
                  onChangeText={value =>
                    setTargets(current => ({
                      ...current,
                      [target.key]: { ...current[target.key], min: value },
                    }))
                  }
                />
                <FitnessField
                  label={`${target.label} maximum (${target.unit})`}
                  editable={!content.requiresProfessionalReview}
                  value={targets[target.key].max}
                  keyboardType="numeric"
                  onChangeText={value =>
                    setTargets(current => ({
                      ...current,
                      [target.key]: { ...current[target.key], max: value },
                    }))
                  }
                />
              </FitnessCard>
            );
          })}
        </>
      ) : section === 'workouts' ? (
        <>
          <FitnessChoices
            label="Workout day"
            options={DAYS}
            selected={DAYS[Number(day)]}
            onChange={(value: string) => setDay(String(DAYS.indexOf(value)))}
          />
          <FitnessField
            label="Workout name"
            value={current.name}
            onChangeText={value =>
              updateDay(workout => ({ ...workout, name: value }))
            }
            maxLength={160}
          />
          <FitnessField
            label="Duration in minutes"
            keyboardType="numeric"
            value={current.durationMinutes}
            onChangeText={value =>
              updateDay(workout => ({ ...workout, durationMinutes: value }))
            }
          />
          <FitnessText muted>
            {current.exercises.length} exercise(s) in this workout. All saved
            exercises and other days remain in the draft until you explicitly
            change them.
          </FitnessText>
          {current.exercises.map((exercise, index) => (
            <FitnessCard key={`${day}-${index}`}>
              <FitnessSection title={`Exercise ${index + 1}`} />
              <FitnessField
                label={`Exercise ${index + 1} name`}
                value={exercise.name}
                onChangeText={value => updateExercise(index, { name: value })}
                maxLength={150}
              />
              <FitnessField
                label={`Exercise ${index + 1} sets`}
                value={exercise.sets}
                keyboardType="numeric"
                onChangeText={value => updateExercise(index, { sets: value })}
              />
              <FitnessField
                label={`Exercise ${index + 1} reps per set (optional)`}
                value={exercise.reps}
                keyboardType="numeric"
                onChangeText={value => updateExercise(index, { reps: value })}
              />
              <FitnessField
                label={`Exercise ${index + 1} duration seconds (optional)`}
                value={exercise.durationSeconds}
                keyboardType="numeric"
                onChangeText={value =>
                  updateExercise(index, { durationSeconds: value })
                }
              />
              <FitnessField
                label={`Exercise ${index + 1} rest seconds (optional)`}
                value={exercise.restSeconds}
                keyboardType="numeric"
                onChangeText={value =>
                  updateExercise(index, { restSeconds: value })
                }
              />
              <FitnessField
                label={`Exercise ${index + 1} instructions`}
                value={exercise.instructions}
                multiline
                onChangeText={value =>
                  updateExercise(index, { instructions: value })
                }
                maxLength={3000}
              />
              <FitnessField
                label={`Exercise ${index + 1} substitutions (one per line)`}
                value={exercise.substitutions}
                multiline
                onChangeText={value =>
                  updateExercise(index, { substitutions: value })
                }
              />
              <FitnessField
                label={`Exercise ${index + 1} notes (optional)`}
                value={exercise.notes}
                multiline
                onChangeText={value => updateExercise(index, { notes: value })}
                maxLength={1000}
              />
              {exercise.mediaId && (
                <>
                  <FitnessText muted>
                    An existing private media reference stays attached. Viewing
                    it still requires the client's separate media permission.
                  </FitnessText>
                  <FitnessAction
                    secondary
                    label={`Remove media from exercise ${index + 1}`}
                    onPress={() =>
                      updateExercise(index, { mediaId: undefined })
                    }
                  />
                </>
              )}
              <FitnessAction
                destructive
                label={`Remove exercise ${index + 1}`}
                onPress={() =>
                  updateDay(workout => ({
                    ...workout,
                    exercises: workout.exercises.filter((_, i) => i !== index),
                  }))
                }
              />
            </FitnessCard>
          ))}
          <FitnessAction
            secondary
            label="Add another exercise"
            disabled={current.exercises.length >= 30}
            onPress={() =>
              updateDay(workout => ({
                ...workout,
                exercises: [...workout.exercises, emptyExercise()],
              }))
            }
          />
          <FitnessText muted>
            Days in this version:{' '}
            {drafts
              .map(
                workout => `${DAYS[workout.day]} (${workout.exercises.length})`,
              )
              .join(' · ') || 'No workouts yet'}
          </FitnessText>
        </>
      ) : (
        <>
          <FitnessChoices
            label="Target habit"
            options={['water', 'steps', 'sleep']}
            selected={habit}
            onChange={(value: string) => {
              setHabit(value);
              setHabitTarget(habitValue(value));
            }}
          />
          <FitnessField
            label={`Daily ${habit} target (${
              habit === 'water' ? 'ml' : habit === 'steps' ? 'steps' : 'hours'
            })`}
            keyboardType="numeric"
            value={habitTarget}
            onChangeText={setHabitTarget}
          />
        </>
      )}
      <FitnessField
        label="Explain this revision to your client"
        multiline
        value={note}
        onChangeText={setNote}
      />
      <FitnessNotice message={error} error />
      <FitnessAction
        label="Review and publish version"
        busy={busy}
        onPress={publish}
      />
    </FitnessCard>
  );
}
