import { interpretSearch, validateSearch } from './interpretSearch';
import { searchSummary, type SearchContext } from './searchState';

function search(
  text: string,
  previous?: SearchContext,
  waiting?: 'area' | 'budget',
) {
  const result = interpretSearch(text, previous, waiting);
  expect(result.type).toBe('search');
  if (result.type !== 'search') throw new Error(JSON.stringify(result));
  return result;
}

test('refines the same provider search through location, availability, rating and a named area', () => {
  const first = search('Find plumbers near me');
  expect(first.needsLocation).toBe(true);
  expect(first.context.filters).toMatchObject({
    categoryId: 'home.plumber',
    nearby: true,
    sort: 'closest',
  });
  const available = search('Only those available today', first.context);
  const rated = search(
    'Only show ones rated 4 stars or higher',
    available.context,
  );
  const inTown = search('Actually, check White Town', rated.context);
  expect(inTown.context.filters).toEqual({
    categoryId: 'home.plumber',
    treeId: 'home_services',
    availability: 'today',
    minRating: 4,
    areaLabel: 'White Town',
  });
  expect(inTown.needsLocation).toBe(false);
});

test('named areas and typed PINs work even when GPS is unavailable', () => {
  const first = search(
    'Find plumbers near me who are available today in White Town',
  );
  expect(first.context.filters).toMatchObject({
    areaLabel: 'White Town',
    availability: 'today',
  });
  expect(first.needsLocation).toBe(false);
  const denied = search('Find physiotherapists near me');
  const retry = search('600040', denied.context, 'area');
  expect(retry.context.filters).toMatchObject({
    areaLabel: '600040',
    categoryId: 'health.physiotherapist',
  });
  expect(retry.context.filters.nearby).toBeUndefined();
});

test('visible manual filters survive a follow-up but incompatible filters are cleared on category change', () => {
  const previous: SearchContext = {
    domain: 'services',
    filters: {
      categoryId: 'home.plumber',
      treeId: 'home_services',
      sort: 'price',
      verified: true,
      areaLabel: 'Chennai',
      q: 'pipe repair',
    },
  };
  expect(search('Under ₹500', previous).context.filters).toMatchObject({
    sort: 'price',
    verified: true,
    areaLabel: 'Chennai',
    maxPrice: 500,
  });
  expect(search('Find physiotherapists', previous).context.filters).toEqual({
    categoryId: 'health.physiotherapist',
    treeId: 'health',
    sort: 'price',
    verified: true,
    areaLabel: 'Chennai',
  });
  expect(search('Find trekking', previous).context.filters).toEqual({
    categoryId: 'tours.trekking',
    treeId: 'tours_events',
  });
  expect(
    search('Search nearby areas', previous).context.filters.areaLabel,
  ).toBeUndefined();
});

test('routes example utterances with only supported filters', () => {
  expect(search('Show resistance bands under ₹1,000').context).toEqual({
    domain: 'shop',
    filters: { q: 'resistance bands', maxPrice: 1000 },
  });
  expect(search('Find cricket teams I can join').context).toEqual({
    domain: 'community',
    filters: { teams: true, sport: 'Cricket', joining: true },
  });
  expect(search('Show my upcoming bookings').context).toEqual({
    domain: 'knock',
    filters: { upcoming: true },
  });
  expect(search('Show recent posts from people I follow').context).toEqual({
    domain: 'flash',
    filters: { following: true, sort: 'recent' },
  });
  expect(search('Show cricket clips').context.filters.q).toBe('cricket');
  expect(validateSearch('shop', { minRating: 4 })).toBeNull();
  expect(
    validateSearch('services', {
      treeId: 'health',
      categoryId: 'home.plumber',
    }),
  ).toBeNull();
});

test('recognizes spoken prices and ratings even when the transcript spells them out', () => {
  const typed = search('Show resistance bands under ₹1,000').context;
  expect(
    search('Show resistance bands under one thousand rupees').context,
  ).toEqual(typed);
  expect(search('Under five hundred', typed).context.filters.maxPrice).toBe(
    500,
  );
  expect(
    search('Seven hundred and fifty rupees', typed, 'budget').context.filters
      .maxPrice,
  ).toBe(750);
  expect(
    search('Find plumbers rated four stars').context.filters.minRating,
  ).toBe(4);
});

test('questions, ordinal references, budget clarification and zero/error summaries stay distinct', () => {
  expect(interpretSearch('What does verified mean?')).toEqual({
    type: 'conversation',
  });
  expect(interpretSearch('Open the second one')).toEqual({
    type: 'open',
    index: 1,
  });
  expect(interpretSearch('Why did you show the second one?')).toEqual({
    type: 'explain',
    index: 1,
  });
  const cheap = interpretSearch('Show cheap resistance bands');
  expect(cheap).toMatchObject({ type: 'question', waiting: 'budget' });
  if (cheap.type === 'question')
    expect(
      search('₹700', cheap.context, 'budget').context.filters.maxPrice,
    ).toBe(700);
  expect(
    searchSummary({
      domain: 'shop',
      filters: { maxPrice: 500 },
      status: 'ready',
      rows: [],
    }),
  ).toBe('No matches (priced up to ₹500).');
  expect(
    searchSummary({ domain: 'shop', filters: {}, status: 'error', rows: [] }),
  ).toContain('couldn’t load');
});
