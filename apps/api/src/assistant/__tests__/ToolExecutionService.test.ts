import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  APPROVED_TOOL_NAMES,
  ASSISTANT_TOOLS_CHAT,
  parseToolArguments,
} from '../tools/definitions.js';
import { toolExecutionService } from '../ToolExecutionService.js';

describe('ToolExecutionService allowlist', () => {
  it('includes the approved tool set', () => {
    assert.ok(APPROVED_TOOL_NAMES.includes('get_feed'));
    assert.ok(APPROVED_TOOL_NAMES.includes('get_saved_content'));
    assert.ok(!APPROVED_TOOL_NAMES.includes('search_catalog' as never));
  });

  it('rejects invalid tool arguments', () => {
    assert.throws(() => parseToolArguments('search_reels', { query: '' }));
  });

  it('rejects unknown tools before execution', async () => {
    const result = await toolExecutionService.execute(
      'not_a_real_tool',
      {},
      {
        sub: 'user-1',
        email: 'test',
        name: 'Test',
        roles: [],
        permissions: [],
        kind: 'mobile',
      },
      'conv-1',
      'Main',
      [],
    );
    assert.equal(result.result.ok, false);
    if (!result.result.ok) assert.equal(result.result.code, 'unknown_tool');
  });

  it('flags mutating tools', () => {
    assert.equal(toolExecutionService.isMutatingTool('navigate_to_screen'), true);
    assert.equal(toolExecutionService.isMutatingTool('search_reels'), false);
  });

  it('includes resolve and shop tools', () => {
    assert.ok(APPROVED_TOOL_NAMES.includes('resolve_service_category'));
    assert.ok(APPROVED_TOOL_NAMES.includes('open_shop_search'));
    assert.ok(APPROVED_TOOL_NAMES.includes('request_user_location'));
  });
});
