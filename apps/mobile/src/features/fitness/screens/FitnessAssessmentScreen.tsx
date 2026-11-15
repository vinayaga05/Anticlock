import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import {
  Activity,
  Armchair,
  Beef,
  Dumbbell,
  Egg,
  Flame,
  Leaf,
  MoreHorizontal,
  PersonStanding,
  Scale,
  Sprout,
} from 'lucide-react-native';
import type { FitnessAssessment, FitnessProfile } from '@anticlock/contracts';
import { useFitnessMutation } from '../api/fitnessApi';
import { fitnessAge, localFitnessDate, numberLabel } from '../fitnessModel';
import {
  FitnessAction,
  FitnessCard,
  FitnessChoices,
  FitnessField,
  FitnessLoading,
  FitnessNotice,
  FitnessScreen,
  FitnessSection,
  FitnessText,
  useFitnessColors,
} from '../components/FitnessUI';
import {
  FitnessChoiceCards,
  FitnessDatePicker,
  FitnessDayPicker,
  FitnessDisclosure,
  FitnessStepper,
  FitnessToggle,
} from '../components/FitnessControls';
import {
  FitnessIllustration,
  FitnessPhoto,
} from '../components/FitnessVisuals';
import {
  ASSESSMENT_STEPS,
  FOOD_OPTIONS,
  POUNDS_PER_KG,
  PRIMARY_GOALS,
  assessmentStepError,
  assessmentsEqual,
  formatHeightInches,
  humanAssessmentValue,
  replaceKnownChoices,
  selectedKnownChoices,
  setWorkoutLocation,
  workoutLocation,
} from '../onboarding/assessmentModel';
import { useAssessmentDraft } from '../onboarding/useAssessmentDraft';

const GOAL_ICONS = [Scale, Dumbbell, Activity, Flame, PersonStanding, Leaf];
const ALLERGIES = [
  'Peanuts',
  'Tree nuts',
  'Milk',
  'Eggs',
  'Gluten',
  'Soy',
  'Shellfish',
];
const RESTRICTIONS = ['Dairy free', 'Gluten free', 'No pork', 'No beef'];
const MOVEMENTS = [
  'walking',
  'strength',
  'cycling',
  'yoga',
  'swimming',
  'running',
  'dance',
];
const EQUIPMENT = [
  'bodyweight',
  'dumbbells',
  'resistance_bands',
  'gym',
  'bike',
];
const TIME_LABELS = ['Morning', 'Afternoon', 'Evening'];
const STEP_HELP = [
  'Choose what feels right for you.',
  'A starting point, just for you.',
  'Make movement fit your week.',
  'Keep what works for you.',
  'A plan shaped around your choices.',
];
const BODY_TYPES = [
  { value: 'lean', label: 'Lean', kind: 'body-lean' },
  { value: 'athletic', label: 'Athletic', kind: 'body-athletic' },
  { value: 'broad', label: 'Broad', kind: 'body-broad' },
] as const;
const MAIN_GOALS: readonly string[] = PRIMARY_GOALS.map(goal => goal.value);

export function FitnessAssessmentScreen() {
  const nav = useNavigation<any>();
  const colors = useFitnessColors();
  const mutation = useFitnessMutation<{ profile?: FitnessProfile }>();
  const state = useAssessmentDraft();
  const { draft, saver } = state;
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [textDrafts, setTextDrafts] = useState<Record<string, string>>({});
  const mounted = useRef(true);
  const operation = useRef(false);
  const allowExit = useRef(false);
  const exitOperation = useRef(false);
  const advancing = useRef(false);
  const liveOwner = useRef(state.ownerKey);
  liveOwner.current = state.ownerKey;
  const initialAnswers = useRef<FitnessAssessment | null>(null);
  if (state.ready && !initialAnswers.current) initialAnswers.current = draft;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    setStep(0);
    setError(null);
    setCreating(false);
    setLeaving(false);
    setTextDrafts({});
    initialAnswers.current = null;
    operation.current = false;
    exitOperation.current = false;
    advancing.current = false;
    allowExit.current = false;
  }, [state.ownerKey]);
  useEffect(() => {
    advancing.current = false;
  }, [step]);

  const put = <K extends keyof FitnessAssessment>(
    key: K,
    value: FitnessAssessment[K],
  ) => {
    if (operation.current || liveOwner.current !== state.ownerKey) return;
    setError(null);
    saver.update(key, value);
  };
  const imperial = draft.units === 'imperial';
  const minimumBirthDate = new Date();
  minimumBirthDate.setFullYear(minimumBirthDate.getFullYear() - 120);
  const savedExtraGoals = (initialAnswers.current?.goals ?? []).filter(
    goal => !MAIN_GOALS.includes(goal),
  );
  const savedExtraFoods = (
    initialAnswers.current?.foodPreferences ?? []
  ).filter(value => !(FOOD_OPTIONS as readonly string[]).includes(value));
  const preferredTime = draft.preferredTimes?.find(value =>
    /^\d{2}:\d{2}$/.test(value),
  );
  const currentBaseline =
    state.serverProfile?.status === 'complete' &&
    assessmentsEqual(state.serverProfile.assessment, draft)
      ? state.serverProfile.baseline
      : null;
  const optionalText = (
    key:
      | 'injuries'
      | 'mobility'
      | 'medicalConditions'
      | 'medications'
      | 'routine'
      | 'bodyDescription',
    label: string,
  ) => (
    <FitnessField
      key={key}
      label={label}
      value={draft[key] ?? ''}
      onChangeText={value => put(key, value === '' ? undefined : value)}
      multiline
      maxLength={3000}
    />
  );
  const customList = (
    key: 'allergies' | 'restrictions',
    label: string,
    common: string[],
  ) => {
    const custom = (draft[key] ?? []).filter(
      value => !common.some(item => item.toLowerCase() === value.toLowerCase()),
    );
    return (
      <FitnessField
        label={label}
        value={textDrafts[key] ?? custom.join(', ')}
        maxLength={1500}
        onChangeText={value => {
          setTextDrafts(text => ({ ...text, [key]: value }));
          put(key, [
            ...selectedKnownChoices(draft[key], common),
            ...value
              .split(',')
              .map(item => item.trim())
              .filter(Boolean),
          ]);
        }}
      />
    );
  };
  async function flushSafely() {
    const expectedOwner = state.ownerKey;
    try {
      await saver.flush();
      return liveOwner.current === expectedOwner;
    } catch (problem) {
      if (mounted.current && liveOwner.current === expectedOwner)
        setError((problem as Error).message);
      return false;
    }
  }
  usePreventRemove(
    !allowExit.current && (creating || leaving || state.dirty),
    ({ data }) => {
      if (allowExit.current) {
        nav.dispatch(data.action);
        return;
      }
      if (operation.current || exitOperation.current) return;
      const expectedOwner = state.ownerKey;
      exitOperation.current = true;
      setLeaving(true);
      void flushSafely().then(saved => {
        if (!mounted.current || liveOwner.current !== expectedOwner) return;
        exitOperation.current = false;
        setLeaving(false);
        if (saved) {
          allowExit.current = true;
          nav.dispatch(data.action);
        }
      });
    },
  );
  async function goBack() {
    if (operation.current || exitOperation.current) return;
    if (step > 0) {
      setStep(value => value - 1);
      setError(null);
      return;
    }
    if (!state.ready) {
      allowExit.current = true;
      if (nav.canGoBack()) nav.goBack();
      else nav.navigate('FitnessHome');
      return;
    }
    const expectedOwner = state.ownerKey;
    exitOperation.current = true;
    setLeaving(true);
    const saved = await flushSafely();
    if (!mounted.current || liveOwner.current !== expectedOwner) return;
    exitOperation.current = false;
    setLeaving(false);
    if (saved) {
      allowExit.current = true;
      if (nav.canGoBack()) nav.goBack();
      else nav.navigate('FitnessHome');
    }
  }
  async function next() {
    if (operation.current || advancing.current || !state.ready) return;
    const invalid = assessmentStepError(step, draft);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    if (step < 4) {
      advancing.current = true;
      setStep(value => value + 1);
      return;
    }
    for (let index = 0; index < 4; index++) {
      const missing = assessmentStepError(index, draft);
      if (missing) {
        setStep(index);
        setError(missing);
        return;
      }
    }
    const expectedOwner = state.ownerKey;
    const currentOwner = () =>
      mounted.current && liveOwner.current === expectedOwner;
    operation.current = true;
    setCreating(true);
    try {
      if (draft.equipment === undefined) saver.update('equipment', []);
      await saver.flush();
      if (!currentOwner()) return;
      await mutation.mutateAsync({ path: '/profile/complete', body: {} });
      if (!currentOwner()) return;
      await mutation.mutateAsync({ path: '/plans/generate', body: {} });
      if (currentOwner()) {
        allowExit.current = true;
        nav.replace('FitnessHome');
      }
    } catch (problem) {
      if (currentOwner()) setError((problem as Error).message);
    } finally {
      if (currentOwner()) {
        operation.current = false;
        setCreating(false);
      }
    }
  }
  const status =
    state.status === 'saving'
      ? 'Saving privately…'
      : state.status === 'error'
      ? 'Answers kept here. Retry when ready.'
      : state.status === 'waiting'
      ? 'Changes save automatically'
      : 'Saved privately';
  const footer = (
    <View style={{ gap: 8 }}>
      <FitnessNotice error message={error ?? state.error} />
      {state.status === 'error' && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry saving answers"
          onPress={() => {
            void flushSafely();
          }}
          style={styles.textAction}
        >
          <Text style={{ color: colors.accent, fontWeight: '600' }}>
            Retry saving
          </Text>
        </Pressable>
      )}
      <FitnessAction
        label={step === 4 ? 'Create My Plan' : 'Continue'}
        onPress={() => {
          void next();
        }}
        busy={creating || leaving}
        disabled={!state.ready}
      />
      <Text
        accessibilityLiveRegion="polite"
        style={{ textAlign: 'center', color: colors.muted, fontSize: 12 }}
      >
        {state.ready ? status : 'Loading your saved answers…'}
      </Text>
    </View>
  );

  return (
    <FitnessScreen
      title={ASSESSMENT_STEPS[step]}
      subtitle={STEP_HELP[step]}
      footer={footer}
      onBack={() => {
        void goBack();
      }}
      busy={creating || leaving}
    >
      {!state.ready ? (
        state.loadError ? (
          <FitnessCard>
            <FitnessNotice error message={state.loadError} />
            <FitnessAction
              label="Retry loading your answers"
              onPress={state.retryLoad}
            />
          </FitnessCard>
        ) : (
          <FitnessLoading />
        )
      ) : (
        <>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel={`Step ${step + 1} of 5`}
            accessibilityValue={{ min: 1, max: 5, now: step + 1 }}
            style={styles.progress}
          >
            {ASSESSMENT_STEPS.map((name, index) => (
              <View
                key={name}
                style={{
                  height: 4,
                  borderRadius: 4,
                  flex: 1,
                  backgroundColor: index <= step ? colors.accent : colors.line,
                }}
              />
            ))}
          </View>
          {step === 0 && (
            <>
              <FitnessPhoto kind="outdoor" style={{ height: 110 }} />
              <FitnessChoiceCards
                options={PRIMARY_GOALS.map((goal, index) => ({
                  ...goal,
                  icon: GOAL_ICONS[index],
                }))}
                value={(draft.goals ?? []).filter(goal =>
                  MAIN_GOALS.includes(goal),
                )}
                multiple
                onChange={values =>
                  put(
                    'goals',
                    replaceKnownChoices(
                      draft.goals,
                      MAIN_GOALS,
                      values,
                    ) as FitnessAssessment['goals'],
                  )
                }
              />
              {!!savedExtraGoals.length && (
                <FitnessDisclosure
                  title="Other saved goals"
                  defaultOpen={
                    !(draft.goals ?? []).some(goal => MAIN_GOALS.includes(goal))
                  }
                >
                  <FitnessChoices
                    label="Keep the goals that still fit"
                    options={savedExtraGoals.map(humanAssessmentValue)}
                    selected={(draft.goals ?? [])
                      .filter(goal => savedExtraGoals.includes(goal))
                      .map(humanAssessmentValue)}
                    multiple
                    onChange={(labels: string[]) =>
                      put('goals', [
                        ...(draft.goals ?? []).filter(
                          goal => !savedExtraGoals.includes(goal),
                        ),
                        ...savedExtraGoals.filter(goal =>
                          labels.includes(humanAssessmentValue(goal)),
                        ),
                      ])
                    }
                  />
                </FitnessDisclosure>
              )}
              <FitnessDisclosure
                title="A target, if you have one"
                subtitle="Optional"
              >
                <FitnessStepper
                  label="Target weight"
                  initialValue={imperial ? 154 : 70}
                  value={
                    draft.targetWeightKg === undefined
                      ? undefined
                      : draft.targetWeightKg * (imperial ? POUNDS_PER_KG : 1)
                  }
                  onChange={value =>
                    put(
                      'targetWeightKg',
                      value / (imperial ? POUNDS_PER_KG : 1),
                    )
                  }
                  min={15 * (imperial ? POUNDS_PER_KG : 1)}
                  max={500 * (imperial ? POUNDS_PER_KG : 1)}
                  step={imperial ? 1 : 0.5}
                  unit={imperial ? 'lb' : 'kg'}
                />
                {draft.targetWeightKg !== undefined && (
                  <FitnessAction
                    label="Clear target weight"
                    secondary
                    onPress={() => put('targetWeightKg', undefined)}
                  />
                )}
                <FitnessDatePicker
                  label="Target date (optional)"
                  value={draft.targetDate}
                  onChange={value => put('targetDate', value)}
                  minimumDate={localFitnessDate()}
                />
                {draft.targetDate && (
                  <FitnessAction
                    label="Clear target date"
                    secondary
                    onPress={() => put('targetDate', undefined)}
                  />
                )}
              </FitnessDisclosure>
            </>
          )}
          {step === 1 && (
            <>
              <FitnessDatePicker
                label="Date of birth"
                value={draft.dateOfBirth}
                onChange={value => put('dateOfBirth', value)}
                minimumDate={minimumBirthDate}
                maximumDate={new Date()}
              />
              {fitnessAge(draft.dateOfBirth) !== null && (
                <FitnessText muted>
                  {fitnessAge(draft.dateOfBirth)} years
                </FitnessText>
              )}
              <FitnessChoices
                label="Units"
                options={['cm / kg', 'ft-in / lb']}
                selected={imperial ? 'ft-in / lb' : 'cm / kg'}
                onChange={value =>
                  put('units', value === 'ft-in / lb' ? 'imperial' : 'metric')
                }
              />
              <FitnessStepper
                label="Height"
                initialValue={imperial ? 67 : 170}
                value={
                  draft.heightCm === undefined
                    ? undefined
                    : draft.heightCm / (imperial ? 2.54 : 1)
                }
                min={50 / (imperial ? 2.54 : 1)}
                max={260 / (imperial ? 2.54 : 1)}
                step={imperial ? 0.5 : 1}
                unit={imperial ? undefined : 'cm'}
                formatValue={imperial ? formatHeightInches : undefined}
                onChange={value =>
                  put('heightCm', value * (imperial ? 2.54 : 1))
                }
              />
              <FitnessStepper
                label="Current weight"
                initialValue={imperial ? 154 : 70}
                value={
                  draft.weightKg === undefined
                    ? undefined
                    : draft.weightKg * (imperial ? POUNDS_PER_KG : 1)
                }
                min={15 * (imperial ? POUNDS_PER_KG : 1)}
                max={500 * (imperial ? POUNDS_PER_KG : 1)}
                step={imperial ? 1 : 0.5}
                unit={imperial ? 'lb' : 'kg'}
                onChange={value =>
                  put('weightKg', value / (imperial ? POUNDS_PER_KG : 1))
                }
              />
              <FitnessDisclosure title="Gender & body type" subtitle="Optional">
                <FitnessChoices
                  label="Gender"
                  options={['Woman', 'Man', 'Non-binary', 'Prefer not to say']}
                  selected={
                    draft.gender === undefined
                      ? 'Prefer not to say'
                      : /^(woman|female)$/i.test(draft.gender)
                      ? 'Woman'
                      : /^(man|male)$/i.test(draft.gender)
                      ? 'Man'
                      : /^non.?binary$/i.test(draft.gender)
                      ? 'Non-binary'
                      : draft.gender
                  }
                  onChange={value =>
                    put(
                      'gender',
                      value === 'Prefer not to say' ? undefined : value,
                    )
                  }
                />
                {draft.gender &&
                  !/^(woman|female|man|male|non.?binary)$/i.test(
                    draft.gender,
                  ) && <FitnessText muted>Saved: {draft.gender}</FitnessText>}
                <FitnessSection
                  title="Body type"
                  caption="Choose only if it feels useful."
                />
                <View style={styles.bodies}>
                  {BODY_TYPES.map(body => (
                    <Pressable
                      key={body.value}
                      accessibilityRole="radio"
                      accessibilityLabel={`${body.label} body type`}
                      accessibilityState={{
                        checked: draft.bodyDescription === body.value,
                        disabled: creating || leaving,
                      }}
                      disabled={creating || leaving}
                      onPress={() =>
                        put(
                          'bodyDescription',
                          draft.bodyDescription === body.value
                            ? undefined
                            : body.value,
                        )
                      }
                      style={[
                        styles.bodyChoice,
                        {
                          borderColor:
                            draft.bodyDescription === body.value
                              ? colors.accent
                              : colors.line,
                          backgroundColor:
                            draft.bodyDescription === body.value
                              ? colors.soft
                              : colors.surface,
                        },
                      ]}
                    >
                      <FitnessIllustration kind={body.kind} size={64} />
                      <FitnessText>{body.label}</FitnessText>
                    </Pressable>
                  ))}
                </View>
                {draft.bodyDescription && (
                  <FitnessAction
                    label="Skip body type"
                    secondary
                    onPress={() => put('bodyDescription', undefined)}
                  />
                )}
                <FitnessDisclosure title="More body details">
                  {optionalText(
                    'bodyDescription',
                    'Your own description (optional)',
                  )}
                  <FitnessChoices
                    label="Estimate preference (optional)"
                    options={[
                      'Use a range',
                      'Female physiology',
                      'Male physiology',
                    ]}
                    selected={
                      draft.calculationSex === 'female'
                        ? 'Female physiology'
                        : draft.calculationSex === 'male'
                        ? 'Male physiology'
                        : 'Use a range'
                    }
                    onChange={value =>
                      put(
                        'calculationSex',
                        value === 'Female physiology'
                          ? 'female'
                          : value === 'Male physiology'
                          ? 'male'
                          : 'unspecified',
                      )
                    }
                  />
                  <FitnessText muted>
                    Separate from gender. You can leave this as a range.
                  </FitnessText>
                </FitnessDisclosure>
              </FitnessDisclosure>
            </>
          )}
          {step === 2 && (
            <>
              <FitnessSection title="Usual activity" />
              <FitnessChoiceCards
                options={[
                  {
                    value: 'sedentary',
                    label: 'Mostly sitting',
                    icon: Armchair,
                  },
                  {
                    value: 'light',
                    label: 'Lightly active',
                    icon: PersonStanding,
                  },
                  { value: 'active', label: 'Active', icon: Activity },
                  { value: 'very_active', label: 'Very active', icon: Flame },
                ]}
                value={
                  draft.activityLevel
                    ? [
                        draft.activityLevel === 'moderate'
                          ? 'active'
                          : draft.activityLevel,
                      ]
                    : []
                }
                onChange={values =>
                  put(
                    'activityLevel',
                    values[0] as FitnessAssessment['activityLevel'],
                  )
                }
              />
              <FitnessChoices
                label="Fitness experience"
                options={['Beginner', 'Intermediate', 'Advanced']}
                selected={
                  draft.experience ? humanAssessmentValue(draft.experience) : ''
                }
                onChange={value =>
                  put(
                    'experience',
                    value.toLowerCase() as FitnessAssessment['experience'],
                  )
                }
              />
              <FitnessChoices
                label="Workout location"
                options={['Home', 'Gym', 'Outdoor', 'Any']}
                selected={
                  workoutLocation(draft.exercisePreferences)
                    ? humanAssessmentValue(
                        workoutLocation(draft.exercisePreferences)!,
                      )
                    : ''
                }
                onChange={value =>
                  put(
                    'exercisePreferences',
                    setWorkoutLocation(
                      draft.exercisePreferences,
                      value.toLowerCase(),
                    ),
                  )
                }
              />
              <FitnessSection title="Days that work" />
              <FitnessDayPicker
                value={draft.availableDays ?? []}
                onChange={value => put('availableDays', value)}
              />
              <FitnessChoices
                label="Session length"
                options={[
                  '15 min',
                  '30 min',
                  '45 min',
                  '60+ min',
                  ...(draft.sessionMinutes !== undefined &&
                  ![15, 30, 45, 60].includes(draft.sessionMinutes)
                    ? [`${draft.sessionMinutes} min`]
                    : []),
                ]}
                selected={
                  draft.sessionMinutes === 60
                    ? '60+ min'
                    : draft.sessionMinutes
                    ? `${draft.sessionMinutes} min`
                    : ''
                }
                onChange={value =>
                  put('sessionMinutes', Number.parseInt(value, 10))
                }
              />
              <FitnessDisclosure
                title="More about your routine"
                subtitle="Optional"
              >
                <FitnessChoices
                  label="Movement you enjoy"
                  options={MOVEMENTS}
                  selected={selectedKnownChoices(
                    draft.exercisePreferences,
                    MOVEMENTS,
                  )}
                  multiple
                  onChange={(values: string[]) =>
                    put(
                      'exercisePreferences',
                      replaceKnownChoices(
                        draft.exercisePreferences,
                        MOVEMENTS,
                        values,
                      ),
                    )
                  }
                />
                <FitnessChoices
                  label="Equipment available"
                  options={EQUIPMENT}
                  selected={selectedKnownChoices(draft.equipment, EQUIPMENT)}
                  multiple
                  onChange={(values: string[]) =>
                    put(
                      'equipment',
                      replaceKnownChoices(draft.equipment, EQUIPMENT, values),
                    )
                  }
                />
                <FitnessChoices
                  label="Preferred part of the day"
                  options={TIME_LABELS}
                  selected={selectedKnownChoices(
                    draft.preferredTimes,
                    TIME_LABELS,
                  )}
                  multiple
                  onChange={(values: string[]) =>
                    put(
                      'preferredTimes',
                      replaceKnownChoices(
                        draft.preferredTimes,
                        TIME_LABELS,
                        values,
                      ),
                    )
                  }
                />
                <FitnessDatePicker
                  label="Preferred time"
                  mode="time"
                  value={preferredTime}
                  onChange={value =>
                    put('preferredTimes', [
                      ...new Set([
                        ...(draft.preferredTimes ?? []).filter(
                          time => time !== preferredTime,
                        ),
                        value,
                      ]),
                    ])
                  }
                />
                {preferredTime && (
                  <FitnessAction
                    label="Clear preferred time"
                    secondary
                    onPress={() =>
                      put(
                        'preferredTimes',
                        draft.preferredTimes?.filter(
                          time => time !== preferredTime,
                        ),
                      )
                    }
                  />
                )}
                <FitnessStepper
                  label="Sleep"
                  initialValue={7}
                  unit="hours"
                  value={draft.sleepHours}
                  min={0}
                  max={24}
                  step={0.5}
                  onChange={value => put('sleepHours', value)}
                />
                {draft.sleepHours !== undefined && (
                  <FitnessAction
                    label="Skip sleep detail"
                    secondary
                    onPress={() => put('sleepHours', undefined)}
                  />
                )}
                <FitnessStepper
                  label="Usual water"
                  initialValue={2000}
                  unit="ml / day"
                  value={draft.waterMl}
                  min={0}
                  max={15000}
                  step={250}
                  onChange={value => put('waterMl', value)}
                />
                {draft.waterMl !== undefined && (
                  <FitnessAction
                    label="Skip water detail"
                    secondary
                    onPress={() => put('waterMl', undefined)}
                  />
                )}
                <FitnessChoices
                  label="Typical stress"
                  options={['Low', 'Moderate', 'High', 'Prefer not to say']}
                  selected={
                    draft.stressLevel
                      ? draft.stressLevel.charAt(0).toUpperCase() +
                        draft.stressLevel.slice(1)
                      : 'Prefer not to say'
                  }
                  onChange={value =>
                    put(
                      'stressLevel',
                      value === 'Prefer not to say'
                        ? undefined
                        : (value.toLowerCase() as FitnessAssessment['stressLevel']),
                    )
                  }
                />
                {optionalText('routine', 'Anything else about your routine?')}
              </FitnessDisclosure>
            </>
          )}
          {step === 3 && (
            <>
              <FitnessPhoto kind="food" style={{ height: 110 }} />
              <FitnessChoiceCards
                options={[
                  { value: 'vegetarian', label: 'Vegetarian', icon: Sprout },
                  { value: 'vegan', label: 'Vegan', icon: Leaf },
                  { value: 'eggetarian', label: 'Eggetarian', icon: Egg },
                  {
                    value: 'non_vegetarian',
                    label: 'Non-vegetarian',
                    icon: Beef,
                  },
                  { value: 'other', label: 'Other', icon: MoreHorizontal },
                ]}
                value={(draft.foodPreferences ?? []).filter(value =>
                  (FOOD_OPTIONS as readonly string[]).includes(value),
                )}
                onChange={values =>
                  put(
                    'foodPreferences',
                    replaceKnownChoices(
                      draft.foodPreferences,
                      FOOD_OPTIONS,
                      values,
                    ),
                  )
                }
              />
              {!!savedExtraFoods.length && (
                <FitnessDisclosure
                  title="Other saved preferences"
                  defaultOpen={
                    !(draft.foodPreferences ?? []).some(value =>
                      (FOOD_OPTIONS as readonly string[]).includes(value),
                    )
                  }
                >
                  <FitnessChoices
                    label="Keep any that still apply"
                    options={savedExtraFoods.map(humanAssessmentValue)}
                    selected={(draft.foodPreferences ?? [])
                      .filter(value => savedExtraFoods.includes(value))
                      .map(humanAssessmentValue)}
                    multiple
                    onChange={(values: string[]) =>
                      put('foodPreferences', [
                        ...(draft.foodPreferences ?? []).filter(
                          value => !savedExtraFoods.includes(value),
                        ),
                        ...savedExtraFoods.filter(value =>
                          values.includes(humanAssessmentValue(value)),
                        ),
                      ])
                    }
                  />
                </FitnessDisclosure>
              )}
              <FitnessDisclosure
                title="Anything we should consider?"
                subtitle="Optional · stays private"
              >
                <FitnessChoices
                  label="Food allergies"
                  options={ALLERGIES}
                  selected={selectedKnownChoices(draft.allergies, ALLERGIES)}
                  multiple
                  onChange={(values: string[]) =>
                    put(
                      'allergies',
                      replaceKnownChoices(draft.allergies, ALLERGIES, values),
                    )
                  }
                />
                {customList('allergies', 'Other allergies', ALLERGIES)}
                <FitnessChoices
                  label="Food restrictions"
                  options={RESTRICTIONS}
                  selected={selectedKnownChoices(
                    draft.restrictions,
                    RESTRICTIONS,
                  )}
                  multiple
                  onChange={(values: string[]) =>
                    put(
                      'restrictions',
                      replaceKnownChoices(
                        draft.restrictions,
                        RESTRICTIONS,
                        values,
                      ),
                    )
                  }
                />
                {customList('restrictions', 'Other restrictions', RESTRICTIONS)}
                <FitnessDisclosure
                  title="Injury or health concerns"
                  subtitle="Share only what you want to save privately"
                >
                  {optionalText('injuries', 'Injury note')}
                  {optionalText('mobility', 'Mobility considerations')}
                  {optionalText('medicalConditions', 'Health concerns')}
                  {optionalText('medications', 'Medications')}
                  {(
                    [
                      'pregnant',
                      'breastfeeding',
                      'eatingDisorderRisk',
                      'clinicalReviewRequired',
                    ] as const
                  ).map((key, index) => (
                    <FitnessChoices
                      key={key}
                      label={
                        [
                          'Pregnancy or postpartum',
                          'Breastfeeding',
                          'Eating or weight concerns',
                          'Professional review requested',
                        ][index]
                      }
                      options={['Prefer not to say', 'Yes', 'No']}
                      selected={
                        draft[key] === undefined
                          ? 'Prefer not to say'
                          : draft[key]
                          ? 'Yes'
                          : 'No'
                      }
                      onChange={value =>
                        put(
                          key,
                          value === 'Prefer not to say'
                            ? undefined
                            : value === 'Yes',
                        )
                      }
                    />
                  ))}
                </FitnessDisclosure>
              </FitnessDisclosure>
            </>
          )}
          {step === 4 && (
            <>
              <FitnessCard tone="soft">
                <FitnessSection title="A little more you" />
                <FitnessText>
                  {(draft.goals ?? []).map(humanAssessmentValue).join(' · ')}
                </FitnessText>
                <FitnessText>
                  {numberLabel(
                    draft.weightKg === undefined
                      ? null
                      : draft.weightKg * (imperial ? POUNDS_PER_KG : 1),
                    imperial ? ' lb' : ' kg',
                  )}{' '}
                  now
                  {draft.targetWeightKg === undefined
                    ? ''
                    : ` · ${numberLabel(
                        draft.targetWeightKg * (imperial ? POUNDS_PER_KG : 1),
                        imperial ? ' lb' : ' kg',
                      )} chosen target`}
                </FitnessText>
                <FitnessText>
                  {(draft.availableDays ?? [])
                    .slice()
                    .sort()
                    .map(
                      day =>
                        ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day],
                    )
                    .join(' · ')}
                  {draft.sessionMinutes ? ` · ${draft.sessionMinutes} min` : ''}
                </FitnessText>
                <FitnessText>
                  {(draft.foodPreferences ?? [])
                    .map(humanAssessmentValue)
                    .join(' · ')}
                </FitnessText>
              </FitnessCard>
              {currentBaseline ? (
                <FitnessCard>
                  <FitnessSection title="Your saved daily estimates" />
                  {currentBaseline.requiresProfessionalReview ? (
                    <FitnessText muted>
                      Your targets need appropriate professional review.
                    </FitnessText>
                  ) : (
                    <>
                      {currentBaseline.calories ? (
                        <FitnessText>
                          Energy · {numberLabel(currentBaseline.calories.min)}–
                          {numberLabel(currentBaseline.calories.max)} kcal
                        </FitnessText>
                      ) : (
                        <FitnessText muted>
                          Energy targets are held for professional review.
                        </FitnessText>
                      )}
                      {currentBaseline.proteinG && (
                        <FitnessText>
                          Protein · {numberLabel(currentBaseline.proteinG.min)}–
                          {numberLabel(currentBaseline.proteinG.max)} g
                        </FitnessText>
                      )}
                      {currentBaseline.waterMl !== null && (
                        <FitnessText>
                          Water · {numberLabel(currentBaseline.waterMl)} ml
                        </FitnessText>
                      )}
                      <FitnessText muted>
                        Estimates, not measurements.
                      </FitnessText>
                    </>
                  )}
                </FitnessCard>
              ) : (
                <FitnessCard>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 16,
                    }}
                  >
                    <FitnessIllustration kind="welcome" size={72} />
                    <View style={{ flex: 1 }}>
                      <FitnessText>
                        Your daily targets are personalized after review.
                      </FitnessText>
                    </View>
                  </View>
                </FitnessCard>
              )}
              <FitnessDisclosure title="Wellness guidance">
                <FitnessText>
                  For everyday wellbeing, not diagnosis or emergency care. Get
                  qualified advice for health conditions, pregnancy, injuries,
                  rehabilitation or eating concerns. Automatic targets may be
                  held for professional review.
                </FitnessText>
                <FitnessText muted>
                  For severe or urgent symptoms, contact emergency care.
                </FitnessText>
              </FitnessDisclosure>
              <FitnessToggle
                label="I’ve read the wellness guidance"
                value={Boolean(draft.disclaimerAccepted)}
                onChange={value => put('disclaimerAccepted', value)}
              />
            </>
          )}
        </>
      )}
    </FitnessScreen>
  );
}
const styles = StyleSheet.create({
  progress: { flexDirection: 'row', gap: 6, marginBottom: 2 },
  textAction: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  bodies: { flexDirection: 'row', gap: 8 },
  bodyChoice: {
    flex: 1,
    minWidth: 0,
    minHeight: 116,
    alignItems: 'center',
    gap: 4,
    padding: 8,
    borderRadius: 18,
    borderWidth: 1,
  },
});
