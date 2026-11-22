const mockDisk = new Map<string, string | number>();
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (key: string) => {
      const value = mockDisk.get(key);
      return typeof value === 'string' ? value : undefined;
    },
    set: (key: string, value: string | number) => mockDisk.set(key, value),
    remove: (key: string) => mockDisk.delete(key),
  }),
}));

function restartCart() {
  jest.resetModules();
  return require('./cartStore').useCartStore as typeof import('./cartStore').useCartStore;
}

beforeEach(() => mockDisk.clear());

it('discards a legacy count without items rather than showing a phantom cart', () => {
  mockDisk.set('cart_count', 7);
  const store = restartCart();
  expect(store.getState().items).toEqual([]);
  expect(store.getState().count).toBe(0);
  expect(mockDisk.has('cart_count')).toBe(false);
});

it('persists real product details and quantities and rehydrates the same total and badge count', () => {
  const store = restartCart();
  store.getState().addProduct('one', 'Yoga mat', 499, 'https://example.test/mat.jpg');
  store.getState().addProduct('one', 'Yoga mat', 499, 'https://example.test/mat.jpg');
  store.getState().addProduct('two', 'Bottle', 200);
  const hydrated = restartCart().getState();
  expect(hydrated.count).toBe(3);
  expect(hydrated.getTotal()).toBe(1198);
  expect(hydrated.items).toEqual([
    { productId: 'one', name: 'Yoga mat', price: 499, quantity: 2, imageUrl: 'https://example.test/mat.jpg' },
    { productId: 'two', name: 'Bottle', price: 200, quantity: 1 },
  ]);
});

it('persists quantity edits, removal and clear without leaving a stale badge after restart', () => {
  let store = restartCart();
  store.getState().addProduct('one', 'Yoga mat', 499);
  store.getState().addProduct('two', 'Bottle', 200);
  store.getState().updateQuantity('one', 3);
  store.getState().removeItem('two');
  store = restartCart();
  expect(store.getState().count).toBe(3);
  expect(store.getState().getTotal()).toBe(1497);
  store.getState().updateQuantity('one', 0);
  expect(restartCart().getState().count).toBe(0);
  store.getState().addProduct('two', 'Bottle', 200);
  store.getState().clear();
  expect(restartCart().getState().items).toEqual([]);
  expect(restartCart().getState().count).toBe(0);
});

it('recovers corrupted storage and excludes malformed or duplicate checkout lines', () => {
  mockDisk.set('cart_items_v1', '{invalid json');
  expect(restartCart().getState().count).toBe(0);
  const valid = { productId: 'one', name: 'Yoga mat', price: 499, quantity: 2 };
  mockDisk.set('cart_items_v1', JSON.stringify([valid, valid, null, { ...valid, productId: 'bad', quantity: -1 }, { ...valid, productId: 'fraction', quantity: 1.5 }]));
  expect(restartCart().getState().items).toEqual([valid]);
  expect(restartCart().getState().count).toBe(2);
});
