import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testClient } from 'hono/testing';
import { coursesMobileRoutes } from './courses.js';
import { db } from '../db/client.js';
import { courses, courseLessons, courseEnrollments, mobileUsers } from '../db/schema.js';
import { eq } from 'drizzle-orm';

describe('Courses API Routes', () => {
  let testUserId: string;
  let testCourseId: string;
  let authToken: string;

  beforeAll(async () => {
    const [user] = await db
      .insert(mobileUsers)
      .values({
        phone: '+919876543210',
        displayName: 'Test User',
      })
      .returning();
    testUserId = user.id;

    authToken = 'mock-token';

    const [course] = await db
      .insert(courses)
      .values({
        slug: 'test-course',
        name: 'Test Course',
        shortDescription: 'A test course',
        description: 'This is a test course description',
        difficulty: 'beginner',
        durationHours: 10,
        price: 9900,
        instructorName: 'Test Instructor',
        status: 'published',
        publishedAt: new Date(),
      })
      .returning();
    testCourseId = course.id;

    await db.insert(courseLessons).values({
      courseId: testCourseId,
      moduleNumber: 1,
      moduleName: 'Introduction',
      lessonNumber: 1,
      title: 'Welcome',
      type: 'video',
      sortOrder: 1,
    });
  });

  afterAll(async () => {
    if (testCourseId) {
      await db.delete(courseEnrollments).where(eq(courseEnrollments.courseId, testCourseId));
      await db.delete(courseLessons).where(eq(courseLessons.courseId, testCourseId));
      await db.delete(courses).where(eq(courses.id, testCourseId));
    }
    if (testUserId) {
      await db.delete(mobileUsers).where(eq(mobileUsers.id, testUserId));
    }
  });

  describe('GET /courses', () => {
    it('should return published courses list', async () => {
      const client = testClient(coursesMobileRoutes);
      
      const mockEnv = {
        Variables: {
          auth: { kind: 'mobile', sub: testUserId },
        },
      };

      const res = await client.$get('/', undefined, mockEnv as any);
      
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('courses');
      expect(Array.isArray(data.courses)).toBe(true);
    });
  });

  describe('GET /courses/:id', () => {
    it('should return course detail with lessons', async () => {
      const client = testClient(coursesMobileRoutes);
      
      const mockEnv = {
        Variables: {
          auth: { kind: 'mobile', sub: testUserId },
        },
      };

      const res = await client[':id'].$get({ param: { id: testCourseId } }, mockEnv as any);
      
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('course');
      expect(data.course.id).toBe(testCourseId);
      expect(data.course).toHaveProperty('lessons');
    });
  });

  describe('POST /courses/:id/enroll', () => {
    it('should enroll user in a course', async () => {
      const client = testClient(coursesMobileRoutes);
      
      const mockEnv = {
        Variables: {
          auth: { kind: 'mobile', sub: testUserId },
        },
      };

      const res = await client[':id'].enroll.$post(
        { param: { id: testCourseId } },
        mockEnv as any,
      );
      
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data).toHaveProperty('enrollment');
      expect(data.enrollment.courseId).toBe(testCourseId);
      expect(data.enrollment.mobileUserId).toBe(testUserId);
    });

    it('should not allow duplicate enrollment', async () => {
      const client = testClient(coursesMobileRoutes);
      
      const mockEnv = {
        Variables: {
          auth: { kind: 'mobile', sub: testUserId },
        },
      };

      const res = await client[':id'].enroll.$post(
        { param: { id: testCourseId } },
        mockEnv as any,
      );
      
      expect(res.status).toBe(409);
    });
  });
});
