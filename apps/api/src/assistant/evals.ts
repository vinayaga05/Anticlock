import type { AssistantAgentOutput } from './ai/types.js';
import { normalizeToolName, parseToolArguments } from './tools/definitions.js';

export type GenieEvalCase = {
  id: string;
  userMessage: string;
  expectedTool?: string;
  expectedArguments?: Record<string, unknown>;
  expectsNoTool?: boolean;
};

/**
 * A deterministic baseline for provider-backed quality runs. It evaluates the
 * model's proposed action, not whether a live provider happened to be online.
 */
export const GENIE_EVAL_CASES: GenieEvalCase[] = [
  {
    id: 'shop-search',
    userMessage: 'Find home workout gear in Shop',
    expectedTool: 'open_shop_search',
    expectedArguments: { query: 'home workout gear' },
  },
  {
    id: 'nearby-service',
    userMessage: 'Find plumbers near me',
    expectedTool: 'resolve_service_category',
    expectedArguments: { query: 'plumbers', nearMe: true },
  },
  {
    id: 'service-with-area',
    userMessage: 'Show yoga classes in Chennai',
    expectedTool: 'resolve_service_category',
    expectedArguments: { query: 'yoga', areaLabel: 'Chennai', nearMe: false },
  },
  {
    id: 'reel-search',
    userMessage: 'Show me fitness clips',
    expectedTool: 'search_reels',
    expectedArguments: { query: 'fitness' },
  },
  {
    id: 'small-talk',
    userMessage: 'Thanks, Genie',
    expectsNoTool: true,
  },
];

export type GenieEvalResult = {
  caseId: string;
  passed: boolean;
  failures: string[];
};

function hasExpectedArguments(
  actual: Record<string, unknown>,
  expected: Record<string, unknown>,
) {
  return Object.entries(expected).every(([key, value]) => actual[key] === value);
}

export function evaluateGenieOutput(
  evalCase: GenieEvalCase,
  output: Pick<AssistantAgentOutput, 'toolCalls' | 'text'>,
): GenieEvalResult {
  const failures: string[] = [];

  for (const call of output.toolCalls) {
    const normalized = normalizeToolName(call.name);
    if (!normalized) {
      failures.push(`unapproved tool: ${call.name}`);
      continue;
    }
    try {
      parseToolArguments(normalized, call.arguments);
    } catch {
      failures.push(`invalid arguments for ${call.name}`);
    }
  }

  if (evalCase.expectsNoTool && output.toolCalls.length > 0) {
    failures.push('expected no tool call');
  }

  if (evalCase.expectedTool) {
    const expected = output.toolCalls.find(
      call => normalizeToolName(call.name) === evalCase.expectedTool,
    );
    if (!expected) {
      failures.push(`expected tool: ${evalCase.expectedTool}`);
    } else if (
      evalCase.expectedArguments &&
      !hasExpectedArguments(expected.arguments, evalCase.expectedArguments)
    ) {
      failures.push(`unexpected arguments for ${evalCase.expectedTool}`);
    }
  }

  if (output.toolCalls.length === 0 && !output.text.trim()) {
    failures.push('empty final response');
  }

  return { caseId: evalCase.id, passed: failures.length === 0, failures };
}
