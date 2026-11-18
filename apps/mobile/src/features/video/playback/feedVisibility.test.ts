import { visibleMediaOwner } from './feedVisibility';
const bounds = (id: string, rowY: number, y: number, height: number) => ({
  id,
  rowY,
  media: { y, height },
});

it('requires sufficient media visibility rather than counting a tall caption as visible video', () => {
  const item = bounds('post', 0, 700, 400);
  expect(visibleMediaOwner([item], 0, 600)).toBeNull();
  expect(visibleMediaOwner([item], 300, 600)).toBeNull();
  expect(visibleMediaOwner([item], 340, 600)).toBe('post');
  expect(visibleMediaOwner([item], 1000, 600)).toBeNull();
});
it('can play media taller than the viewport when the viewport is sufficiently covered', () => {
  expect(visibleMediaOwner([bounds('tall', 0, 0, 1200)], 300, 600)).toBe(
    'tall',
  );
  expect(visibleMediaOwner([bounds('tall', 0, 0, 1200)], 850, 600)).toBeNull();
});
it('picks exactly one largest visible surface and resolves ties deterministically', () => {
  const items = [bounds('one', 0, 0, 300), bounds('two', 300, 0, 300)];
  expect(visibleMediaOwner(items, 0, 600)).toBe('one');
  expect(visibleMediaOwner(items, 150, 600)).toBe('two');
  expect(visibleMediaOwner(items, 700, 600)).toBeNull();
});
it('returns no owner for missing/invalid layouts or an empty viewport', () => {
  expect(visibleMediaOwner([], 0, 600)).toBeNull();
  expect(visibleMediaOwner([bounds('one', 0, 0, 300)], 0, 0)).toBeNull();
  expect(visibleMediaOwner([bounds('one', 0, 0, 0)], 0, 600)).toBeNull();
  expect(visibleMediaOwner([bounds('one', NaN, 0, 300)], 0, 600)).toBeNull();
});
