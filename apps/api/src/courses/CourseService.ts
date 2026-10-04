import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import type {
  Course,
  CourseWithLessons,
  CreateCourseRequest,
  UpdateCourseRequest,
  CourseLesson,
} from '@anticlock/contracts';
import { db } from '../db/client.js';
import { courses, courseLessons, mediaAssets } from '../db/schema.js';

export class CourseService {
  async createCourse(request: CreateCourseRequest): Promise<Course> {
    const [row] = await db
      .insert(courses)
      .values({
        slug: request.slug,
        name: request.name,
        shortDescription: request.shortDescription,
        description: request.description,
        difficulty: request.difficulty,
        durationHours: request.durationHours,
        price: request.price,
        compareAtPrice: request.compareAtPrice ?? null,
        imageId: request.imageId ?? null,
        instructorName: request.instructorName,
        instructorBio: request.instructorBio ?? null,
        learningOutcomes: (request.learningOutcomes ?? []) as unknown[],
        prerequisites: (request.prerequisites ?? []) as unknown[],
        status: request.status ?? 'draft',
        metadata: request.metadata ?? null,
        publishedAt: request.status === 'published' ? new Date() : null,
      })
      .returning();

    return this.mapCourseRow(row!);
  }

  async getCourse(courseId: string): Promise<Course | null> {
    const [row] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId));

    return row ? this.mapCourseRow(row) : null;
  }

  async getCourseBySlug(slug: string): Promise<Course | null> {
    const [row] = await db
      .select()
      .from(courses)
      .where(eq(courses.slug, slug));

    return row ? this.mapCourseRow(row) : null;
  }

  async getCourseWithLessons(courseId: string): Promise<CourseWithLessons | null> {
    const [courseRow] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId));

    if (!courseRow) return null;

    const lessonRows = await db
      .select()
      .from(courseLessons)
      .where(eq(courseLessons.courseId, courseId))
      .orderBy(courseLessons.sortOrder, courseLessons.moduleNumber, courseLessons.lessonNumber);

    let imageUrl: string | null = null;
    if (courseRow.imageId) {
      const [media] = await db
        .select()
        .from(mediaAssets)
        .where(eq(mediaAssets.id, courseRow.imageId));
      if (media) {
        imageUrl = this.buildMediaUrl(media);
      }
    }

    return {
      ...this.mapCourseRow(courseRow),
      lessons: lessonRows.map(l => this.mapLessonRow(l)),
      imageUrl,
    };
  }

  async listCourses(options: {
    difficulty?: string;
    status?: string;
    search?: string;
    limit?: number;
    cursor?: string;
  } = {}): Promise<{ courses: Course[]; nextCursor: string | null }> {
    const limit = Math.min(options.limit ?? 20, 100);

    const conditions = [];
    if (options.difficulty) {
      conditions.push(eq(courses.difficulty, options.difficulty));
    }
    if (options.status) {
      conditions.push(eq(courses.status, options.status));
    }
    if (options.search) {
      const searchPattern = `%${options.search}%`;
      conditions.push(
        or(
          ilike(courses.name, searchPattern),
          ilike(courses.description, searchPattern),
          ilike(courses.instructorName, searchPattern),
        )!,
      );
    }
    if (options.cursor) {
      conditions.push(sql`${courses.createdAt} < ${new Date(options.cursor)}`);
    }

    const rows = await db
      .select()
      .from(courses)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(courses.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);

    return {
      courses: items.map(row => this.mapCourseRow(row)),
      nextCursor: hasMore ? items[items.length - 1]!.createdAt.toISOString() : null,
    };
  }

  async updateCourse(
    courseId: string,
    update: UpdateCourseRequest,
  ): Promise<Course | null> {
    const values: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (update.slug) values.slug = update.slug;
    if (update.name) values.name = update.name;
    if (update.shortDescription) values.shortDescription = update.shortDescription;
    if (update.description) values.description = update.description;
    if (update.difficulty) values.difficulty = update.difficulty;
    if (update.durationHours) values.durationHours = update.durationHours;
    if (update.price !== undefined) values.price = update.price;
    if (update.compareAtPrice !== undefined) values.compareAtPrice = update.compareAtPrice;
    if (update.imageId !== undefined) values.imageId = update.imageId;
    if (update.instructorName) values.instructorName = update.instructorName;
    if (update.instructorBio !== undefined) values.instructorBio = update.instructorBio;
    if (update.learningOutcomes) values.learningOutcomes = update.learningOutcomes as unknown[];
    if (update.prerequisites) values.prerequisites = update.prerequisites as unknown[];
    if (update.metadata) values.metadata = update.metadata;
    
    if (update.status) {
      values.status = update.status;
      if (update.status === 'published') {
        const [existing] = await db.select().from(courses).where(eq(courses.id, courseId));
        if (existing && !existing.publishedAt) {
          values.publishedAt = new Date();
        }
      } else if (update.status === 'draft') {
        values.publishedAt = null;
      }
    }

    const [row] = await db
      .update(courses)
      .set(values)
      .where(eq(courses.id, courseId))
      .returning();

    return row ? this.mapCourseRow(row) : null;
  }

  async deleteCourse(courseId: string): Promise<boolean> {
    const result = await db.delete(courses).where(eq(courses.id, courseId));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  private mapCourseRow(row: typeof courses.$inferSelect): Course {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      shortDescription: row.shortDescription,
      description: row.description,
      difficulty: row.difficulty as 'beginner' | 'intermediate' | 'advanced',
      durationHours: row.durationHours,
      price: row.price,
      compareAtPrice: row.compareAtPrice,
      imageId: row.imageId,
      instructorName: row.instructorName,
      instructorBio: row.instructorBio ?? undefined,
      learningOutcomes: (row.learningOutcomes as string[]) ?? [],
      prerequisites: (row.prerequisites as string[]) ?? [],
      status: row.status as 'draft' | 'published' | 'archived',
      metadata: row.metadata ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      publishedAt: row.publishedAt?.toISOString() ?? null,
    };
  }

  private mapLessonRow(row: typeof courseLessons.$inferSelect): CourseLesson {
    return {
      id: row.id,
      courseId: row.courseId,
      moduleNumber: row.moduleNumber,
      moduleName: row.moduleName,
      lessonNumber: row.lessonNumber,
      title: row.title,
      description: row.description ?? undefined,
      type: row.type as 'video' | 'article' | 'quiz' | 'exercise',
      durationMinutes: row.durationMinutes,
      contentUrl: row.contentUrl ?? undefined,
      contentText: row.contentText ?? undefined,
      mediaId: row.mediaId,
      sortOrder: row.sortOrder,
      isFree: row.isFree,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
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

export const courseService = new CourseService();
