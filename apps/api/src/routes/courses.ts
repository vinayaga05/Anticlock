import { Hono } from 'hono';
import {
  CourseListQuerySchema,
  CreateCourseRequestSchema,
  CreateCourseLessonRequestSchema,
  CreateEnrollmentRequestSchema,
  EnrollmentAdminQuerySchema,
  EnrollmentListQuerySchema,
  MarkLessonCompleteRequestSchema,
  UpdateCourseRequestSchema,
  UpdateCourseLessonRequestSchema,
} from '@anticlock/contracts';
import { courseService } from '../courses/CourseService.js';
import { courseLessonService } from '../courses/CourseLessonService.js';
import { courseEnrollmentService } from '../courses/CourseEnrollmentService.js';
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

export const coursesMobileRoutes = new Hono<AppEnv>();
coursesMobileRoutes.use('*', requireAuth);

coursesMobileRoutes.get('/', async c => {
  try {
    const query = {
      difficulty: c.req.query('difficulty'),
      status: 'published',
      search: c.req.query('search'),
      limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
      cursor: c.req.query('cursor'),
    };
    const validated = CourseListQuerySchema.parse(query);
    const result = await courseService.listCourses(validated);
    return c.json(result);
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

coursesMobileRoutes.get('/:id', async c => {
  try {
    const course = await courseService.getCourseWithLessons(c.req.param('id'));
    if (!course || course.status !== 'published') {
      return c.json(
        { error: { code: 'not_found', message: 'Course not found' } },
        404,
      );
    }
    return c.json({ course });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

coursesMobileRoutes.post('/:id/enroll', async c => {
  try {
    const auth = requireMobileAuth(c);
    const courseId = c.req.param('id');

    const existing = await courseEnrollmentService.getEnrollmentByCourse(
      auth.sub,
      courseId,
    );
    if (existing) {
      return c.json(
        {
          error: {
            code: 'already_enrolled',
            message: 'Already enrolled in this course',
          },
        },
        409,
      );
    }

    const enrollment = await courseEnrollmentService.createEnrollment(
      auth.sub,
      courseId,
    );
    return c.json({ enrollment }, 201);
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

coursesMobileRoutes.get('/enrollments', async c => {
  try {
    const auth = requireMobileAuth(c);
    const query = {
      status: c.req.query('status'),
      limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
      cursor: c.req.query('cursor'),
    };
    const validated = EnrollmentListQuerySchema.parse(query);
    const result = await courseEnrollmentService.listEnrollments(
      auth.sub,
      validated,
    );
    return c.json(result);
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

coursesMobileRoutes.get('/enrollments/:id', async c => {
  try {
    const auth = requireMobileAuth(c);
    const enrollment = await courseEnrollmentService.getEnrollment(
      c.req.param('id'),
      auth.sub,
    );
    if (!enrollment) {
      return c.json(
        { error: { code: 'not_found', message: 'Enrollment not found' } },
        404,
      );
    }
    return c.json({ enrollment });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

coursesMobileRoutes.post('/enrollments/:id/lessons/complete', async c => {
  try {
    const auth = requireMobileAuth(c);
    const body = MarkLessonCompleteRequestSchema.parse(await c.req.json());
    const enrollment = await courseEnrollmentService.markLessonComplete(
      c.req.param('id'),
      auth.sub,
      body.lessonId,
      body.progressPercent,
    );
    if (!enrollment) {
      return c.json(
        { error: { code: 'not_found', message: 'Enrollment not found' } },
        404,
      );
    }
    return c.json({ enrollment });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

export const coursesAdminRoutes = new Hono<AppEnv>();
coursesAdminRoutes.use('*', requireAuth);

coursesAdminRoutes.get(
  '/',
  requirePermission('catalog.read'),
  async c => {
    try {
      const query = {
        difficulty: c.req.query('difficulty'),
        status: c.req.query('status'),
        search: c.req.query('search'),
        limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
        cursor: c.req.query('cursor'),
      };
      const validated = CourseListQuerySchema.parse(query);
      const result = await courseService.listCourses(validated);
      return c.json(result);
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

coursesAdminRoutes.post(
  '/',
  requirePermission('catalog.write'),
  async c => {
    try {
      const body = CreateCourseRequestSchema.parse(await c.req.json());
      const course = await courseService.createCourse(body);
      return c.json({ course }, 201);
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

coursesAdminRoutes.get(
  '/:id',
  requirePermission('catalog.read'),
  async c => {
    try {
      const course = await courseService.getCourseWithLessons(c.req.param('id'));
      if (!course) {
        return c.json(
          { error: { code: 'not_found', message: 'Course not found' } },
          404,
        );
      }
      return c.json({ course });
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

coursesAdminRoutes.patch(
  '/:id',
  requirePermission('catalog.write'),
  async c => {
    try {
      const body = UpdateCourseRequestSchema.parse(await c.req.json());
      const course = await courseService.updateCourse(c.req.param('id'), body);
      if (!course) {
        return c.json(
          { error: { code: 'not_found', message: 'Course not found' } },
          404,
        );
      }
      return c.json({ course });
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

coursesAdminRoutes.delete(
  '/:id',
  requirePermission('catalog.write'),
  async c => {
    try {
      const success = await courseService.deleteCourse(c.req.param('id'));
      if (!success) {
        return c.json(
          { error: { code: 'not_found', message: 'Course not found' } },
          404,
        );
      }
      return c.json({ success: true });
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

coursesAdminRoutes.post(
  '/:id/lessons',
  requirePermission('catalog.write'),
  async c => {
    try {
      const body = CreateCourseLessonRequestSchema.parse(await c.req.json());
      const lesson = await courseLessonService.createLesson(
        c.req.param('id'),
        body,
      );
      return c.json({ lesson }, 201);
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

coursesAdminRoutes.patch(
  '/:courseId/lessons/:id',
  requirePermission('catalog.write'),
  async c => {
    try {
      const body = UpdateCourseLessonRequestSchema.parse(await c.req.json());
      const lesson = await courseLessonService.updateLesson(
        c.req.param('id'),
        body,
      );
      if (!lesson) {
        return c.json(
          { error: { code: 'not_found', message: 'Lesson not found' } },
          404,
        );
      }
      return c.json({ lesson });
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

coursesAdminRoutes.delete(
  '/:courseId/lessons/:id',
  requirePermission('catalog.write'),
  async c => {
    try {
      const success = await courseLessonService.deleteLesson(c.req.param('id'));
      if (!success) {
        return c.json(
          { error: { code: 'not_found', message: 'Lesson not found' } },
          404,
        );
      }
      return c.json({ success: true });
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

coursesAdminRoutes.get(
  '/enrollments',
  requirePermission('catalog.read'),
  async c => {
    try {
      const query = {
        courseId: c.req.query('courseId'),
        userId: c.req.query('userId'),
        status: c.req.query('status'),
        limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
        cursor: c.req.query('cursor'),
      };
      const validated = EnrollmentAdminQuerySchema.parse(query);
      const result = await courseEnrollmentService.listEnrollmentsAdmin(validated);
      return c.json(result);
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);
