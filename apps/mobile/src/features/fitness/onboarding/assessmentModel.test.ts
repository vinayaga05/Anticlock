import {
  assessmentPatch,
  assessmentStepError,
  assessmentsEqual,
  formatHeightInches,
  PRIMARY_GOALS,
  replaceKnownChoices,
  setWorkoutLocation,
  workoutLocation,
} from './assessmentModel';

test('the six visual goals use existing contract values and retain additional saved goals', () => {
  expect(PRIMARY_GOALS).toHaveLength(6);
  expect(
    PRIMARY_GOALS.find(goal => goal.label === 'Eat Healthier')?.value,
  ).toBe('balanced_nutrition');
  expect(
    replaceKnownChoices(
      ['rehabilitation_support', 'strength'],
      PRIMARY_GOALS.map(goal => goal.value),
      ['balanced_nutrition'],
    ),
  ).toEqual(['rehabilitation_support', 'balanced_nutrition']);
});
test('location replacement preserves movement and other preferences', () => {
  const next = setWorkoutLocation(
    ['yoga', 'location:home', 'walking', 'custom preference'],
    'outdoor',
  );
  expect(next).toEqual([
    'yoga',
    'walking',
    'custom preference',
    'location:outdoor',
  ]);
  expect(workoutLocation(next)).toBe('outdoor');
  expect(setWorkoutLocation(next, undefined)).toEqual([
    'yoga',
    'walking',
    'custom preference',
  ]);
});
test('draft patches distinguish clearing a private answer from leaving it unchanged', () => {
  expect(
    assessmentPatch(
      { pregnant: true, medicalConditions: 'Private note', weightKg: 70 },
      { weightKg: 70 },
    ),
  ).toEqual({ pregnant: null, medicalConditions: null });
  expect(
    assessmentsEqual(
      {
        reminders: {
          enabled: false,
          workouts: false,
          meals: false,
          water: false,
          habits: false,
          weeklySummary: false,
        },
      },
      {
        reminders: {
          weeklySummary: false,
          water: false,
          habits: false,
          workouts: false,
          meals: false,
          enabled: false,
        },
      },
    ),
  ).toBe(true);
});
test('step validation requires only current essentials and keeps health context optional', () => {
  expect(assessmentStepError(0, {})).toMatch(/goal/);
  expect(
    assessmentStepError(1, {
      dateOfBirth: '1990-01-01',
      heightCm: 170,
      weightKg: 70,
    }),
  ).toBeNull();
  expect(
    assessmentStepError(2, {
      activityLevel: 'light',
      experience: 'beginner',
      availableDays: [1],
    }),
  ).toBeNull();
  expect(assessmentStepError(3, { foodPreferences: ['other'] })).toBeNull();
  expect(assessmentStepError(4, { disclaimerAccepted: true })).toBeNull();
  expect(formatHeightInches(66)).toBe('5 ft 6 in');
});
