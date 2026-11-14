jest.mock('@react-navigation/native', () => ({
  createNavigationContainerRef: () => ({ isReady: () => false }),
}));
import { routeForNotification } from './rootNavigation';
const id = 'f8421f64-d302-43a0-924f-b71a73eb0d77',
  providerId = '56d34342-b099-4e18-9bad-95fd3ba6e370';
test('FCM string payload opens the exact plan version and saved workout', () => {
  expect(
    routeForNotification({
      kind: 'fitness',
      screen: 'FitnessPlan',
      planId: id,
      version: '3',
    }),
  ).toEqual({ screen: 'FitnessPlan', params: { planId: id, version: 3 } });
  expect(
    routeForNotification({
      kind: 'fitness',
      screen: 'FitnessWorkout',
      workoutId: id,
    }),
  ).toEqual({ screen: 'FitnessWorkout', params: { workoutId: id } });
});
test('planned workouts and summary notifications preserve their dates', () => {
  expect(
    routeForNotification({
      kind: 'fitness',
      screen: 'FitnessWorkout',
      planId: id,
      day: '0',
      date: '2026-11-15',
    }),
  ).toEqual({
    screen: 'FitnessWorkout',
    params: { planId: id, day: 0, date: '2026-11-15' },
  });
  expect(
    routeForNotification({
      kind: 'fitness',
      screen: 'FitnessProgress',
      from: '2026-11-09',
      to: '2026-11-15',
    }),
  ).toEqual({
    screen: 'FitnessProgress',
    params: { from: '2026-11-09', to: '2026-11-15' },
  });
});
test('shared updates retain the correct business/client/item and reject arbitrary screens', () => {
  expect(
    routeForNotification({
      kind: 'fitness',
      screen: 'FitnessWorkspace',
      clientId: id,
      providerId,
      resourceId: id,
    }),
  ).toEqual({
    screen: 'FitnessWorkspace',
    params: { clientId: id, providerId, resourceId: id },
  });
  for (const data of [
    { screen: 'AccountSettings' },
    { screen: 'FitnessPlan', planId: 'bad' },
    { screen: 'FitnessLog', logKind: 'unknown', date: '2026-11-14' },
    { screen: 'FitnessMeals', date: '2026-02-30' },
  ])
    expect(routeForNotification({ kind: 'fitness', ...data })).toBeNull();
});
