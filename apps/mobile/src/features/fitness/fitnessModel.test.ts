import {
  assessmentMissing,
  chartPoints,
  chartSegments,
  dayMetric,
  fitnessAge,
  fitnessDateValid,
  fitnessRange,
  localFitnessDate,
} from './fitnessModel';
import type { FitnessAssessment } from '@anticlock/contracts';

const assessment: FitnessAssessment = {
  dateOfBirth: '1990-06-12',
  heightCm: 170,
  weightKg: 70,
  goals: ['general_wellness'],
  activityLevel: 'light',
  experience: 'beginner',
  availableDays: [1, 3],
  equipment: [],
  foodPreferences: ['no_preference'],
  disclaimerAccepted: true,
};
test('calendar validation rejects rollover days and age changes on birthday', () => {
  expect(fitnessDateValid('2024-02-29')).toBe(true);
  expect(fitnessDateValid('2025-02-29')).toBe(false);
  expect(fitnessAge('2000-11-15', '2026-11-14')).toBe(25);
  expect(fitnessAge('2000-11-15', '2026-11-15')).toBe(26);
  expect(fitnessAge('2027-01-01', '2026-11-14')).toBeNull();
});
test('date windows preserve local calendar dates across month and leap boundaries', () => {
  expect(fitnessRange('week', '2024-03-02')).toEqual({
    from: '2024-02-25',
    to: '2024-03-02',
  });
  expect(localFitnessDate(new Date(2026, 0, 2, 0, 5))).toBe('2026-01-02');
});
test('assessment requires essentials and acceptance while all private health fields remain optional', () => {
  expect(assessmentMissing(assessment)).toBeNull();
  expect(
    assessmentMissing({ ...assessment, dateOfBirth: '2030-01-01' }),
  ).toMatch(/date of birth/);
  expect(assessmentMissing({ ...assessment, foodPreferences: [] })).toMatch(
    /food preference/,
  );
  expect(
    assessmentMissing({ ...assessment, disclaimerAccepted: false }),
  ).toMatch(/guidance/);
  expect(assessmentMissing({ ...assessment, heightCm: NaN })).toMatch(/Height/);
});
test('chart geometry uses recorded values only and never invents missing weights', () => {
  expect(chartPoints([null, null])).toBe('');
  expect(chartPoints([70, null, 72]).split(' ')).toHaveLength(2);
  expect(chartPoints([70, 70])).not.toMatch(/NaN|Infinity/);
  const segments = chartSegments([70, null, 72, 73]);
  expect(segments).toHaveLength(2);
  expect(segments[0].split(' ')).toHaveLength(1);
  expect(segments[1].split(' ')).toHaveLength(2);
});
test('chart metrics distinguish absent records from an explicit recorded zero', () => {
  const day: any = {
    recordedKinds: [],
    steps: 0,
    waterMl: 0,
    nutrients: { calories: 0 },
    weightKg: null,
  };
  expect(dayMetric(day, 'steps')).toBeNull();
  expect(dayMetric(day, 'calories')).toBeNull();
  expect(dayMetric({ ...day, recordedKinds: ['steps'] }, 'steps')).toBe(0);
  expect(
    dayMetric({ ...day, recordedKinds: ['water'], waterMl: 250 }, 'waterMl'),
  ).toBe(250);
});
