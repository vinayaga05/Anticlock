import { createFeedMediaMemory } from './feedMediaMemory';

it('preserves independent logical media preferences and existing unmuted autoplay defaults', () => {
  const memory = createFeedMediaMemory();
  expect(memory.get('flash:one:video')).toEqual({
    muted: false,
    paused: false,
    position: 0,
  });
  memory.update('flash:one:video', { muted: true, paused: true, position: 12 });
  expect(memory.get('flash:one:video')).toEqual({
    muted: true,
    paused: true,
    position: 12,
  });
  expect(memory.get('flash:two:video')).toEqual({
    muted: false,
    paused: false,
    position: 0,
  });
  expect(memory.get('clip:one')).toEqual({
    muted: false,
    paused: false,
    position: 0,
  });
});
it('bounds retained entries and keeps recently updated preferences when old cells are evicted', () => {
  const memory = createFeedMediaMemory(2);
  memory.update('old', { muted: true });
  memory.update('kept', { position: 10 });
  memory.update('old', { position: 20 });
  memory.update('new', { paused: true });
  expect(memory.get('kept').position).toBe(0);
  expect(memory.get('old')).toEqual({
    muted: true,
    paused: false,
    position: 20,
  });
  expect(memory.get('new').paused).toBe(true);
});
it('sanitizes invalid positions and clears session state', () => {
  const memory = createFeedMediaMemory();
  memory.update('one', { position: -10, muted: true });
  expect(memory.get('one').position).toBe(0);
  memory.update('one', { position: NaN });
  expect(memory.get('one').position).toBe(0);
  memory.update('one', { position: Infinity });
  expect(memory.get('one').position).toBe(0);
  memory.clear();
  expect(memory.get('one')).toEqual({
    muted: false,
    paused: false,
    position: 0,
  });
});
