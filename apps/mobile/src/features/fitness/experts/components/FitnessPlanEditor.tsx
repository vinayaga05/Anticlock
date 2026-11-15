import React, { useState } from 'react';
import { Alert } from 'react-native';
import {
  FitnessDisclosure,
  FitnessStepper,
} from '../../components/FitnessControls';
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

function Numeric({
  label,
  value,
  onChangeText,
  min,
  max,
  step = 1,
  disabled,
  optional = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  optional?: boolean;
}) {
  return (
    <>
      <FitnessStepper
        label={label}
        value={value.trim() ? Number(value) : undefined}
        onChange={number => onChangeText(String(number))}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
      />
      {optional && value !== '' && !disabled && (
        <FitnessAction
          secondary
          label={`Clear ${label}`}
          onPress={() => onChangeText('')}
        />
      )}
    </>
  );
}
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
      <FitnessDisclosure title="Plan title" subtitle={title}>
        <FitnessField
          label="Plan title"
          value={title}
          onChangeText={setTitle}
          maxLength={160}
        />
      </FitnessDisclosure>
      {section === 'nutrition' ? (
        <>
          <FitnessField
            label="Nutrition guidance (one point per line)"
            multiline
            value={guidance}
            onChangeText={setGuidance}
          />
          <FitnessDisclosure
            title="Energy range"
            subtitle={
              minCalories && maxCalories
                ? `${minCalories}–${maxCalories} kcal`
                : 'Optional · no numeric range'
            }
          >
            <Numeric
              label="Daily calorie range minimum (optional)"
              disabled={content.requiresProfessionalReview}
              value={minCalories}
              onChangeText={setMinCalories}
              min={1200}
              max={5000}
              step={50}
              optional
            />
            <Numeric
              label="Daily calorie range maximum (optional)"
              disabled={content.requiresProfessionalReview}
              value={maxCalories}
              onChangeText={setMaxCalories}
              min={1200}
              max={5000}
              step={50}
              optional
            />
          </FitnessDisclosure>
          {content.requiresProfessionalReview && (
            <FitnessNotice message="Clinical review is required. Numeric nutrition targets and exercise prescriptions remain unavailable; general guidance can still be revised." />
          )}
          <FitnessDisclosure
            title="Nutrient & water targets"
            subtitle="Optional expert ranges · saved estimates remain separate"
          >
            <FitnessText muted>
              Set both limits to save an expert range. Clear both to return to
              the saved estimate.
            </FitnessText>
            {TARGETS.map(target => {
              const baseline = content.requiresProfessionalReview
                ? undefined
                : content.baselineTargets?.[target.key];
              const bounds =
                target.key === 'waterMl'
                  ? [500, 5000]
                  : [
                      0,
                      { proteinG: 250, carbsG: 800, fatG: 200, fibreG: 70 }[
                        target.key
                      ],
                    ];
              return (
                <FitnessDisclosure
                  key={target.key}
                  title={target.label}
                  subtitle={`Saved baseline: ${rangeLabel(
                    baseline,
                    target.unit,
                  )} · ${
                    targets[target.key].min && targets[target.key].max
                      ? 'Expert range set'
                      : 'No expert range'
                  }`}
                >
                  <Numeric
                    label={`${target.label} minimum (${target.unit})`}
                    disabled={content.requiresProfessionalReview}
                    value={targets[target.key].min}
                    min={bounds[0]}
                    max={bounds[1]}
                    step={target.key === 'waterMl' ? 100 : 5}
                    optional
                    onChangeText={value =>
                      setTargets(current => ({
                        ...current,
                        [target.key]: { ...current[target.key], min: value },
                      }))
                    }
                  />
                  <Numeric
                    label={`${target.label} maximum (${target.unit})`}
                    disabled={content.requiresProfessionalReview}
                    value={targets[target.key].max}
                    min={bounds[0]}
                    max={bounds[1]}
                    step={target.key === 'waterMl' ? 100 : 5}
                    optional
                    onChangeText={value =>
                      setTargets(current => ({
                        ...current,
                        [target.key]: { ...current[target.key], max: value },
                      }))
                    }
                  />
                </FitnessDisclosure>
              );
            })}
          </FitnessDisclosure>
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
          <Numeric
            label="Duration in minutes"
            value={current.durationMinutes}
            min={1}
            max={180}
            step={5}
            onChangeText={value =>
              updateDay(workout => ({ ...workout, durationMinutes: value }))
            }
          />
          <FitnessText muted>
            {current.exercises.length} exercises · Other days stay in your
            draft.
          </FitnessText>
          {current.exercises.map((exercise, index) => (
            <FitnessDisclosure
              key={`${day}-${index}`}
              title={`Exercise ${index + 1} · ${
                exercise.name || 'New exercise'
              }`}
              subtitle={`${exercise.sets || '—'} sets${
                exercise.reps ? ` × ${exercise.reps}` : ''
              }${
                exercise.durationSeconds
                  ? ` · ${exercise.durationSeconds}s`
                  : ''
              }`}
              defaultOpen={index === 0 || !exercise.name}
            >
              <FitnessField
                label={`Exercise ${index + 1} name`}
                value={exercise.name}
                onChangeText={value => updateExercise(index, { name: value })}
                maxLength={150}
              />
              <Numeric
                label={`Exercise ${index + 1} sets`}
                value={exercise.sets}
                min={1}
                max={20}
                onChangeText={value => updateExercise(index, { sets: value })}
              />
              <Numeric
                label={`Exercise ${index + 1} reps per set (optional)`}
                value={exercise.reps}
                min={1}
                max={100}
                optional
                onChangeText={value => updateExercise(index, { reps: value })}
              />
              <FitnessDisclosure
                title={`Exercise ${index + 1} timing & coaching`}
                subtitle="Duration, rest, instructions and alternatives"
              >
                <Numeric
                  label={`Exercise ${index + 1} duration seconds (optional)`}
                  value={exercise.durationSeconds}
                  min={1}
                  max={7200}
                  step={15}
                  optional
                  onChangeText={value =>
                    updateExercise(index, { durationSeconds: value })
                  }
                />
                <Numeric
                  label={`Exercise ${index + 1} rest seconds (optional)`}
                  value={exercise.restSeconds}
                  min={0}
                  max={600}
                  step={15}
                  optional
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
                  onChangeText={value =>
                    updateExercise(index, { notes: value })
                  }
                  maxLength={1000}
                />
                {exercise.mediaId && (
                  <>
                    <FitnessText muted>
                      An existing private media reference stays attached.
                      Viewing it still requires the client's separate media
                      permission.
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
              </FitnessDisclosure>
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
            </FitnessDisclosure>
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
          <Numeric
            label={`Daily ${habit} target (${
              habit === 'water' ? 'ml' : habit === 'steps' ? 'steps' : 'hours'
            })`}
            value={habitTarget}
            onChangeText={setHabitTarget}
            min={habit === 'sleep' ? 4 : habit === 'water' ? 500 : 0}
            max={habit === 'water' ? 5000 : habit === 'steps' ? 30000 : 12}
            step={habit === 'water' ? 250 : habit === 'steps' ? 500 : 0.5}
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
