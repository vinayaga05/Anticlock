import {
  acknowledgeFitnessMediaNotice,
  fitnessLoggingPreferenceSnapshot,
  resetFitnessLoggingPreferences,
  toggleFitnessFavourite,
} from './fitnessLoggingPreferences';
jest.mock('@/shared/context/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'owner' } }),
}));
jest.mock('../fitnessSession', () => ({ useFitnessDataEpoch: () => 0 }));
beforeEach(() => resetFitnessLoggingPreferences(`reset-${Math.random()}`));
test('stores only selected food IDs and a notice acknowledgement in memory', () => {
  resetFitnessLoggingPreferences('owner:0');
  toggleFitnessFavourite('owner:0', 'private-food-id');
  acknowledgeFitnessMediaNotice('owner:0');
  expect(fitnessLoggingPreferenceSnapshot()).toEqual({
    scope: 'owner:0',
    favouriteFoodIds: ['private-food-id'],
    mediaNoticeSeen: true,
  });
  toggleFitnessFavourite('owner:0', 'private-food-id');
  expect(fitnessLoggingPreferenceSnapshot().favouriteFoodIds).toEqual([]);
});
test('account changes and fitness deletion epochs clear UI preferences and ignore stale callbacks', () => {
  resetFitnessLoggingPreferences('first:0');
  toggleFitnessFavourite('first:0', 'food');
  acknowledgeFitnessMediaNotice('first:0');
  resetFitnessLoggingPreferences('second:0');
  toggleFitnessFavourite('first:0', 'late-response');
  acknowledgeFitnessMediaNotice('first:0');
  expect(fitnessLoggingPreferenceSnapshot()).toEqual({
    scope: 'second:0',
    favouriteFoodIds: [],
    mediaNoticeSeen: false,
  });
  toggleFitnessFavourite('second:0', 'another');
  acknowledgeFitnessMediaNotice('second:0');
  resetFitnessLoggingPreferences('second:1');
  expect(fitnessLoggingPreferenceSnapshot()).toEqual({
    scope: 'second:1',
    favouriteFoodIds: [],
    mediaNoticeSeen: false,
  });
});
