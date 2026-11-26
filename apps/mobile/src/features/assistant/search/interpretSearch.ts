import { isHealthRecord, healthFeaturesEnabled } from '@/shared/config/releaseFeatures';
import { serviceCategories } from '@/shared/data/services/serviceCategories';
import { SPORT_TAGS } from '@/shared/data/community/types';
import type { GenieActionDomain } from '@anticlock/contracts';
import type { SearchContext, SearchFilters } from './searchState';

const keys: Record<GenieActionDomain, Array<keyof SearchFilters>> = {
  services: [
    'categoryId',
    'treeId',
    'q',
    'areaLabel',
    'nearby',
    'sort',
    'maxPrice',
    'minRating',
    'verified',
    'availability',
  ],
  needs: ['q'],
  shop: ['q', 'categoryId', 'maxPrice', 'sort'],
  community: ['teams', 'sport', 'joining'],
  flash: ['following', 'sort'],
  clips: ['q'],
  knock: ['q', 'upcoming'],
};
const sortOptions: Partial<Record<GenieActionDomain, SearchFilters['sort'][]>> =
  {
    services: ['closest', 'rating', 'price'],
    shop: ['price', 'highPrice'],
    flash: ['recent'],
  };

export function validateSearch(
  domain: string,
  raw: Record<string, unknown>,
): SearchContext | null {
  if (
    !Object.prototype.hasOwnProperty.call(keys, domain) ||
    !raw ||
    Array.isArray(raw) ||
    typeof raw !== 'object'
  )
    return null;
  if (!healthFeaturesEnabled && isHealthRecord(raw)) return null;
  const d = domain as GenieActionDomain;
  const filters: SearchFilters = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value == null || value === '' || value === false) continue;
    if (!keys[d].includes(key as keyof SearchFilters)) return null;
    if (
      key === 'sort' &&
      !sortOptions[d]?.includes(value as SearchFilters['sort'])
    )
      return null;
    if (key === 'availability' && value !== 'today' && value !== 'open_now')
      return null;
    if (
      key === 'minRating' &&
      (typeof value !== 'number' ||
        !Number.isFinite(value) ||
        value < 1 ||
        value > 5)
    )
      return null;
    if (
      key === 'maxPrice' &&
      (typeof value !== 'number' ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > 1e9)
    )
      return null;
    if (
      [
        'verified',
        'nearby',
        'joining',
        'teams',
        'following',
        'upcoming',
      ].includes(key) &&
      value !== true
    )
      return null;
    if (
      ['q', 'categoryId', 'treeId', 'areaLabel', 'sport'].includes(key) &&
      (typeof value !== 'string' || !value.trim() || value.length > 100)
    )
      return null;
    Object.assign(filters, {
      [key]: typeof value === 'string' ? value.trim() : value,
    });
  }
  if (d === 'services') {
    const category = serviceCategories.find(c => c.id === filters.categoryId);
    if (!category || category.treeId !== filters.treeId) return null;
    const isCatalogList = [
      'event_booking',
      'transport_booking',
      'course_enrollment',
      'product_purchase',
      'property_enquiry',
    ].includes(category.actionType);
    const isSpecialtyList =
      category.treeId === 'health' &&
      category.id !== 'health.doctors' &&
      serviceCategories.some(child => child.parentId === category.id && child.id.startsWith(`${category.id}.`));
    if (
      (isCatalogList || isSpecialtyList) &&
      Object.keys(filters).some(
        key => !['q', 'categoryId', 'treeId'].includes(key),
      )
    )
      return null;
  }
  if (filters.sport && !SPORT_TAGS.some(sport => sport === filters.sport))
    return null;
  return { domain: d, filters };
}

const aliases: Record<string, string[]> = {
  'home.plumber': ['plumbing', 'pipe repair', 'leaking pipe'],
  'health.physiotherapist': [
    'physio',
    'physios',
    'physical therapy',
    'physical therapist',
  ],
  'fitness.personal_trainer': [
    'fitness trainer',
    'gym trainer',
    'personal training',
  ],
};
const near = /\b(near me|nearby|close by|around me)\b/i;
const closest = /\b(closest|nearest)\b/i;
const request =
  /\b(find|show|open|search|look for|take me|browse|list|looking for|need|get me|buy)\b/i;
const normalize = (input: string) =>
  input
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const singular = (input: string) =>
  input
    .split(' ')
    .map(w => (w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .join(' ');
const has = (text: string, term: string) => ` ${text} `.includes(` ${term} `);
const terms = serviceCategories
  .flatMap(category =>
    [
      category.name,
      category.id.split('.').at(-1)!.replace(/_/g, ' '),
      ...(aliases[category.id] ?? []),
    ].map(term => ({ category, term: singular(normalize(term)) })),
  )
  .sort((a, b) => b.term.length - a.term.length);
const numberWords: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};
const numberScales: Record<string, number> = {
  thousand: 1_000,
  lakh: 100_000,
  lakhs: 100_000,
};
const unitWord = `(?:${Object.keys(numberWords).join('|')})`;
const nextNumberWord = `(?:${unitWord}|hundred|${Object.keys(numberScales).join(
  '|',
)})`;
const spokenNumber = `${unitWord}(?:[ -]+(?:and +)?${nextNumberWord})*`;
const currency = '(?:(?:₹|rs\\.?|inr|rupees?)\\s*)?';
const amount = `${currency}([\\d,]+(?:\\.\\d{1,2})?|${spokenNumber})\\b`;
const maxPrice = new RegExp(
  `\\b(?:under|below|up to|less than|max(?:imum)?(?: price)?|budget(?: of)?)\\s*${amount}`,
  'i',
);
const budgetAnswer = new RegExp(`^${amount}(?:\\s+rupees?)?$`, 'i');
const rating =
  /(?:rated\s*)?\b([1-5](?:\.\d+)?|one|two|three|four|five)\s*(?:stars?\b|\+(?=\s|$))/i;
const clearPrice =
  /\b(?:remove|clear|reset|drop)\s+(?:(?:the|my)\s+)?(?:price(?: limit)?|budget)\b/i;
const clearArea =
  /\b(?:anywhere|without location|clear (?:the )?(?:area|location)|nearby areas)\b/i;
const sortPrice =
  /\b(cheapest|price low to high|lowest price|sort by price)\b/i;

function readAmount(match?: RegExpExecArray | null): number | undefined {
  const raw = match?.[1];
  if (!raw) return undefined;
  if (/^\d/.test(raw)) return Number(raw.replace(/,/g, ''));
  let total = 0;
  let group = 0;
  for (const word of raw.toLowerCase().split(/[ -]+/)) {
    if (word === 'and') continue;
    if (word === 'hundred') {
      group *= 100;
    } else if (numberScales[word]) {
      total += group * numberScales[word];
      group = 0;
    } else {
      group += numberWords[word];
    }
  }
  return total + group;
}

export type Interpretation =
  | { type: 'search'; context: SearchContext; needsLocation?: boolean }
  | {
      type: 'question';
      text: string;
      context?: SearchContext;
      waiting?: 'area' | 'budget' | 'category';
    }
  | { type: 'open'; index: number }
  | { type: 'explain'; index: number }
  | { type: 'conversation' };

export function interpretSearch(
  text: string,
  previous?: SearchContext | null,
  waiting?: 'area' | 'budget' | 'category',
): Interpretation {
  const plain = text.trim().replace(/[.?!]+$/, '');
  const norm = singular(normalize(plain));
  const ordinal =
    /\b(first|second|third|fourth|fifth|last|\d+(?:st|nd|rd|th)?)\b/i
      .exec(plain)?.[1]
      ?.toLowerCase();
  const noted = ordinal
    ? { first: 0, second: 1, third: 2, fourth: 3, fifth: 4, last: -1 }[
        ordinal
      ] ?? parseInt(ordinal, 10) - 1
    : 0;
  if (
    /^(?:open|view|select|show)\s+(?:(?:number|the|result)\s+)*(?:first|second|third|fourth|fifth|last|\d+(?:st|nd|rd|th)?)(?:\s+(?:one|result))?$/i.test(
      plain,
    )
  )
    return { type: 'open', index: noted };
  if (/^why (?:did you show|this|that|is)\b/i.test(plain)) {
    if (
      !ordinal &&
      !/^(?:why (?:this|that)(?: one)?|why did you show (?:this|that)(?: one)?)$/i.test(
        plain,
      )
    )
      return { type: 'conversation' };
    return { type: 'explain', index: ordinal ? noted : -2 };
  }
  if (
    /^(what|how|why|can (?:i|you) explain|tell me (?:what|about)|explain|is|are)\b/i.test(
      plain,
    )
  )
    return { type: 'conversation' };

  const find = request.test(plain);
  const match = terms.find(t => t.term && has(norm, t.term));
  const sport = SPORT_TAGS.find(s => has(norm, singular(normalize(s))));
  const budget =
    readAmount(maxPrice.exec(plain)) ??
    (waiting === 'budget' ? readAmount(budgetAnswer.exec(plain)) : undefined);
  const minRating = readAmount(rating.exec(plain));
  const isNear = near.test(plain) && !clearArea.test(plain);
  const wantsClosest = closest.test(plain);
  const areaMatch = Array.from(
    plain.matchAll(
      /\b(?:in|around|near|check)\s+([\p{L}\d][\p{L}\d.' -]{1,49}?)(?=\s+(?:under|below|up to|with|rated|that|who|available|open|today|please|instead)\b|$)/giu,
    ),
  )
    .map(match => match[1].trim())
    .find(value => !/^(?:me|here|there|nearby|my area)$/i.test(value));
  const typedArea =
    waiting === 'area' &&
    /^(?:[\p{L}][\p{L}\d.' -]{1,49}|\d{6})$/u.test(plain) &&
    !find
      ? plain
      : undefined;
  const area =
    areaMatch && !/^(?:me|here|there|nearby|my area)$/i.test(areaMatch)
      ? areaMatch
      : typedArea;
  const clear = /^(?:clear|reset|remove)\s+(?:all\s+)?filters?$/i.test(plain);
  const availability = /\bopen now\b/i.test(plain)
    ? 'open_now'
    : /\b(?:available|slots?|availability)\s+(?:for\s+)?today\b|\b(?:today only|only today)\b/i.test(
        plain,
      )
    ? 'today'
    : undefined;
  const verified = /\bverified\b/i.test(plain);
  const following = /\b(?:people i follow|following|followed accounts)\b/i.test(
    plain,
  );
  const recent = /\b(?:recent|latest|newest)\b/i.test(plain);
  const relative = Boolean(
    budget != null ||
      minRating != null ||
      area ||
      isNear ||
      wantsClosest ||
      availability ||
      verified ||
      recent ||
      clear ||
      clearPrice.test(plain) ||
      clearArea.test(plain) ||
      sortPrice.test(plain) ||
      /\b(cheap|affordable|highly rated|top rated|highest price|price high to low)\b/i.test(
        plain,
      ),
  );
  let domain: GenieActionDomain | undefined;
  const base: SearchFilters = {};

  if (
    find &&
    /\b(?:my\s+)?(?:upcoming\s+)?(?:bookings|my appointments)\b/i.test(plain)
  ) {
    domain = 'knock';
    if (/\bupcoming\b/i.test(plain)) base.upcoming = true;
  } else if (find && /\b(?:teams?|clubs?)\b/i.test(plain)) {
    domain = 'community';
    base.teams = true;
    if (sport) base.sport = sport;
    if (/\b(?:join|accepting|recruiting)\b/i.test(plain)) base.joining = true;
  } else if (find && /\b(?:flash|posts?)\b/i.test(plain)) {
    domain = 'flash';
    if (following) base.following = true;
    if (recent) base.sort = 'recent';
  } else if (find && /\b(?:clips?|reels?)\b/i.test(plain)) {
    domain = 'clips';
    base.q =
      plain
        .replace(
          /^(?:find|show(?: me)?|open|search(?: for)?|browse)\s+(?:me\s+)?/i,
          '',
        )
        .replace(/\b(?:clips?|reels?)(?:\s+(?:of|about|for))?\b/i, '')
        .trim() || undefined;
  } else if (
    find &&
    /^(?:open|show|take me to)\s+(?:the\s+)?(?:knock|community|needs|shop)(?:\s+tab)?$/i.test(
      plain,
    )
  ) {
    domain = /community/i.test(plain)
      ? 'community'
      : /needs/i.test(plain)
      ? 'needs'
      : /shop/i.test(plain)
      ? 'shop'
      : 'knock';
  } else if (
    !match &&
    find &&
    /\b(?:trainer|coach)\b/i.test(plain) &&
    previous?.domain === 'services' &&
    relative
  ) {
    domain = 'services';
  } else if (
    match &&
    (find ||
      waiting === 'category' ||
      /^actually\b/i.test(plain) ||
      norm === match.term)
  ) {
    domain = 'services';
    base.categoryId = match.category.id;
    base.treeId = match.category.treeId;
  } else if (find && /\b(?:trainer|coach)\b/i.test(plain)) {
    return {
      type: 'question',
      text: 'Are you looking for a fitness trainer or a sports coach?',
      waiting: 'category',
    };
  } else if (
    find &&
    (budget != null ||
      /\b(?:shop|products?|resistance bands?|buy)\b/i.test(plain))
  ) {
    domain = 'shop';
    base.q =
      plain
        .replace(
          /^(?:show(?: me)?|find|search(?: for)?|buy|shop(?: for)?)\s+/i,
          '',
        )
        .split(/\b(?:under|below|up to|less than|max(?:imum)?|budget)\b/i)[0]
        ?.replace(/\b(?:cheap|affordable|products?)\b/gi, '')
        .trim() || undefined;
  } else if (
    (relative ||
      (previous?.domain === 'community' && sport) ||
      (previous?.domain === 'flash' && following)) &&
    previous
  ) {
    domain = previous.domain;
  } else if (find && /\bservices\b/i.test(plain)) {
    domain = 'needs';
    base.q =
      plain
        .replace(/^(?:find|show(?: me)?|search(?: for)?)\s+/i, '')
        .replace(/\bservices\b/i, '')
        .trim() || undefined;
  }
  if (!domain) return { type: 'conversation' };
  const previousFilters = domain === previous?.domain ? previous.filters : {};
  const changingCategory =
    base.categoryId != null && base.categoryId !== previousFilters.categoryId;
  const { q: _previousQuery, ...otherFilters } = previousFilters;
  const compatibleFilters = changingCategory
    ? validateSearch(domain, { ...otherFilters, ...base })?.filters
    : previousFilters;
  const filters: SearchFilters = {
    ...compatibleFilters,
    ...base,
  };
  if (clear) {
    for (const key of Object.keys(filters) as Array<keyof SearchFilters>)
      if (key !== 'categoryId' && key !== 'treeId') delete filters[key];
  }
  if (budget != null) filters.maxPrice = budget;
  if (clearPrice.test(plain)) delete filters.maxPrice;
  if (clearArea.test(plain)) {
    delete filters.areaLabel;
    delete filters.nearby;
    if (filters.sort === 'closest') delete filters.sort;
  }
  if (area) {
    filters.areaLabel = area;
    delete filters.nearby;
    if (filters.sort === 'closest') delete filters.sort;
  }
  if (minRating != null) filters.minRating = minRating;
  if (availability) filters.availability = availability;
  if (verified) filters.verified = !/\b(?:remove|clear|any)\b/i.test(plain);
  if (following && domain === 'flash') filters.following = true;
  if (sport && domain === 'community') filters.sport = sport;
  if (recent && domain === 'flash') filters.sort = 'recent';
  if (/\b(?:highly rated|top rated|highest rated)\b/i.test(plain))
    filters.sort = 'rating';
  if (sortPrice.test(plain)) filters.sort = 'price';
  if (/\b(?:highest price|price high to low)\b/i.test(plain))
    filters.sort = 'highPrice';
  if (isNear && !area) {
    delete filters.areaLabel;
    filters.nearby = true;
    filters.sort = 'closest';
  }
  if (wantsClosest) filters.sort = 'closest';
  const cleaned = validateSearch(domain, filters);
  if (!cleaned)
    return {
      type: 'question',
      text: 'That combination includes a filter this screen doesn’t support. Try a different filter.',
    };
  if (
    budget == null &&
    /\b(?:cheap|affordable)\b/i.test(plain) &&
    !filters.maxPrice &&
    (domain === 'shop' || domain === 'services')
  ) {
    return {
      type: 'question',
      text: 'What’s your maximum budget in rupees?',
      context: cleaned,
      waiting: 'budget',
    };
  }
  return {
    type: 'search',
    context: cleaned,
    needsLocation: domain === 'services' && (wantsClosest || (isNear && !area)),
  };
}
