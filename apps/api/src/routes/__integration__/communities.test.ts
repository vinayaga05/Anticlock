import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testRequest, createTestUser, createMobileTestUser } from '../../test-helpers.js';

describe('Communities Authorization', () => {
  let adminUserId: string;
  let mobileUserId1: string;
  let mobileUserId2: string;
  let communityId: string;

  beforeAll(async () => {
    // Create test users
    adminUserId = await createTestUser('community-admin@test.com', 'super_admin');
    mobileUserId1 = await createMobileTestUser('+919876543210');
    mobileUserId2 = await createMobileTestUser('+919876543211');

    // Create a test community as mobileUserId1
    const createRes = await testRequest('/v1/communities', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Community',
        slug: 'test-community-auth',
        description: 'Test community for authorization tests',
      }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await getMobileToken(mobileUserId1)}`,
      },
    });
    expect(createRes.status).toBe(201);
    const createData = await createRes.json();
    communityId = createData.community.id;

    // Join community as mobileUserId1 (should be automatic as creator)
  });

  it('non-member cannot create post', async () => {
    const res = await testRequest(`/v1/communities/${communityId}/posts`, {
      method: 'POST',
      body: JSON.stringify({
        content: 'This should fail - not a member',
      }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await getMobileToken(mobileUserId2)}`,
      },
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe('forbidden');
    expect(data.error.message).toContain('Only members can post');
  });

  it('member can create post', async () => {
    const res = await testRequest(`/v1/communities/${communityId}/posts`, {
      method: 'POST',
      body: JSON.stringify({
        content: 'This should succeed - I am the owner/member',
      }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await getMobileToken(mobileUserId1)}`,
      },
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.post).toBeDefined();
    expect(data.post.content).toBe('This should succeed - I am the owner/member');
  });

  it('non-owner cannot update community', async () => {
    // First, join as mobileUserId2
    await testRequest(`/v1/communities/${communityId}/join`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await getMobileToken(mobileUserId2)}`,
      },
    });

    // Now try to update as non-owner member
    const res = await testRequest(`/v1/communities/${communityId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        description: 'Updated by non-owner - should fail',
      }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await getMobileToken(mobileUserId2)}`,
      },
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe('forbidden');
    expect(data.error.message).toContain('Only owner or moderator can update community');
  });

  it('owner can update community', async () => {
    const res = await testRequest(`/v1/communities/${communityId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        description: 'Updated by owner - should succeed',
      }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await getMobileToken(mobileUserId1)}`,
      },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.community).toBeDefined();
    expect(data.community.description).toBe('Updated by owner - should succeed');
  });

  it('owner cannot leave community', async () => {
    const res = await testRequest(`/v1/communities/${communityId}/leave`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await getMobileToken(mobileUserId1)}`,
      },
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe('forbidden');
    expect(data.error.message).toContain('Owner cannot leave community');
  });

  it('non-owner member can leave community', async () => {
    const res = await testRequest(`/v1/communities/${communityId}/leave`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await getMobileToken(mobileUserId2)}`,
      },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  afterAll(async () => {
    // Cleanup: delete test community
    await testRequest(`/admin/communities/${communityId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${await getAdminToken(adminUserId)}`,
      },
    });
  });
});

// Helper functions (these should be implemented in test-helpers.js)
async function getMobileToken(userId: string): Promise<string> {
  // Mock implementation - should return JWT token for mobile user
  return `mobile-token-${userId}`;
}

async function getAdminToken(userId: string): Promise<string> {
  // Mock implementation - should return JWT token for admin user
  return `admin-token-${userId}`;
}
