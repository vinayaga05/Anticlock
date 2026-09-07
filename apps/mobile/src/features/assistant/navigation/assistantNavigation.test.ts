import {
  executeAssistantNavigation,
  executeGenieAction,
  resetGenieActionDedupe,
} from '../navigation/assistantNavigation';
import {
  resolveGenieLocation,
  getDefaultAreaLabel,
} from '../services/genieLocation';

describe('executeGenieAction', () => {
  beforeEach(() => {
    resetGenieActionDedupe();
  });

  it('navigates Main → Shop', () => {
    const navigate = jest.fn();
    const result = executeGenieAction(
      { navigate },
      {
        id: 'a1',
        version: 1,
        type: 'navigate',
        target: { route: 'Main', params: { screen: 'Shop' } },
      },
    );
    expect(result.ok).toBe(true);
    expect(navigate).toHaveBeenCalledWith('Main', { screen: 'Shop' });
  });

  it('dedupes repeated action ids', () => {
    const navigate = jest.fn();
    const action = {
      id: 'dup',
      version: 1 as const,
      type: 'navigate' as const,
      target: { route: 'Search', params: {} },
    };
    expect(executeGenieAction({ navigate }, action).ok).toBe(true);
    expect(executeGenieAction({ navigate }, action).ok).toBe(false);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('fails closed when a mutation confirmation has no server-backed handler', () => {
    const navigate = jest.fn();
    const result = executeGenieAction(
      { navigate },
      {
        id: 'confirm-1',
        version: 1,
        type: 'confirm_mutation',
        operation: 'cancel booking',
        preview: { bookingId: 'booking-1' },
      },
    );
    expect(result).toEqual({ ok: false, reason: 'confirmation_handler_missing' });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens service category from open_search_results', () => {
    const navigate = jest.fn();
    executeGenieAction(
      { navigate },
      {
        id: 'svc1',
        version: 1,
        type: 'open_search_results',
        domain: 'services',
        filters: {
          treeId: 'home_services',
          categoryId: 'home.plumber',
          areaLabel: 'Chennai',
        },
      },
    );
    expect(navigate).toHaveBeenCalledWith('ServiceCategory', {
      treeId: 'home_services',
      categoryId: 'home.plumber',
      areaLabel: 'Chennai',
    });
  });

  it('executeAssistantNavigation passes PlayFeed reelId params', () => {
    const navigate = jest.fn();
    executeAssistantNavigation(
      { navigate },
      'Main',
      { screen: 'PlayFeed', reelId: 'r99', q: 'yoga' },
    );
    expect(navigate).toHaveBeenCalledWith('Main', {
      screen: 'PlayFeed',
      params: { reelId: 'r99', q: 'yoga' },
    });
  });
});

describe('resolveGenieLocation', () => {
  it('prefers explicit area over near-me', () => {
    const resolved = resolveGenieLocation('doctors in Chennai', {
      deviceLabel: 'T. Nagar',
    });
    expect(resolved.explicitArea).toMatch(/Chennai/i);
    expect(resolved.areaLabel).toMatch(/Chennai/i);
    expect(resolved.wantsNearMe).toBe(false);
  });

  it('detects near me without inventing coords', () => {
    const resolved = resolveGenieLocation('plumbers near me', {});
    expect(resolved.wantsNearMe).toBe(true);
    expect(resolved.areaLabel).toBeUndefined();
  });

  it('uses device label when near me and available', () => {
    const resolved = resolveGenieLocation('trainers near me', {
      deviceLabel: 'Indiranagar',
      lat: 12.97,
      lng: 77.64,
    });
    expect(resolved.areaLabel).toBe('Indiranagar');
    expect(resolved.locationHint?.lat).toBe(12.97);
  });

  it('returns a default area label helper', () => {
    expect(getDefaultAreaLabel().length).toBeGreaterThan(0);
  });
});
