import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GenieActionSchema,
  AssistantStreamEventSchema,
  AssistantMessageRequestSchema,
} from '@anticlock/contracts';
import {
  navigateAction,
  openSearchResultsAction,
  requestLocationAction,
  parseGenieAction,
} from '../genieActions.js';

describe('GenieAction contracts', () => {
  it('builds navigate actions for Main/Shop', () => {
    const action = navigateAction('Main', { screen: 'Shop' });
    const parsed = GenieActionSchema.parse(action);
    assert.equal(parsed.type, 'navigate');
    if (parsed.type === 'navigate') {
      assert.equal(parsed.target.route, 'Main');
      assert.equal(parsed.target.params.screen, 'Shop');
    }
  });

  it('builds open_search_results and request_location', () => {
    const search = openSearchResultsAction('services', {
      treeId: 'home_services',
      categoryId: 'home.plumber',
    });
    assert.equal(search.type, 'open_search_results');
    const loc = requestLocationAction('Find plumbers near you');
    assert.equal(loc.type, 'request_location');
  });

  it('rejects invalid actions', () => {
    assert.equal(parseGenieAction({ type: 'navigate' }), null);
  });

  it('accepts action and result stream events', () => {
    const action = navigateAction('SavedHub', {});
    const actionEvt = AssistantStreamEventSchema.parse({
      type: 'action',
      action,
    });
    assert.equal(actionEvt.type, 'action');
    const resultEvt = AssistantStreamEventSchema.parse({
      type: 'result',
      actionId: action.id,
      outcome: 'success',
    });
    assert.equal(resultEvt.type, 'result');
  });

  it('accepts clientRequestId on chat requests', () => {
    const body = AssistantMessageRequestSchema.parse({
      message: 'Take me to Shop',
      clientRequestId: '11111111-1111-1111-1111-111111111111',
      areaLabel: 'Chennai',
    });
    assert.equal(body.areaLabel, 'Chennai');
  });
});
