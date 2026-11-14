import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { FitnessAssessment, FitnessProfile } from '@anticlock/contracts';
import { useFitnessMutation, useFitnessQuery } from '../api/fitnessApi';
import {
  assessmentMissing,
  fitnessAge,
  fitnessTimezone,
} from '../fitnessModel';
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
} from '../components/FitnessUI';

const steps = [
  'Your starting point',
  'What matters to you',
  'Movement that fits',
  'Food & preferences',
  'Private health context',
  'Your everyday rhythm',
  'Review & begin',
];
const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function FitnessAssessmentScreen() {
  const nav = useNavigation<any>();
  const profile = useFitnessQuery<{ profile: FitnessProfile | null }>(
    '/profile',
  );
  const save = useFitnessMutation<any>();
  const hydrated = useRef(false);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<FitnessAssessment>({
    units: 'metric',
    calculationSex: 'unspecified',
    equipment: [],
    timezone: fitnessTimezone(),
  });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [numericText, setNumericText] = useState<Record<string, string>>({});
  const [listText, setListText] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!hydrated.current && profile.isSuccess) {
      if (profile.data.profile) setDraft(profile.data.profile.assessment);
      hydrated.current = true;
    }
  }, [profile.data, profile.isSuccess]);
  const put = <K extends keyof FitnessAssessment>(
    key: K,
    value: FitnessAssessment[K],
  ) => {
    setDraft(old => ({ ...old, [key]: value }));
    setSaved('');
  };
  const field = (
    key: keyof FitnessAssessment,
    label: string,
    numeric = false,
    hint?: string,
  ) => (
    <FitnessField
      key={key}
      label={
        key === 'targetWeightKg' && draft.units === 'imperial'
          ? 'Target weight (lb, optional)'
          : label
      }
      value={
        numeric
          ? numericText[key] ??
            (draft[key] === undefined
              ? ''
              : String(
                  key === 'targetWeightKg' && draft.units === 'imperial'
                    ? Math.round(Number(draft[key]) * 2.2046226 * 100) / 100
                    : draft[key],
                ))
          : draft[key] === undefined
          ? ''
          : String(draft[key])
      }
      onChangeText={value => {
        if (numeric) setNumericText(values => ({ ...values, [key]: value }));
        put(
          key,
          (numeric
            ? value.trim() === ''
              ? undefined
              : Number(value) /
                (key === 'targetWeightKg' && draft.units === 'imperial'
                  ? 2.2046226
                  : 1)
            : value === '' && ['dateOfBirth', 'targetDate'].includes(key)
            ? undefined
            : value) as any,
        );
      }}
      keyboardType={numeric ? 'decimal-pad' : 'default'}
      multiline={
        !numeric &&
        [
          'routine',
          'bodyDescription',
          'injuries',
          'mobility',
          'medicalConditions',
          'medications',
        ].includes(key)
      }
      hint={hint}
    />
  );
  const list = (
    key: 'allergies' | 'restrictions' | 'preferredTimes',
    label: string,
  ) => (
    <FitnessField
      label={label}
      value={listText[key] ?? (draft[key] ?? []).join(', ')}
      onChangeText={value => {
        setListText(values => ({ ...values, [key]: value }));
        put(
          key,
          value
            .split(',')
            .map(v => v.trim())
            .filter(Boolean),
        );
      }}
      hint="Separate entries with commas."
    />
  );
  const choices = (
    key: keyof FitnessAssessment,
    label: string,
    options: string[],
    multiple = false,
  ) => (
    <FitnessChoices
      label={label}
      options={options}
      selected={(draft[key] as any) ?? (multiple ? [] : '')}
      multiple={multiple}
      onChange={value => {
        if (key === 'units') setNumericText({});
        put(key, value);
      }}
    />
  );
  async function persist(next?: boolean, complete?: boolean) {
    setError('');
    setSaved('');
    if (complete) {
      const missing = assessmentMissing(draft);
      if (missing) {
        setError(missing);
        return;
      }
    }
    try {
      const body: Record<string, unknown> = { ...draft };
      for (const key of Object.keys(profile.data?.profile?.assessment ?? {}))
        if (draft[key as keyof FitnessAssessment] === undefined)
          body[key] = null;
      await save.mutateAsync({ path: '/profile', method: 'PATCH', body });
      if (complete) {
        await save.mutateAsync({ path: '/profile/complete', body: {} });
        await save.mutateAsync({ path: '/plans/generate', body: {} });
        nav.navigate('FitnessHome');
      } else if (next) setStep(value => Math.min(value + 1, steps.length - 1));
      else setSaved('Draft saved privately. You can return to finish it.');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <FitnessScreen
      busy={save.isPending}
      title={steps[step]}
      subtitle={`STEP ${step + 1} OF ${
        steps.length
      } · Your pace, your starting point.`}
    >
      {profile.isPending ? (
        <FitnessLoading />
      ) : profile.isError ? (
        <>
          <FitnessNotice error message={profile.error.message} />
          <FitnessAction
            label="Retry loading your draft"
            onPress={() => {
              void profile.refetch();
            }}
          />
        </>
      ) : (
        <>
          <FitnessCard tone="soft">
            <FitnessText muted>
              Your assessment stays private. Health questions are optional. Save
              your draft at any point; nothing is shared with an expert until
              you choose.
            </FitnessText>
          </FitnessCard>
          {step === 0 && (
            <>
              {field(
                'dateOfBirth',
                'Date of birth',
                false,
                'YYYY-MM-DD. Used for age appropriate safety guidance.',
              )}
              {fitnessAge(draft.dateOfBirth) !== null && (
                <FitnessText muted>
                  Age: {fitnessAge(draft.dateOfBirth)}
                </FitnessText>
              )}
              {field('gender', 'Gender (optional)')}
              {field(
                'bodyDescription',
                'How would you describe your body? (optional)',
              )}
              {choices(
                'calculationSex',
                'Optional physiological estimate input',
                ['unspecified', 'female', 'male'],
              )}
              <FitnessText muted>
                This input is separate from gender identity. Choosing
                unspecified gives a range where appropriate.
              </FitnessText>
              {choices('units', 'Preferred display units', [
                'metric',
                'imperial',
              ])}
              <FitnessField
                label={
                  draft.units === 'imperial' ? 'Height (inches)' : 'Height (cm)'
                }
                keyboardType="decimal-pad"
                value={
                  numericText.heightCm ??
                  (draft.heightCm === undefined
                    ? ''
                    : String(
                        Math.round(
                          (draft.units === 'imperial'
                            ? draft.heightCm / 2.54
                            : draft.heightCm) * 100,
                        ) / 100,
                      ))
                }
                onChangeText={v => {
                  setNumericText(values => ({ ...values, heightCm: v }));
                  put(
                    'heightCm',
                    v === ''
                      ? undefined
                      : Number(v) * (draft.units === 'imperial' ? 2.54 : 1),
                  );
                }}
              />
              <FitnessField
                label={
                  draft.units === 'imperial' ? 'Weight (lb)' : 'Weight (kg)'
                }
                keyboardType="decimal-pad"
                value={
                  numericText.weightKg ??
                  (draft.weightKg === undefined
                    ? ''
                    : String(
                        Math.round(
                          (draft.units === 'imperial'
                            ? draft.weightKg * 2.2046226
                            : draft.weightKg) * 100,
                        ) / 100,
                      ))
                }
                onChangeText={v => {
                  setNumericText(values => ({ ...values, weightKg: v }));
                  put(
                    'weightKg',
                    v === ''
                      ? undefined
                      : Number(v) /
                          (draft.units === 'imperial' ? 2.2046226 : 1),
                  );
                }}
              />
            </>
          )}
          {step === 1 && (
            <>
              {choices(
                'goals',
                'Your goals',
                [
                  'general_wellness',
                  'weight_loss',
                  'muscle_gain',
                  'fitness',
                  'flexibility',
                  'maintenance',
                  'rehabilitation_support',
                  'strength',
                  'endurance',
                  'mobility',
                  'weight_management',
                  'balanced_nutrition',
                  'better_sleep',
                ],
                true,
              )}
              {field('targetWeightKg', 'Target weight (kg, optional)', true)}
              {field(
                'targetDate',
                'Target date (optional)',
                false,
                'YYYY-MM-DD. A preference for expert review, not a guaranteed result.',
              )}
            </>
          )}
          {step === 2 && (
            <>
              {choices('activityLevel', 'Usual activity', [
                'sedentary',
                'light',
                'moderate',
                'active',
                'very_active',
              ])}
              {choices('experience', 'Exercise experience', [
                'beginner',
                'intermediate',
                'advanced',
              ])}
              {choices(
                'exercisePreferences',
                'Movement you enjoy',
                [
                  'walking',
                  'strength',
                  'cycling',
                  'yoga',
                  'swimming',
                  'running',
                  'dance',
                ],
                true,
              )}
              {choices(
                'equipment',
                'Equipment available (none is okay)',
                ['bodyweight', 'dumbbells', 'resistance_bands', 'gym', 'bike'],
                true,
              )}
              <FitnessChoices
                label="Days that work"
                options={days}
                selected={(draft.availableDays ?? []).map(day => days[day])}
                multiple
                onChange={(values: string[]) =>
                  put(
                    'availableDays',
                    values.map(value => days.indexOf(value)),
                  )
                }
              />
              {list('preferredTimes', 'Preferred times')}
              {field(
                'sessionMinutes',
                'Time per session (minutes, optional)',
                true,
              )}
            </>
          )}
          {step === 3 && (
            <>
              {choices(
                'foodPreferences',
                'Food preferences',
                [
                  'no_preference',
                  'vegetarian',
                  'vegan',
                  'pescatarian',
                  'halal',
                  'kosher',
                ],
                true,
              )}
              {list('allergies', 'Food allergies (optional)')}
              {list('restrictions', 'Restrictions or preferences (optional)')}
              <FitnessText muted>
                Food entries and photo estimates cannot establish allergen
                safety. Check packaging and ask a qualified professional when
                needed.
              </FitnessText>
            </>
          )}
          {step === 4 && (
            <>
              <FitnessSection
                title="Only what you want to share"
                caption="Optional and private. These details help us avoid unsuitable automatic guidance."
              />
              {field('injuries', 'Injuries (optional)')}
              {field('mobility', 'Mobility considerations (optional)')}
              {field('medicalConditions', 'Medical conditions (optional)')}
              {field('medications', 'Medications (optional)')}
              {(
                [
                  'pregnant',
                  'breastfeeding',
                  'eatingDisorderRisk',
                  'clinicalReviewRequired',
                ] as const
              ).map((key, i) => (
                <FitnessChoices
                  key={key}
                  label={
                    [
                      'Pregnancy or postpartum considerations',
                      'Breastfeeding',
                      'Eating disorder history or concerns',
                      'Clinical or rehabilitation review needed',
                    ][i]
                  }
                  options={['Prefer not to say', 'Yes', 'No']}
                  selected={
                    draft[key] === undefined
                      ? 'Prefer not to say'
                      : draft[key]
                      ? 'Yes'
                      : 'No'
                  }
                  onChange={v =>
                    put(
                      key,
                      v === 'Prefer not to say' ? undefined : v === 'Yes',
                    )
                  }
                />
              ))}
            </>
          )}
          {step === 5 && (
            <>
              {field('sleepHours', 'Usual sleep (hours)', true)}
              {choices('stressLevel', 'Typical stress level', [
                'low',
                'moderate',
                'high',
              ])}
              {field('waterMl', 'Usual water (ml per day)', true)}
              {field('routine', 'Anything about your routine? (optional)')}
            </>
          )}
          {step === 6 && (
            <>
              <FitnessCard>
                <FitnessSection title="Wellness, with context" />
                <FitnessText>
                  This space supports general wellbeing and does not diagnose,
                  treat, or replace professional care. Estimates are
                  approximate. Seek professional review for medical conditions,
                  pregnancy, eating disorders, injuries, or rehabilitation
                  needs. For severe or urgent symptoms, contact emergency care.
                </FitnessText>
                <FitnessText muted>
                  For minors and higher risk situations, automatic calorie,
                  weight loss and exercise prescriptions are withheld. Your
                  preferences still help prepare a reviewable wellness plan.
                </FitnessText>
              </FitnessCard>
              <FitnessChoices
                label="Wellness guidance"
                options={['I have read and accept this guidance']}
                selected={
                  draft.disclaimerAccepted
                    ? ['I have read and accept this guidance']
                    : []
                }
                multiple
                onChange={value => put('disclaimerAccepted', value.length > 0)}
              />
              <FitnessText muted>
                Goals:{' '}
                {(draft.goals ?? []).join(', ').replace(/_/g, ' ') ||
                  'Choose a goal'}{' '}
                · {draft.availableDays?.length ?? 0} days available ·{' '}
                {draft.experience ?? 'Experience not selected'}
              </FitnessText>
            </>
          )}
          <FitnessNotice message={error} error />
          <FitnessNotice message={saved} />
          <FitnessAction
            label={
              step === 6
                ? 'Save assessment & create my plan'
                : 'Save & continue'
            }
            busy={save.isPending}
            onPress={() => {
              void persist(step !== 6, step === 6);
            }}
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <FitnessAction
                label="Save draft"
                secondary
                busy={save.isPending}
                onPress={() => {
                  void persist();
                }}
              />
            </View>
            {step > 0 && (
              <View style={{ flex: 1 }}>
                <FitnessAction
                  label="Previous"
                  secondary
                  disabled={save.isPending}
                  onPress={() => setStep(s => s - 1)}
                />
              </View>
            )}
          </View>
        </>
      )}
    </FitnessScreen>
  );
}
