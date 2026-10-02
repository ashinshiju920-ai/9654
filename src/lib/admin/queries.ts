import "server-only";

import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";

import { withDb } from "@/lib/db";
import {
  coursePdfs,
  courses,
  questions,
  quizAttempts,
  users,
} from "@/lib/db/schema";

export type AdminDashboardStats = {
  totalStudents: number;
  activeStudents: number;
  totalCourses: number;
  publishedMaterials: number;
  totalQuestions: number;
  totalAttempts: number;
  averageQuizScore: number;
  courseSummaries: Array<{
    id: string;
    slug: string;
    name: string;
    displayOrder: number;
    isActive: boolean;
    materialCount: number;
    questionCount: number;
  }>;
};

export async function getAdminStats(): Promise<AdminDashboardStats> {
  return withDb(async (db) => {
    // 1. Student counts
    const [studentStats] = await db
      .select({
        total: count(users.id),
        active: sql<number>`count(case when ${users.accountStatus} = 'active' then 1 end)`,
      })
      .from(users)
      .where(eq(users.role, "student"));

    // 2. Published materials count
    const [materialsStats] = await db
      .select({
        total: count(coursePdfs.id),
        published: sql<number>`count(case when ${coursePdfs.isPublished} = true then 1 end)`,
      })
      .from(coursePdfs);

    // 3. Questions count
    const [questionsStats] = await db
      .select({
        total: count(questions.id),
      })
      .from(questions);

    // 4. Attempts stats
    const [attemptStats] = await db
      .select({
        total: count(quizAttempts.id),
        avgPercentage: sql<string>`coalesce(round(avg(${quizAttempts.percentage}), 1), 0)`,
      })
      .from(quizAttempts);

    // 5. Course list with counts
    const courseRows = await db
      .select({
        id: courses.id,
        slug: courses.slug,
        name: courses.name,
        displayOrder: courses.displayOrder,
        isActive: courses.isActive,
      })
      .from(courses)
      .orderBy(asc(courses.displayOrder));

    const courseSummaries = await Promise.all(
      courseRows.map(async (c) => {
        const [pdfCount] = await db
          .select({ count: count(coursePdfs.id) })
          .from(coursePdfs)
          .where(eq(coursePdfs.courseId, c.id));

        const [qCount] = await db
          .select({ count: count(questions.id) })
          .from(questions)
          .where(eq(questions.courseId, c.id));

        return {
          id: c.id,
          slug: c.slug,
          name: c.name,
          displayOrder: c.displayOrder,
          isActive: c.isActive,
          materialCount: Number(pdfCount?.count || 0),
          questionCount: Number(qCount?.count || 0),
        };
      }),
    );

    return {
      totalStudents: Number(studentStats?.total || 0),
      activeStudents: Number(studentStats?.active || 0),
      totalCourses: courseRows.length,
      publishedMaterials: Number(materialsStats?.published || 0),
      totalQuestions: Number(questionsStats?.total || 0),
      totalAttempts: Number(attemptStats?.total || 0),
      averageQuizScore: Number(attemptStats?.avgPercentage || 0),
      courseSummaries,
    };
  });
}

export type AdminCourseItem = {
  id: string;
  slug: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  materialCount: number;
  questionCount: number;
  createdAt: string;
};

export async function getAdminCourses(): Promise<AdminCourseItem[]> {
  return withDb(async (db) => {
    const list = await db
      .select()
      .from(courses)
      .orderBy(asc(courses.displayOrder));

    const result: AdminCourseItem[] = [];
    for (const c of list) {
      const [m] = await db
        .select({ count: count(coursePdfs.id) })
        .from(coursePdfs)
        .where(eq(coursePdfs.courseId, c.id));

      const [q] = await db
        .select({ count: count(questions.id) })
        .from(questions)
        .where(eq(questions.courseId, c.id));

      result.push({
        id: c.id,
        slug: c.slug,
        name: c.name,
        displayOrder: c.displayOrder,
        isActive: c.isActive,
        materialCount: Number(m?.count || 0),
        questionCount: Number(q?.count || 0),
        createdAt: c.createdAt.toISOString(),
      });
    }

    return result;
  });
}

export type AdminMaterialItem = {
  id: string;
  courseId: string;
  courseSlug: string;
  courseName: string;
  title: string;
  description: string | null;
  r2ObjectKey: string;
  fileSizeBytes: number | null;
  mimeType: string;
  isPublished: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

export async function getAdminMaterials(courseSlug?: string): Promise<AdminMaterialItem[]> {
  return withDb(async (db) => {
    const query = db
      .select({
        id: coursePdfs.id,
        courseId: coursePdfs.courseId,
        courseSlug: courses.slug,
        courseName: courses.name,
        title: coursePdfs.title,
        description: coursePdfs.description,
        r2ObjectKey: coursePdfs.r2ObjectKey,
        fileSizeBytes: coursePdfs.fileSizeBytes,
        mimeType: coursePdfs.mimeType,
        isPublished: coursePdfs.isPublished,
        displayOrder: coursePdfs.displayOrder,
        createdAt: coursePdfs.createdAt,
        updatedAt: coursePdfs.updatedAt,
      })
      .from(coursePdfs)
      .innerJoin(courses, eq(coursePdfs.courseId, courses.id))
      .orderBy(asc(courses.displayOrder), asc(coursePdfs.displayOrder), desc(coursePdfs.createdAt));

    if (courseSlug) {
      query.where(eq(courses.slug, courseSlug));
    }

    const rows = await query;
    return rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  });
}

export type AdminQuestionItem = {
  id: string;
  courseId: string;
  courseSlug: string;
  courseName: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  explanation: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function getAdminQuestions(options: {
  courseSlug?: string;
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}): Promise<{
  questions: AdminQuestionItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20));
  const offset = (page - 1) * limit;

  return withDb(async (db) => {
    const conditions = [];

    if (options.courseSlug) {
      conditions.push(eq(courses.slug, options.courseSlug));
    }
    if (typeof options.isActive === "boolean") {
      conditions.push(eq(questions.isActive, options.isActive));
    }
    if (options.search && options.search.trim()) {
      const pattern = `%${options.search.trim()}%`;
      conditions.push(
        or(
          ilike(questions.questionText, pattern),
          ilike(questions.optionA, pattern),
          ilike(questions.optionB, pattern),
          ilike(questions.optionC, pattern),
          ilike(questions.optionD, pattern),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow] = await db
      .select({ count: count(questions.id) })
      .from(questions)
      .innerJoin(courses, eq(questions.courseId, courses.id))
      .where(whereClause);

    const total = Number(totalRow?.count || 0);

    const rows = await db
      .select({
        id: questions.id,
        courseId: questions.courseId,
        courseSlug: courses.slug,
        courseName: courses.name,
        questionText: questions.questionText,
        optionA: questions.optionA,
        optionB: questions.optionB,
        optionC: questions.optionC,
        optionD: questions.optionD,
        correctOption: questions.correctOption,
        explanation: questions.explanation,
        isActive: questions.isActive,
        createdAt: questions.createdAt,
        updatedAt: questions.updatedAt,
      })
      .from(questions)
      .innerJoin(courses, eq(questions.courseId, courses.id))
      .where(whereClause)
      .orderBy(desc(questions.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      questions: rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  });
}

export type AdminStudentItem = {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  accountStatus: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  quizAttemptsCount: number;
  lastAttemptAt: string | null;
};

export async function getAdminStudents(options: {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<{
  students: AdminStudentItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20));
  const offset = (page - 1) * limit;

  return withDb(async (db) => {
    const conditions = [];

    if (options.status) {
      conditions.push(eq(users.accountStatus, options.status));
    }
    if (options.search && options.search.trim()) {
      const pattern = `%${options.search.trim()}%`;
      conditions.push(
        or(ilike(users.email, pattern), ilike(users.fullName, pattern)),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow] = await db
      .select({ count: count(users.id) })
      .from(users)
      .where(whereClause);

    const total = Number(totalRow?.count || 0);

    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        accountStatus: users.accountStatus,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    const students: AdminStudentItem[] = [];

    for (const u of rows) {
      const [attemptSummary] = await db
        .select({
          count: count(quizAttempts.id),
          lastAttempt: sql<Date | null>`max(${quizAttempts.createdAt})`,
        })
        .from(quizAttempts)
        .where(eq(quizAttempts.userId, u.id));

      students.push({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        accountStatus: u.accountStatus,
        emailVerified: u.emailVerified,
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
        quizAttemptsCount: Number(attemptSummary?.count || 0),
        lastAttemptAt: attemptSummary?.lastAttempt
          ? new Date(attemptSummary.lastAttempt).toISOString()
          : null,
      });
    }

    return {
      students,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  });
}
