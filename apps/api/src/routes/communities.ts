import { Hono } from 'hono';
import {
  CommunityListQuerySchema,
  CreateCommunityRequestSchema,
  UpdateCommunityRequestSchema,
  CommunityPostListQuerySchema,
  CreateCommunityPostRequestSchema,
  CreateCommentRequestSchema,
  ReportPostRequestSchema,
  UpdateCommunityRoleRequestSchema,
  CommunityAdminQuerySchema,
  SuspendCommunityRequestSchema,
} from '@anticlock/contracts';
import { communityService } from '../community/CommunityService.js';
import { communityPostService } from '../community/CommunityPostService.js';
import {
  requireAuth,
  requirePermission,
  type AppEnv,
} from '../middleware/auth.js';

function requireMobileAuth(c: { get: (k: 'auth') => { kind: string; sub: string } }) {
  const auth = c.get('auth');
  if (auth.kind !== 'mobile') {
    throw Object.assign(new Error('Mobile session required'), {
      code: 'forbidden',
      status: 403,
    });
  }
  return auth;
}

function httpError(err: unknown) {
  const e = err as { status?: number; code?: string; message?: string };
  return {
    status: (e.status ?? 500) as 400 | 403 | 404 | 409 | 500,
    body: {
      error: {
        code: e.code ?? 'error',
        message: e.message ?? 'Unexpected error',
      },
    },
  };
}

export const communitiesMobileRoutes = new Hono<AppEnv>();
communitiesMobileRoutes.use('*', requireAuth);

communitiesMobileRoutes.get('/', async (c) => {
  try {
    const auth = requireMobileAuth(c);
    const query = {
      search: c.req.query('search'),
      tags: c.req.query('tags')?.split(',').filter(Boolean),
      status: 'published' as 'published',
      limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
      cursor: c.req.query('cursor'),
    };
    const validated = CommunityListQuerySchema.parse(query);
    const result = await communityService.listCommunities(
      {
        search: validated.search,
        tags: validated.tags ? validated.tags.split(',').filter(Boolean) : undefined,
        status: validated.status,
        limit: validated.limit,
        cursor: validated.cursor,
      },
      auth.sub,
    );
    return c.json(result);
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

communitiesMobileRoutes.get('/my', async (c) => {
  try {
    const auth = requireMobileAuth(c);
    const query = {
      limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
      cursor: c.req.query('cursor'),
    };
    const result = await communityService.listMyCommunities(auth.sub, query);
    return c.json(result);
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

communitiesMobileRoutes.post('/', async (c) => {
  try {
    const auth = requireMobileAuth(c);
    const body = CreateCommunityRequestSchema.parse(await c.req.json());
    const community = await communityService.createCommunity(auth.sub, body);
    return c.json({ community }, 201);
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

communitiesMobileRoutes.get('/:id', async (c) => {
  try {
    const auth = requireMobileAuth(c);
    const community = await communityService.getCommunity(c.req.param('id'), auth.sub);
    if (!community || community.status !== 'published') {
      return c.json(
        { error: { code: 'not_found', message: 'Community not found' } },
        404,
      );
    }
    return c.json({ community });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

communitiesMobileRoutes.patch('/:id', async (c) => {
  try {
    const auth = requireMobileAuth(c);
    const communityId = c.req.param('id');
    const role = await communityService.getMemberRole(communityId, auth.sub);
    if (role !== 'owner' && role !== 'moderator') {
      return c.json(
        { error: { code: 'forbidden', message: 'Only owner or moderator can update community' } },
        403,
      );
    }
    const body = UpdateCommunityRequestSchema.parse(await c.req.json());
    const community = await communityService.updateCommunity(communityId, body);
    return c.json({ community });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

communitiesMobileRoutes.post('/:id/join', async (c) => {
  try {
    const auth = requireMobileAuth(c);
    const member = await communityService.joinCommunity(c.req.param('id'), auth.sub);
    return c.json({ member }, 201);
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

communitiesMobileRoutes.post('/:id/leave', async (c) => {
  try {
    const auth = requireMobileAuth(c);
    await communityService.leaveCommunity(c.req.param('id'), auth.sub);
    return c.json({ success: true });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

communitiesMobileRoutes.get('/:id/members', async (c) => {
  try {
    const query = {
      limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
      cursor: c.req.query('cursor'),
    };
    const result = await communityService.listMembers(c.req.param('id'), query);
    return c.json(result);
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

communitiesMobileRoutes.patch('/:id/members/:memberId', async (c) => {
  try {
    const auth = requireMobileAuth(c);
    const communityId = c.req.param('id');
    const role = await communityService.getMemberRole(communityId, auth.sub);
    if (role !== 'owner') {
      return c.json(
        { error: { code: 'forbidden', message: 'Only owner can update member roles' } },
        403,
      );
    }
    const body = UpdateCommunityRoleRequestSchema.parse(await c.req.json());
    const member = await communityService.updateMemberRole(
      communityId,
      c.req.param('memberId'),
      body.role,
    );
    return c.json({ member });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

communitiesMobileRoutes.get('/:id/posts', async (c) => {
  try {
    const auth = requireMobileAuth(c);
    const query = {
      limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
      cursor: c.req.query('cursor'),
    };
    const validated = CommunityPostListQuerySchema.parse(query);
    const result = await communityPostService.listPosts(
      c.req.param('id'),
      validated,
      auth.sub,
    );
    return c.json(result);
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

communitiesMobileRoutes.post('/:id/posts', async (c) => {
  try {
    const auth = requireMobileAuth(c);
    const communityId = c.req.param('id');
    const role = await communityService.getMemberRole(communityId, auth.sub);
    if (!role) {
      return c.json(
        { error: { code: 'forbidden', message: 'Only members can post' } },
        403,
      );
    }
    const body = CreateCommunityPostRequestSchema.parse(await c.req.json());
    const post = await communityPostService.createPost(communityId, auth.sub, body);
    return c.json({ post }, 201);
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

communitiesMobileRoutes.post('/posts/:postId/like', async (c) => {
  try {
    const auth = requireMobileAuth(c);
    await communityPostService.likePost(c.req.param('postId'), auth.sub);
    return c.json({ success: true });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

communitiesMobileRoutes.post('/posts/:postId/unlike', async (c) => {
  try {
    const auth = requireMobileAuth(c);
    await communityPostService.unlikePost(c.req.param('postId'), auth.sub);
    return c.json({ success: true });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

communitiesMobileRoutes.get('/posts/:postId/comments', async (c) => {
  try {
    const result = await communityPostService.listComments(c.req.param('postId'));
    return c.json(result);
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

communitiesMobileRoutes.post('/posts/:postId/comments', async (c) => {
  try {
    const auth = requireMobileAuth(c);
    const body = CreateCommentRequestSchema.parse(await c.req.json());
    const comment = await communityPostService.createComment(
      c.req.param('postId'),
      auth.sub,
      body,
    );
    return c.json({ comment }, 201);
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

communitiesMobileRoutes.post('/posts/:postId/report', async (c) => {
  try {
    const auth = requireMobileAuth(c);
    const body = ReportPostRequestSchema.parse(await c.req.json());
    await communityPostService.reportPost(c.req.param('postId'), auth.sub, body);
    return c.json({ success: true }, 201);
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

export const communitiesAdminRoutes = new Hono<AppEnv>();
communitiesAdminRoutes.use('*', requireAuth, requirePermission('catalog.read'));

communitiesAdminRoutes.get('/', async (c) => {
  try {
    const statusParam = c.req.query('status');
    let status: 'draft' | 'published' | 'archived' | undefined;
    if (statusParam === 'draft' || statusParam === 'published' || statusParam === 'archived') {
      status = statusParam;
    }
    const query = {
      status,
      search: c.req.query('search'),
      limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
      cursor: c.req.query('cursor'),
    };
    const validated = CommunityAdminQuerySchema.parse(query);
    const result = await communityService.listCommunities(validated);
    return c.json(result);
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

communitiesAdminRoutes.get('/:id', async (c) => {
  try {
    const community = await communityService.getCommunity(c.req.param('id'));
    if (!community) {
      return c.json(
        { error: { code: 'not_found', message: 'Community not found' } },
        404,
      );
    }
    return c.json({ community });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

communitiesAdminRoutes.patch('/:id', async (c) => {
  try {
    const body = UpdateCommunityRequestSchema.parse(await c.req.json());
    const community = await communityService.updateCommunity(c.req.param('id'), body);
    return c.json({ community });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

communitiesAdminRoutes.post('/:id/suspend', async (c) => {
  try {
    SuspendCommunityRequestSchema.parse(await c.req.json());
    const community = await communityService.suspendCommunity(c.req.param('id'));
    return c.json({ community });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

communitiesAdminRoutes.delete('/:id', async (c) => {
  try {
    await communityService.deleteCommunity(c.req.param('id'));
    return c.json({ success: true });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

communitiesAdminRoutes.get('/posts/reports', async (c) => {
  try {
    const query = {
      status: c.req.query('status') as 'open' | 'resolved' | undefined,
      limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
      cursor: c.req.query('cursor'),
    };
    const result = await communityPostService.listReports(query);
    return c.json(result);
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

communitiesAdminRoutes.post('/posts/:postId/remove', async (c) => {
  try {
    const post = await communityPostService.removePost(c.req.param('postId'));
    return c.json({ post });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

communitiesAdminRoutes.post('/posts/reports/:reportId/resolve', async (c) => {
  try {
    await communityPostService.resolveReport(c.req.param('reportId'));
    return c.json({ success: true });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});
