import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateGenieOutput, GENIE_EVAL_CASES } from '../evals.js';

function toolCall(name: string, arguments_: Record<string, unknown>) {
  return { id: `call_${name}`, name, arguments: arguments_ };
}

describe('Genie offline evaluation baseline', () => {
  it('accepts correct structured actions for core discovery scenarios', () => {
    const outputs = [
      { toolCalls: [toolCall('open_shop_search', { query: 'home workout gear' })], text: '' },
      {
        toolCalls: [
          toolCall('resolve_service_category', {
            query: 'plumbers',
            nearMe: true,
            openResults: true,
          }),
        ],
        text: '',
      },
      {
        toolCalls: [
          toolCall('resolve_service_category', {
            query: 'yoga',
            areaLabel: 'Chennai',
            nearMe: false,
            openResults: true,
          }),
        ],
        text: '',
      },
      { toolCalls: [toolCall('search_reels', { query: 'fitness', limit: 3 })], text: '' },
      { toolCalls: [], text: 'You’re welcome!' },
    ];

    const results = GENIE_EVAL_CASES.map((evalCase, index) =>
      evaluateGenieOutput(evalCase, outputs[index]!),
    );
    assert.deepEqual(results.map(result => result.passed), [true, true, true, true, true]);
  });

  it('fails an output that proposes an unapproved tool', () => {
    const result = evaluateGenieOutput(GENIE_EVAL_CASES[0]!, {
      toolCalls: [toolCall('place_order', { sku: 'x' })],
      text: '',
    });
    assert.equal(result.passed, false);
    assert.match(result.failures.join(', '), /unapproved tool/);
  });
});
