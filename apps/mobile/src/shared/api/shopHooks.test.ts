import { useQuery } from '@tanstack/react-query';
import { apiRequest } from './client';
import { useProductsQuery } from './shopHooks';

jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn(options => options) }));
jest.mock('./client', () => ({ apiRequest: jest.fn() }));
const request = apiRequest as jest.Mock;
const queryOptions = () => (useQuery as jest.Mock).mock.calls.at(-1)![0];
const product = (id: string, price = 10000) => ({ id, price });
beforeEach(() => { request.mockReset(); (useQuery as jest.Mock).mockClear(); });

test('loads all pages with category and encoded cursor, deduplicating overlap before local sorting', async () => {
  request.mockResolvedValueOnce({
    products: [product('newest', 200000), product('overlap', 50000)],
    nextCursor: 'next+page/=',
  }).mockResolvedValueOnce({
    products: [product('overlap', 50000), product('cheapest', 10000)],
    nextCursor: null,
  });
  useProductsQuery('category-id');
  const options = queryOptions();
  expect(options.queryKey).toEqual(['products', 'category-id']);
  const result = await options.queryFn({ signal: new AbortController().signal });
  expect(request.mock.calls.map(([path]) => path)).toEqual([
    '/v1/shop/products?limit=100&categoryId=category-id',
    '/v1/shop/products?limit=100&categoryId=category-id&cursor=next%2Bpage%2F%3D',
  ]);
  expect(result.products.map((item: any) => item.id)).toEqual(['newest', 'overlap', 'cheapest']);
  expect(result.nextCursor).toBeNull();
  expect(result.products.filter((item: any) => item.price <= 99900).map((item: any) => item.id)).toContain('cheapest');
});

test('rejects a repeated cursor rather than looping or returning a misleading partial catalog', async () => {
  request.mockResolvedValue({ products: [product('one')], nextCursor: 'stuck' });
  useProductsQuery();
  await expect(queryOptions().queryFn({ signal: new AbortController().signal }))
    .rejects.toThrow('Could not load the complete product catalog');
  expect(request).toHaveBeenCalledTimes(2);
});

test('cancels an in-flight page and never asks for the following cursor', async () => {
  const controller = new AbortController();
  request.mockImplementation((_path, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(Object.assign(new Error('Cancelled'), { name: 'AbortError' })));
  }));
  useProductsQuery();
  const pending = queryOptions().queryFn({ signal: controller.signal });
  expect(request.mock.calls[0][1].signal.aborted).toBe(false);
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(request.mock.calls[0][1].signal.aborted).toBe(true);
  expect(request).toHaveBeenCalledTimes(1);
});

test('does not issue any request when the query is already cancelled', async () => {
  const controller = new AbortController();
  controller.abort();
  useProductsQuery(undefined, { enabled: false });
  expect(queryOptions().enabled).toBe(false);
  await expect(queryOptions().queryFn({ signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  expect(request).not.toHaveBeenCalled();
});
