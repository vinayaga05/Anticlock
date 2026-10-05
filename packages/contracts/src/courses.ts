import { z } from 'zod';
import { PaymentStatusSchema, type PaymentStatus } from './payment.js';

export const CourseDifficultySchema = z.enum(['beginner', 'intermediate', 'advanced']);
export type CourseDifficulty = z.infer<typeof CourseDifficultySchema>;

export const CourseStatusSchema = z.enum(['draft', 'published', 'archived']);
export type CourseStatus = z.infer<typeof CourseStatusSchema>;

export const LessonTypeSchema = z.enum(['video', 'article', 'quiz', 'exercise']);
export type LessonType = z.infer<typeof LessonTypeSchema>;

export const CourseLessonSchema = z.object({
  id: z.string().uuid(),
  courseId: z.string().uuid(),
  moduleNumber: z.number().int().positive(),
  moduleName: z.string(),
  lessonNumber: z.number().int().positive(),
  title: z.string(),
  description: z.string().optional(),
  type: LessonTypeSchema,
  durationMinutes: z.number().int().positive().nullable(),
  contentUrl: z.string().url().optional(),
  contentText: z.string().optional(),
  mediaId: z.string().uuid().nullable(),
  sortOrder: z.number().int().default(0),
  isFree: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CourseLesson = z.infer<typeof CourseLessonSchema>;

export const CourseSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  shortDescription: z.string(),
  description: z.string(),
  difficulty: CourseDifficultySchema,
  durationHours: z.number().int().positive(),
  price: z.number().int().nonnegative(),
  compareAtPrice: z.number().int().positive().nullable(),
  imageId: z.string().uuid().nullable(),
  instructorName: z.string(),
  instructorBio: z.string().optional(),
  learningOutcomes: z.array(z.string()),
  prerequisites: z.array(z.string()),
  status: CourseStatusSchema,
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  publishedAt: z.string().datetime().nullable(),
});
export type Course = z.infer<typeof CourseSchema>;

export const CreateCourseRequestSchema = z.object({
  slug: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  shortDescription: z.string().min(1).max(500),
  description: z.string().max(5000),
  difficulty: CourseDifficultySchema,
  durationHours: z.number().int().positive(),
  price: z.number().int().nonnegative(),
  compareAtPrice: z.number().int().positive().nullable().optional(),
  imageId: z.string().uuid().nullable().optional(),
  instructorName: z.string().min(1).max(200),
  instructorBio: z.string().optional(),
  learningOutcomes: z.array(z.string()).optional(),
  prerequisites: z.array(z.string()).optional(),
  status: CourseStatusSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateCourseRequest = z.infer<typeof CreateCourseRequestSchema>;

export const UpdateCourseRequestSchema = CreateCourseRequestSchema.partial();
export type UpdateCourseRequest = z.infer<typeof UpdateCourseRequestSchema>;

export const CreateCourseLessonRequestSchema = z.object({
  moduleNumber: z.number().int().positive(),
  moduleName: z.string().min(1).max(200),
  lessonNumber: z.number().int().positive(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  type: LessonTypeSchema,
  durationMinutes: z.number().int().positive().nullable().optional(),
  contentUrl: z.string().url().optional(),
  contentText: z.string().optional(),
  mediaId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isFree: z.boolean().optional(),
});
export type CreateCourseLessonRequest = z.infer<typeof CreateCourseLessonRequestSchema>;

export const UpdateCourseLessonRequestSchema = CreateCourseLessonRequestSchema.partial();
export type UpdateCourseLessonRequest = z.infer<typeof UpdateCourseLessonRequestSchema>;

export const CourseWithLessonsSchema = CourseSchema.extend({
  lessons: z.array(CourseLessonSchema),
  imageUrl: z.string().url().nullable(),
});
export type CourseWithLessons = z.infer<typeof CourseWithLessonsSchema>;

export const CourseListQuerySchema = z.object({
  difficulty: CourseDifficultySchema.optional(),
  status: CourseStatusSchema.optional(),
  search: z.string().optional(),
  limit: z.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});
export type CourseListQuery = z.infer<typeof CourseListQuerySchema>;

export const CourseListResponseSchema = z.object({
  courses: z.array(CourseSchema),
  nextCursor: z.string().nullable(),
});
export type CourseListResponse = z.infer<typeof CourseListResponseSchema>;

export const EnrollmentStatusSchema = z.enum(['active', 'completed', 'dropped']);
export type EnrollmentStatus = z.infer<typeof EnrollmentStatusSchema>;


export const LessonProgressSchema = z.object({
  lessonId: z.string().uuid(),
  completedAt: z.string().datetime(),
  progressPercent: z.number().int().min(0).max(100).optional(),
});
export type LessonProgress = z.infer<typeof LessonProgressSchema>;

export const CourseEnrollmentSchema = z.object({
  id: z.string().uuid(),
  courseId: z.string().uuid(),
  mobileUserId: z.string().uuid(),
  status: EnrollmentStatusSchema,
  paymentStatus: PaymentStatusSchema,
  paymentAmount: z.number().int().nonnegative(),
  progress: z.array(LessonProgressSchema),
  completedLessonsCount: z.number().int().nonnegative(),
  totalLessonsCount: z.number().int().nonnegative(),
  lastAccessedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
});
export type CourseEnrollment = z.infer<typeof CourseEnrollmentSchema>;

export const CreateEnrollmentRequestSchema = z.object({
  courseId: z.string().uuid(),
});
export type CreateEnrollmentRequest = z.infer<typeof CreateEnrollmentRequestSchema>;

export const MarkLessonCompleteRequestSchema = z.object({
  lessonId: z.string().uuid(),
  progressPercent: z.number().int().min(0).max(100).optional(),
});
export type MarkLessonCompleteRequest = z.infer<typeof MarkLessonCompleteRequestSchema>;

export const EnrollmentWithCourseSchema = CourseEnrollmentSchema.extend({
  courseName: z.string(),
  courseSlug: z.string(),
  imageUrl: z.string().url().nullable(),
});
export type EnrollmentWithCourse = z.infer<typeof EnrollmentWithCourseSchema>;

export const EnrollmentListQuerySchema = z.object({
  status: EnrollmentStatusSchema.optional(),
  limit: z.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});
export type EnrollmentListQuery = z.infer<typeof EnrollmentListQuerySchema>;

export const EnrollmentAdminListItemSchema = CourseEnrollmentSchema.extend({
  userName: z.string(),
  userPhone: z.string(),
  courseName: z.string(),
});
export type EnrollmentAdminListItem = z.infer<typeof EnrollmentAdminListItemSchema>;

export const EnrollmentAdminQuerySchema = z.object({
  courseId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  status: EnrollmentStatusSchema.optional(),
  limit: z.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});
export type EnrollmentAdminQuery = z.infer<typeof EnrollmentAdminQuerySchema>;
