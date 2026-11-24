import React, { useState } from 'react';
import Renderer, { act } from 'react-test-renderer';
import { useAssistantStore } from '../store/assistantStore';
import { useGenieSearch, type SearchFilters } from './searchState';
import { useGenieScreen } from './useGenieScreen';

jest.mock('@/shared/services/storage', () => ({
  storage: { getString: () => undefined, set: jest.fn() },
}));

test('reports actual filtered order only after the command and manual controls are applied', () => {
  let setManual!: (f: SearchFilters) => void;
  const open = jest.fn();
  function Probe() {
    const [filters, setFilters] = useState<SearchFilters>({});
    setManual = setFilters;
    const rows = [
      { id: 'first', name: 'Mat', price: 1000 },
      { id: 'second', name: 'Bands', price: 500 },
    ]
      .filter(
        item => filters.maxPrice == null || item.price <= filters.maxPrice,
      )
      .map(item => ({ ...item, open: () => open(item.id) }));
    useGenieScreen(
      { domain: 'shop', filters, rows, status: 'ready' },
      setFilters,
    );
    return null;
  }
  useGenieSearch.getState().reset();
  useAssistantStore.getState().setCurrentScreen('Shop', 'shop-a');
  let instance!: Renderer.ReactTestRenderer;
  act(() => {
    instance = Renderer.create(<Probe />);
  });
  act(() =>
    useGenieSearch
      .getState()
      .request({ id: 'one', domain: 'shop', filters: { maxPrice: 550 } }),
  );
  expect(useGenieSearch.getState().report?.rows.map(row => row.id)).toEqual([
    'second',
  ]);
  useGenieSearch.getState().report?.rows[0]?.open?.();
  expect(open).toHaveBeenCalledWith('second');
  act(() => useGenieSearch.getState().cancel('one'));
  act(() => setManual({ maxPrice: 1200, sort: 'price' }));
  expect(useGenieSearch.getState().report?.filters).toEqual({
    maxPrice: 1200,
    sort: 'price',
  });
  expect(useGenieSearch.getState().report?.rows).toHaveLength(2);
  act(() => instance.unmount());
});
