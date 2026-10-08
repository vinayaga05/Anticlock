import { and, desc, eq, sql } from 'drizzle-orm';
import type {
  CourseEnrollment,
  EnrollmentWithCourse,
  EnrollmentAdminListItem,
  LessonProgress,
} from '@anticlock/contracts';
import { db } from '../db/client.js';
import { courseEnrollments, courses, courseLessons, mobileUsers, mediaAssets } from '../db/schema.js';
import { parseCursorIso } from '../lib/cursor.js';

export class CourseEnrollmentService {
  async createEnrollment(
    mobileUserId: string,
    courseId: string,
  ): Promise<CourseEnrollment> {
    const [course] = await db.select().from(courses).where(eq(courses.id, courseId));
    if (!course) {
      throw Object.assign(new Error('Course not found'), {
        code: 'not_found',
        status: 404,
      });
    }

    const lessonCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(courseLessons)
      .where(eq(courseLessons.courseId, courseId));

    const totalLessons = Number(lessonCount[0]?.count ?? 0);

    const [row] = await db
      .insert(courseEnrollments)
      .values({
        courseId,
        mobileUserId,
        status: 'active',
        paymentStatus: 'pending',
        paymentAmount: course.price,
        progress: [],
        completedLessonsCount: 0,
        totalLessonsCount: totalLessons,
      })
      .returning();

    return this.mapEnrollmentRow(row!);
  }

  async getEnrollment(
    enrollmentId: string,
    mobileUserId: string,
  ): Promise<CourseEnrollment | null> {
    const [row] = await db
      .select()
      .from(courseEnrollments)
      .where(
        and(
          eq(courseEnrollments.id, enrollmentId),
          eq(courseEnrollments.mobileUserId, mobileUserId),
        ),
      );

    return row ? this.mapEnrollmentRow(row) : null;
  }

  async getEnrollmentByCourse(
    mobileUserId: string,
    courseId: string,
  ): Promise<CourseEnrollment | null> {
    const [row] = await db
      .select()
      .from(courseEnrollments)
      .where(
        and(
          eq(courseEnrollments.mobileUserId, mobileUserId),
          eq(courseEnrollments.courseId, courseId),
        ),
      );

    return row ? this.mapEnrollmentRow(row) : null;
  }

  async listEnrollments(
    mobileUserId: string,
    options: {
      status?: string;
      limit?: number;
      cursor?: string;
    } = {},
  ): Promise<{ enrollments: EnrollmentWithCourse[]; nextCursor: string | null }> {
    const limit = Math.min(options.limit ?? 20, 100);

    const conditions = [eq(courseEnrollments.mobileUserId, mobileUserId)];
    if (options.status) {
      conditions.push(eq(courseEnrollments.status, options.status));
    }
    if (options.cursor) {
      conditions.push(sql`${courseEnrollments.createdAt} < ${parseCursorIso(options.cursor)}`);
    }

    const rows = await db
      .select({
        enrollment: courseEnrollments,
        course: courses,
      })
      .from(courseEnrollments)
      .innerJoin(courses, eq(courseEnrollments.courseId, courses.id))
      .where(and(...conditions))
      .orderBy(desc(courseEnrollments.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);

    const enrollmentsWithImages = await Promise.all(
      items.map(async ({ enrollment, course }) => {
        let imageUrl: string | null = null;
        if (course.imageId) {
          const [media] = await db
            .select()
            .from(mediaAssets)
            .where(eq(mediaAssets.id, course.imageId));
          if (media) {
            imageUrl = this.buildMediaUrl(media);
          }
        }

        return {
          ...this.mapEnrollmentRow(enrollment),
          courseName: course.name,
          courseSlug: course.slug,
          imageUrl,
        };
      }),
    );

    return {
      enrollments: enrollmentsWithImages,
      nextCursor: hasMore
        ? items[items.length - 1]!.enrollment.createdAt.toISOString()
        : null,
    };
  }

  async markLessonComplete(
    enrollmentId: string,
    mobileUserId: string,
    lessonId: string,
    progressPercent?: number,
  ): Promise<CourseEnrollment | null> {
    const [enrollment] = await db
      .select()
      .from(courseEnrollments)
      .where(
        and(
          eq(courseEnrollments.id, enrollmentId),
          eq(courseEnrollments.mobileUserId, mobileUserId),
        ),
      );

    if (!enrollment) return null;

    const progress = (enrollment.progress as LessonProgress[]) ?? [];
    const existingIndex = progress.findIndex(p => p.lessonId === lessonId);

    if (existingIndex >= 0) {
      progress[existingIndex] = {
        lessonId,
        completedAt: new Date().toISOString(),
        progressPercent,
      };
    } else {
      progress.push({
        lessonId,
        completedAt: new Date().toISOString(),
        progressPercent,
      });
    }

    const completedCount = progress.length;
    const isComplete = completedCount >= enrollment.totalLessonsCount;

    const [updated] = await db
      .update(courseEnrollments)
      .set({
        progress: progress as unknown[],
        completedLessonsCount: completedCount,
        lastAccessedAt: new Date(),
        updatedAt: new Date(),
        status: isComplete ? 'completed' : enrollment.status,
        completedAt: isComplete && !enrollment.completedAt ? new Date() : enrollment.completedAt,
      })
      .where(eq(courseEnrollments.id, enrollmentId))
      .returning();

    return updated ? this.mapEnrollmentRow(updated) : null;
  }

  async listEnrollmentsAdmin(filters: {
    courseId?: string;
    userId?: string;
    status?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ enrollments: EnrollmentAdminListItem[]; nextCursor: string | null }> {
    const limit = Math.min(filters.limit ?? 20, 100);

    const conditions = [];
    if (filters.courseId) conditions.push(eq(courseEnrollments.courseId, filters.courseId));
    if (filters.userId) conditions.push(eq(courseEnrollments.mobileUserId, filters.userId));
    if (filters.status) conditions.push(eq(courseEnrollments.status, filters.status));
    if (filters.cursor) {
      conditions.push(sql`${courseEnrollments.createdAt} < ${parseCursorIso(filters.cursor)}`);
    }

    const rows = await db
      .select({
        enrollment: courseEnrollments,
        course: courses,
        user: mobileUsers,
      })
      .from(courseEnrollments)
      .innerJoin(courses, eq(courseEnrollments.courseId, courses.id))
      .innerJoin(mobileUsers, eq(courseEnrollments.mobileUserId, mobileUsers.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(courseEnrollments.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);

    return {
      enrollments: items.map(({ enrollment, course, user }) => ({
        ...this.mapEnrollmentRow(enrollment),
        userName: user.displayName,
        userPhone: user.phone,
        courseName: course.name,
      })),
      nextCursor: hasMore
        ? items[items.length - 1]!.enrollment.createdAt.toISOString()
        : null,
    };
  }

  private mapEnrollmentRow(row: typeof courseEnrollments.$inferSelect): CourseEnrollment {
    return {
      id: row.id,
      courseId: row.courseId,
      mobileUserId: row.mobileUserId,
      status: row.status as 'active' | 'completed' | 'dropped',
      paymentStatus: row.paymentStatus as 'pending' | 'paid' | 'failed' | 'refunded',
      paymentAmount: row.paymentAmount,
      progress: (row.progress as LessonProgress[]) ?? [],
      completedLessonsCount: row.completedLessonsCount,
      totalLessonsCount: row.totalLessonsCount,
      lastAccessedAt: row.lastAccessedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
    };
  }

  private buildMediaUrl(media: typeof mediaAssets.$inferSelect): string {
    if (media.storageProvider === 'external' && media.storageKey) {
      return media.storageKey;
    }
    if (media.storageProvider === 'r2') {
      return `${process.env.R2_PUBLIC_URL}/${media.storageKey}`;
    }
    if (media.storageProvider === 'local') {
      return `${process.env.API_BASE_URL}/media/${media.id}`;
    }
    return '';
  }
}

export const courseEnrollmentService = new CourseEnrollmentService();
