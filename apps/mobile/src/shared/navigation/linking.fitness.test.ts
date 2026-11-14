import { linking } from './linking';
const id = 'f8421f64-d302-43a0-924f-b71a73eb0d77';
const parse = (path: string) =>
  linking.getStateFromPath!(path, linking.config)?.routes.at(-1);
test.each(['needs/fitness', 'fitness', 'services/fitness'])(
  'opens the personal Fitness module from %s',
  path => {
    expect(parse(path)).toMatchObject({ name: 'FitnessHome' });
  },
);
test('preserves exact plan versions and dates from private deep links', () => {
  expect(parse(`needs/fitness/plan/${id}?version=2`)).toMatchObject({
    name: 'FitnessPlan',
    params: { planId: id, version: 2 },
  });
  expect(parse('needs/fitness/log/water?date=2026-11-14')).toMatchObject({
    name: 'FitnessLog',
    params: { kind: 'water', date: '2026-11-14' },
  });
});
test('keeps Knock primary tabs unchanged', () => {
  expect(parse('knock/chat')).toMatchObject({
    name: 'Main',
    state: { routes: [{ name: 'Knock', params: { initialTab: 'chat' } }] },
  });
});
