import "server-only";

import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";

import { withDb } from "@/lib/db";
import {
  advancedCollections,
  advancedQuestions,
  advancedQuizAttemptQuestions,
  advancedQuizAttempts,
  advancedStudentAnswers,
  courses,
} from "@/lib/db/schema";
import { logAdminAudit } from "./audit";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(id: string): boolean {
  return typeof id === "string" && UUID_REGEX.test(id);
}

export type AdvancedHealthCourseStats = {
  courseId: string;
  courseName: string;
  courseSlug: string;
  totalCollections: number;
  publishedCollections: number;
  totalQuestions: number;
  activeQuestions: number;
};

export type AdvancedHealthSummary = {
  courses: AdvancedHealthCourseStats[];
  totalCollections: number;
  publishedCollections: number;
  totalQuestions: number;
  activeQuestions: number;
};

/**
 * Advanced Practice Health Overview
 * Returns actual, verified database counts per course.
 */
export async function getAdvancedHealthOverview(): Promise<AdvancedHealthSummary> {
  return withDb(async (db) => {
    // 1. Get all courses
    const allCourses = await db
      .select({
        id: courses.id,
        name: courses.name,
        slug: courses.slug,
        displayOrder: courses.displayOrder,
      })
      .from(courses)
      .orderBy(asc(courses.displayOrder));

    // 2. Aggregate collections per course
    const collectionCounts = await db
      .select({
        courseId: advancedCollections.courseId,
        total: sql<number>`count(${advancedCollections.id})::int`,
        published: sql<number>`count(case when ${advancedCollections.isPublished} then 1 end)::int`,
      })
      .from(advancedCollections)
      .groupBy(advancedCollections.courseId);

    const colMap = new Map<string, { total: number; published: number }>();
    for (const c of collectionCounts) {
      colMap.set(c.courseId, { total: c.total, published: c.published });
    }

    // 3. Aggregate questions per course (via collection relationship)
    const questionCounts = await db
      .select({
        courseId: advancedCollections.courseId,
        total: sql<number>`count(${advancedQuestions.id})::int`,
        active: sql<number>`count(case when ${advancedQuestions.isActive} then 1 end)::int`,
      })
      .from(advancedQuestions)
      .innerJoin(
        advancedCollections,
        eq(advancedQuestions.collectionId, advancedCollections.id),
      )
      .groupBy(advancedCollections.courseId);

    const qMap = new Map<string, { total: number; active: number }>();
    for (const q of questionCounts) {
      qMap.set(q.courseId, { total: q.total, active: q.active });
    }

    const courseStats: AdvancedHealthCourseStats[] = allCourses.map((c) => {
      const col = colMap.get(c.id) || { total: 0, published: 0 };
      const q = qMap.get(c.id) || { total: 0, active: 0 };
      return {
        courseId: c.id,
        courseName: c.name,
        courseSlug: c.slug,
        totalCollections: col.total,
        publishedCollections: col.published,
        totalQuestions: q.total,
        activeQuestions: q.active,
      };
    });

    const totalCollections = courseStats.reduce((sum, c) => sum + c.totalCollections, 0);
    const publishedCollections = courseStats.reduce((sum, c) => sum + c.publishedCollections, 0);
    const totalQuestions = courseStats.reduce((sum, c) => sum + c.totalQuestions, 0);
    const activeQuestions = courseStats.reduce((sum, c) => sum + c.activeQuestions, 0);

    return {
      courses: courseStats,
      totalCollections,
      publishedCollections,
      totalQuestions,
      activeQuestions,
    };
  });
}

/**
 * Retrieve Advanced Collections with question counts
 */
export async function getAdvancedCollections(options?: {
  courseSlug?: string;
  isPublished?: boolean;
  search?: string;
}) {
  return withDb(async (db) => {
    let query = db
      .select({
        id: advancedCollections.id,
        courseId: advancedCollections.courseId,
        courseName: courses.name,
        courseSlug: courses.slug,
        title: advancedCollections.title,
        slug: advancedCollections.slug,
        description: advancedCollections.description,
        displayOrder: advancedCollections.displayOrder,
        isPublished: advancedCollections.isPublished,
        createdAt: advancedCollections.createdAt,
        updatedAt: advancedCollections.updatedAt,
        questionCount: sql<number>`count(${advancedQuestions.id})::int`,
        activeQuestionCount: sql<number>`count(case when ${advancedQuestions.isActive} then 1 end)::int`,
      })
      .from(advancedCollections)
      .innerJoin(courses, eq(advancedCollections.courseId, courses.id))
      .leftJoin(advancedQuestions, eq(advancedQuestions.collectionId, advancedCollections.id))
      .groupBy(
        advancedCollections.id,
        courses.id,
        courses.name,
        courses.slug,
      )
      .orderBy(asc(courses.displayOrder), asc(advancedCollections.displayOrder), asc(advancedCollections.createdAt));

    const conditions = [];

    if (options?.courseSlug) {
      conditions.push(eq(courses.slug, options.courseSlug));
    }

    if (typeof options?.isPublished === "boolean") {
      conditions.push(eq(advancedCollections.isPublished, options.isPublished));
    }

    if (options?.search && options.search.trim()) {
      const term = `%${options.search.trim()}%`;
      conditions.push(
        or(
          ilike(advancedCollections.title, term),
          ilike(advancedCollections.slug, term),
          ilike(advancedCollections.description, term),
        ),
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    return query;
  });
}

/**
 * Retrieve single Advanced Collection by ID
 */
export async function getAdvancedCollectionById(id: string) {
  if (!isValidUuid(id)) {
    return null;
  }

  return withDb(async (db) => {
    const rows = await db
      .select({
        id: advancedCollections.id,
        courseId: advancedCollections.courseId,
        courseName: courses.name,
        courseSlug: courses.slug,
        title: advancedCollections.title,
        slug: advancedCollections.slug,
        description: advancedCollections.description,
        displayOrder: advancedCollections.displayOrder,
        isPublished: advancedCollections.isPublished,
        createdAt: advancedCollections.createdAt,
        updatedAt: advancedCollections.updatedAt,
      })
      .from(advancedCollections)
      .innerJoin(courses, eq(advancedCollections.courseId, courses.id))
      .where(eq(advancedCollections.id, id))
      .limit(1);

    return rows[0] || null;
  });
}

/**
 * Retrieve single Advanced Collection by course slug and collection slug
 */
export async function getAdvancedCollectionBySlug(courseSlug: string, collectionSlug: string) {
  return withDb(async (db) => {
    const rows = await db
      .select({
        id: advancedCollections.id,
        courseId: advancedCollections.courseId,
        courseName: courses.name,
        courseSlug: courses.slug,
        title: advancedCollections.title,
        slug: advancedCollections.slug,
        description: advancedCollections.description,
        displayOrder: advancedCollections.displayOrder,
        isPublished: advancedCollections.isPublished,
        createdAt: advancedCollections.createdAt,
        updatedAt: advancedCollections.updatedAt,
      })
      .from(advancedCollections)
      .innerJoin(courses, eq(advancedCollections.courseId, courses.id))
      .where(
        and(
          eq(courses.slug, courseSlug),
          eq(advancedCollections.slug, collectionSlug.toLowerCase().trim()),
        ),
      )
      .limit(1);

    return rows[0] || null;
  });
}

/**
 * Create a new Advanced Collection
 */
export async function createAdvancedCollection(
  adminUserId: string,
  input: {
    courseSlugOrId: string;
    title: string;
    slug: string;
    description?: string;
    displayOrder?: number;
    isPublished?: boolean;
  },
) {
  const normalizedTitle = (input.title || "").trim();
  const normalizedSlug = (input.slug || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!normalizedTitle) {
    throw new Error("Collection title is required.");
  }

  if (!normalizedSlug) {
    throw new Error("Collection slug is required and must contain alphanumeric characters or hyphens.");
  }

  return withDb(async (db) => {
    // Resolve course
    const courseQuery = isValidUuid(input.courseSlugOrId)
      ? eq(courses.id, input.courseSlugOrId)
      : eq(courses.slug, input.courseSlugOrId.toLowerCase().trim());

    const courseRows = await db
      .select({ id: courses.id, name: courses.name, slug: courses.slug })
      .from(courses)
      .where(courseQuery)
      .limit(1);

    if (courseRows.length === 0) {
      throw new Error(`Course '${input.courseSlugOrId}' was not found.`);
    }

    const course = courseRows[0];

    // Check slug uniqueness within course
    const existing = await db
      .select({ id: advancedCollections.id })
      .from(advancedCollections)
      .where(
        and(
          eq(advancedCollections.courseId, course.id),
          eq(advancedCollections.slug, normalizedSlug),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw new Error(
        `A collection with slug '${normalizedSlug}' already exists for ${course.name}.`,
      );
    }

    const [created] = await db
      .insert(advancedCollections)
      .values({
        courseId: course.id,
        title: normalizedTitle,
        slug: normalizedSlug,
        description: input.description?.trim() || null,
        displayOrder: typeof input.displayOrder === "number" ? input.displayOrder : 0,
        isPublished: Boolean(input.isPublished),
      })
      .returning();

    await logAdminAudit({
      adminUserId,
      action: "advanced_collection.create",
      targetType: "advanced_collection",
      targetId: created.id,
      details: `Created Advanced collection '${created.title}' (${created.slug}) for course ${course.slug}`,
    });

    return {
      ...created,
      courseName: course.name,
      courseSlug: course.slug,
    };
  });
}

/**
 * Update an Advanced Collection
 */
export async function updateAdvancedCollection(
  adminUserId: string,
  id: string,
  updates: {
    title?: string;
    slug?: string;
    description?: string;
    displayOrder?: number;
    isPublished?: boolean;
  },
) {
  if (!isValidUuid(id)) {
    throw new Error("Invalid collection ID.");
  }

  return withDb(async (db) => {
    const existing = await db
      .select({
        id: advancedCollections.id,
        courseId: advancedCollections.courseId,
        title: advancedCollections.title,
        slug: advancedCollections.slug,
      })
      .from(advancedCollections)
      .where(eq(advancedCollections.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new Error("Advanced collection not found.");
    }

    const current = existing[0];
    const updateValues: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (updates.title !== undefined) {
      const t = updates.title.trim();
      if (!t) throw new Error("Collection title cannot be empty.");
      updateValues.title = t;
    }

    if (updates.slug !== undefined) {
      const s = updates.slug
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      if (!s) throw new Error("Collection slug cannot be empty.");

      if (s !== current.slug) {
        // Check uniqueness
        const dup = await db
          .select({ id: advancedCollections.id })
          .from(advancedCollections)
          .where(
            and(
              eq(advancedCollections.courseId, current.courseId),
              eq(advancedCollections.slug, s),
            ),
          )
          .limit(1);

        if (dup.length > 0) {
          throw new Error(`A collection with slug '${s}' already exists for this course.`);
        }
      }
      updateValues.slug = s;
    }

    if (updates.description !== undefined) {
      updateValues.description = updates.description.trim() || null;
    }

    if (updates.displayOrder !== undefined) {
      updateValues.displayOrder = updates.displayOrder;
    }

    if (updates.isPublished !== undefined) {
      updateValues.isPublished = Boolean(updates.isPublished);
    }

    const [updated] = await db
      .update(advancedCollections)
      .set(updateValues)
      .where(eq(advancedCollections.id, id))
      .returning();

    await logAdminAudit({
      adminUserId,
      action: "advanced_collection.update",
      targetType: "advanced_collection",
      targetId: id,
      details: `Updated Advanced collection '${updated.title}' (${updated.slug})`,
    });

    return updated;
  });
}

/**
 * Delete an Advanced Collection.
 * Strictly prevents hard deletion if any quiz attempts exist to protect historical attempt data.
 */
export async function deleteAdvancedCollection(adminUserId: string, id: string) {
  if (!isValidUuid(id)) {
    throw new Error("Invalid collection ID.");
  }

  return withDb(async (db) => {
    // 1. Check if collection exists
    const [col] = await db
      .select({ id: advancedCollections.id, title: advancedCollections.title })
      .from(advancedCollections)
      .where(eq(advancedCollections.id, id))
      .limit(1);

    if (!col) {
      throw new Error("Collection not found.");
    }

    // 2. Check for historical attempts
    const attemptRows = await db
      .select({ count: sql<number>`count(${advancedQuizAttempts.id})::int` })
      .from(advancedQuizAttempts)
      .where(eq(advancedQuizAttempts.collectionId, id));

    const attemptCount = attemptRows[0]?.count || 0;
    if (attemptCount > 0) {
      throw new Error(
        `Cannot delete collection '${col.title}' because it has ${attemptCount} historical quiz attempt(s). Unpublish or deactivate it instead to protect student history.`,
      );
    }

    // 3. Delete any questions belonging to this collection first if safe
    await db
      .delete(advancedQuestions)
      .where(eq(advancedQuestions.collectionId, id));

    // 4. Delete collection
    await db.delete(advancedCollections).where(eq(advancedCollections.id, id));

    await logAdminAudit({
      adminUserId,
      action: "advanced_collection.delete",
      targetType: "advanced_collection",
      targetId: id,
      details: `Deleted Advanced collection '${col.title}' (and its unattempted questions)`,
    });

    return { success: true };
  });
}

/**
 * Get Advanced Questions (paginated & filterable)
 */
export async function getAdvancedQuestions(options?: {
  collectionId?: string;
  courseSlug?: string;
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, options?.page || 1);
  const limit = Math.min(100, Math.max(1, options?.limit || 20));
  const offset = (page - 1) * limit;

  return withDb(async (db) => {
    const conditions = [];

    if (options?.collectionId) {
      if (!isValidUuid(options.collectionId)) {
        return { questions: [], total: 0, page, limit, totalPages: 0 };
      }
      conditions.push(eq(advancedQuestions.collectionId, options.collectionId));
    }

    if (options?.courseSlug) {
      conditions.push(eq(courses.slug, options.courseSlug));
    }

    if (typeof options?.isActive === "boolean") {
      conditions.push(eq(advancedQuestions.isActive, options.isActive));
    }

    if (options?.search && options.search.trim()) {
      const term = `%${options.search.trim()}%`;
      conditions.push(
        or(
          ilike(advancedQuestions.questionText, term),
          ilike(advancedQuestions.explanation, term),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Count query
    const [countResult] = await db
      .select({ count: sql<number>`count(${advancedQuestions.id})::int` })
      .from(advancedQuestions)
      .innerJoin(
        advancedCollections,
        eq(advancedQuestions.collectionId, advancedCollections.id),
      )
      .innerJoin(courses, eq(advancedCollections.courseId, courses.id))
      .where(whereClause);

    const total = countResult?.count || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    // Items query
    const questionsList = await db
      .select({
        id: advancedQuestions.id,
        collectionId: advancedQuestions.collectionId,
        collectionTitle: advancedCollections.title,
        collectionSlug: advancedCollections.slug,
        courseId: courses.id,
        courseName: courses.name,
        courseSlug: courses.slug,
        questionText: advancedQuestions.questionText,
        optionA: advancedQuestions.optionA,
        optionB: advancedQuestions.optionB,
        optionC: advancedQuestions.optionC,
        optionD: advancedQuestions.optionD,
        correctOption: advancedQuestions.correctOption,
        explanation: advancedQuestions.explanation,
        isActive: advancedQuestions.isActive,
        createdAt: advancedQuestions.createdAt,
        updatedAt: advancedQuestions.updatedAt,
      })
      .from(advancedQuestions)
      .innerJoin(
        advancedCollections,
        eq(advancedQuestions.collectionId, advancedCollections.id),
      )
      .innerJoin(courses, eq(advancedCollections.courseId, courses.id))
      .where(whereClause)
      .orderBy(desc(advancedQuestions.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      questions: questionsList,
      total,
      page,
      limit,
      totalPages,
    };
  });
}

/**
 * Create a single Advanced Question
 */
export async function createAdvancedQuestion(
  adminUserId: string,
  input: {
    collectionId: string;
    questionText: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctOption: "A" | "B" | "C" | "D";
    explanation?: string;
    isActive?: boolean;
  },
) {
  if (!isValidUuid(input.collectionId)) {
    throw new Error("Invalid collection ID.");
  }

  const qText = (input.questionText || "").trim();
  const optA = (input.optionA || "").trim();
  const optB = (input.optionB || "").trim();
  const optC = (input.optionC || "").trim();
  const optD = (input.optionD || "").trim();
  const correct = (input.correctOption || "").trim().toUpperCase() as "A" | "B" | "C" | "D";

  if (!qText || qText.length < 5) {
    throw new Error("Question text must be at least 5 characters long.");
  }
  if (!optA || !optB || !optC || !optD) {
    throw new Error("All four options (A, B, C, D) are required.");
  }
  if (!["A", "B", "C", "D"].includes(correct)) {
    throw new Error("Correct option must be A, B, C, or D.");
  }

  return withDb(async (db) => {
    // Verify collection exists
    const [col] = await db
      .select({ id: advancedCollections.id, title: advancedCollections.title })
      .from(advancedCollections)
      .where(eq(advancedCollections.id, input.collectionId))
      .limit(1);

    if (!col) {
      throw new Error("Target Advanced collection not found.");
    }

    const [created] = await db
      .insert(advancedQuestions)
      .values({
        collectionId: input.collectionId,
        questionText: qText,
        optionA: optA,
        optionB: optB,
        optionC: optC,
        optionD: optD,
        correctOption: correct,
        explanation: input.explanation?.trim() || null,
        isActive: input.isActive !== undefined ? Boolean(input.isActive) : true,
      })
      .returning();

    await logAdminAudit({
      adminUserId,
      action: "advanced_question.create",
      targetType: "advanced_question",
      targetId: created.id,
      details: `Created Advanced question in collection '${col.title}'`,
    });

    return created;
  });
}

/**
 * Update an Advanced Question
 */
export async function updateAdvancedQuestion(
  adminUserId: string,
  id: string,
  updates: {
    questionText?: string;
    optionA?: string;
    optionB?: string;
    optionC?: string;
    optionD?: string;
    correctOption?: "A" | "B" | "C" | "D";
    explanation?: string | null;
    isActive?: boolean;
  },
) {
  if (!isValidUuid(id)) {
    throw new Error("Invalid question ID.");
  }

  return withDb(async (db) => {
    const existing = await db
      .select({ id: advancedQuestions.id, collectionId: advancedQuestions.collectionId })
      .from(advancedQuestions)
      .where(eq(advancedQuestions.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new Error("Question not found.");
    }

    const updateValues: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (updates.questionText !== undefined) {
      const q = updates.questionText.trim();
      if (!q || q.length < 5) throw new Error("Question text must be at least 5 characters long.");
      updateValues.questionText = q;
    }
    if (updates.optionA !== undefined) {
      const a = updates.optionA.trim();
      if (!a) throw new Error("Option A cannot be empty.");
      updateValues.optionA = a;
    }
    if (updates.optionB !== undefined) {
      const b = updates.optionB.trim();
      if (!b) throw new Error("Option B cannot be empty.");
      updateValues.optionB = b;
    }
    if (updates.optionC !== undefined) {
      const c = updates.optionC.trim();
      if (!c) throw new Error("Option C cannot be empty.");
      updateValues.optionC = c;
    }
    if (updates.optionD !== undefined) {
      const d = updates.optionD.trim();
      if (!d) throw new Error("Option D cannot be empty.");
      updateValues.optionD = d;
    }
    if (updates.correctOption !== undefined) {
      const co = updates.correctOption.trim().toUpperCase() as "A" | "B" | "C" | "D";
      if (!["A", "B", "C", "D"].includes(co)) throw new Error("Correct option must be A, B, C, or D.");
      updateValues.correctOption = co;
    }
    if (updates.explanation !== undefined) {
      updateValues.explanation = updates.explanation?.trim() || null;
    }
    if (updates.isActive !== undefined) {
      updateValues.isActive = Boolean(updates.isActive);
    }

    const [updated] = await db
      .update(advancedQuestions)
      .set(updateValues)
      .where(eq(advancedQuestions.id, id))
      .returning();

    await logAdminAudit({
      adminUserId,
      action: "advanced_question.update",
      targetType: "advanced_question",
      targetId: id,
      details: "Updated Advanced question details",
    });

    return updated;
  });
}

/**
 * Delete an Advanced Question.
 * Checks whether it was included in any student attempt; if so, soft-deactivates to protect history.
 */
export async function deleteAdvancedQuestion(adminUserId: string, id: string) {
  if (!isValidUuid(id)) {
    throw new Error("Invalid question ID.");
  }

  return withDb(async (db) => {
    // Check if question exists
    const [q] = await db
      .select({ id: advancedQuestions.id })
      .from(advancedQuestions)
      .where(eq(advancedQuestions.id, id))
      .limit(1);

    if (!q) {
      throw new Error("Question not found.");
    }

    // Check for attempt references
    const [ref] = await db
      .select({ count: sql<number>`count(${advancedQuizAttemptQuestions.id})::int` })
      .from(advancedQuizAttemptQuestions)
      .where(eq(advancedQuizAttemptQuestions.questionId, id));

    if ((ref?.count || 0) > 0) {
      // Historical attempt exists - soft deactivate to preserve student score review
      await db
        .update(advancedQuestions)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(advancedQuestions.id, id));

      await logAdminAudit({
        adminUserId,
        action: "advanced_question.update",
        targetType: "advanced_question",
        targetId: id,
        details: "Deactivated Advanced question (has historical attempts, cannot be hard deleted)",
      });

      return {
        success: true,
        archived: true,
        message: "Question has been used in past attempts and was archived instead of deleted.",
      };
    }

    // No historical attempts: safely delete
    await db.delete(advancedQuestions).where(eq(advancedQuestions.id, id));

    await logAdminAudit({
      adminUserId,
      action: "advanced_question.delete",
      targetType: "advanced_question",
      targetId: id,
      details: "Deleted unattempted Advanced question",
    });

    return { success: true, archived: false, message: "Question permanently deleted." };
  });
}

/* ------------------------------------------------------------------ */
/*  ADVANCED PRACTICE QUIZ ENGINE (ADMIN PREVIEW / ENTITLEMENT)        */
/* ------------------------------------------------------------------ */

export type PublicAdvancedQuestion = {
  id: string;
  order: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
};

/**
 * Creates an Advanced Practice quiz attempt locked to a specific collection.
 * Answers and explanations are NEVER leaked in the questions returned to the client.
 */
export async function createAdvancedQuizAttempt(
  userId: string,
  collectionIdOrSlug: string,
  courseSlug?: string,
): Promise<{
  attemptId: string;
  collectionTitle: string;
  collectionSlug: string;
  courseName: string;
  courseSlug: string;
  totalQuestions: number;
  questions: PublicAdvancedQuestion[];
}> {
  return withDb(async (db) => {
    // 1. Fetch collection
    let colRow;
    if (isValidUuid(collectionIdOrSlug)) {
      const rows = await db
        .select({
          id: advancedCollections.id,
          courseId: advancedCollections.courseId,
          title: advancedCollections.title,
          slug: advancedCollections.slug,
          isPublished: advancedCollections.isPublished,
          courseName: courses.name,
          courseSlug: courses.slug,
        })
        .from(advancedCollections)
        .innerJoin(courses, eq(advancedCollections.courseId, courses.id))
        .where(eq(advancedCollections.id, collectionIdOrSlug))
        .limit(1);
      colRow = rows[0];
    } else if (courseSlug) {
      const rows = await db
        .select({
          id: advancedCollections.id,
          courseId: advancedCollections.courseId,
          title: advancedCollections.title,
          slug: advancedCollections.slug,
          isPublished: advancedCollections.isPublished,
          courseName: courses.name,
          courseSlug: courses.slug,
        })
        .from(advancedCollections)
        .innerJoin(courses, eq(advancedCollections.courseId, courses.id))
        .where(
          and(
            eq(courses.slug, courseSlug),
            eq(advancedCollections.slug, collectionIdOrSlug.toLowerCase().trim()),
          ),
        )
        .limit(1);
      colRow = rows[0];
    }

    if (!colRow) {
      throw new Error("Advanced collection not found.");
    }

    // 2. Fetch active questions belonging strictly to this collection
    const activeQuestions = await db
      .select({
        id: advancedQuestions.id,
        questionText: advancedQuestions.questionText,
        optionA: advancedQuestions.optionA,
        optionB: advancedQuestions.optionB,
        optionC: advancedQuestions.optionC,
        optionD: advancedQuestions.optionD,
      })
      .from(advancedQuestions)
      .where(
        and(
          eq(advancedQuestions.collectionId, colRow.id),
          eq(advancedQuestions.isActive, true),
        ),
      );

    if (activeQuestions.length === 0) {
      throw new Error(`This Advanced Collection does not have any active questions yet.`);
    }

    // 3. Shuffle questions for randomized attempt
    const shuffled = [...activeQuestions].sort(() => Math.random() - 0.5);

    // 4. Create attempt
    const [attempt] = await db
      .insert(advancedQuizAttempts)
      .values({
        userId,
        courseId: colRow.courseId,
        collectionId: colRow.id,
        totalQuestions: shuffled.length,
        status: "in_progress",
      })
      .returning({ id: advancedQuizAttempts.id });

    // 5. Lock questions to attempt
    const attemptQuestionRows = shuffled.map((q, idx) => ({
      attemptId: attempt.id,
      questionId: q.id,
      questionOrder: idx + 1,
    }));

    await db.insert(advancedQuizAttemptQuestions).values(attemptQuestionRows);

    return {
      attemptId: attempt.id,
      collectionTitle: colRow.title,
      collectionSlug: colRow.slug,
      courseName: colRow.courseName,
      courseSlug: colRow.courseSlug,
      totalQuestions: shuffled.length,
      questions: shuffled.map((q, idx) => ({
        id: q.id,
        order: idx + 1,
        questionText: q.questionText,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
      })),
    };
  });
}

/**
 * Retrieve locked questions for an in-progress Advanced attempt
 */
export async function getLockedAdvancedQuizAttempt(
  attemptId: string,
  userId: string,
  options?: { allowAdminAccess?: boolean },
) {
  if (!isValidUuid(attemptId)) return null;

  return withDb(async (db) => {
    const attempts = await db
      .select({
        id: advancedQuizAttempts.id,
        userId: advancedQuizAttempts.userId,
        courseId: advancedQuizAttempts.courseId,
        courseSlug: courses.slug,
        courseName: courses.name,
        collectionId: advancedQuizAttempts.collectionId,
        collectionTitle: advancedCollections.title,
        collectionSlug: advancedCollections.slug,
        totalQuestions: advancedQuizAttempts.totalQuestions,
        status: advancedQuizAttempts.status,
        score: advancedQuizAttempts.score,
        percentage: advancedQuizAttempts.percentage,
        startedAt: advancedQuizAttempts.startedAt,
        submittedAt: advancedQuizAttempts.submittedAt,
      })
      .from(advancedQuizAttempts)
      .innerJoin(courses, eq(advancedQuizAttempts.courseId, courses.id))
      .innerJoin(advancedCollections, eq(advancedQuizAttempts.collectionId, advancedCollections.id))
      .where(eq(advancedQuizAttempts.id, attemptId))
      .limit(1);

    if (attempts.length === 0) return null;
    const attempt = attempts[0];

    if (attempt.userId !== userId && !options?.allowAdminAccess) {
      throw new Error("Access denied: You do not own this quiz attempt.");
    }

    const lockedQuestions = await db
      .select({
        id: advancedQuestions.id,
        order: advancedQuizAttemptQuestions.questionOrder,
        questionText: advancedQuestions.questionText,
        optionA: advancedQuestions.optionA,
        optionB: advancedQuestions.optionB,
        optionC: advancedQuestions.optionC,
        optionD: advancedQuestions.optionD,
      })
      .from(advancedQuizAttemptQuestions)
      .innerJoin(advancedQuestions, eq(advancedQuizAttemptQuestions.questionId, advancedQuestions.id))
      .where(eq(advancedQuizAttemptQuestions.attemptId, attemptId))
      .orderBy(asc(advancedQuizAttemptQuestions.questionOrder));

    return {
      attempt,
      questions: lockedQuestions,
    };
  });
}

/**
 * Submit answers for an Advanced Quiz attempt
 */
export async function submitAdvancedQuizAttempt(
  attemptId: string,
  userId: string,
  answers: Array<{ questionId: string; selectedOption: "A" | "B" | "C" | "D" }>,
  options?: { allowAdminAccess?: boolean },
) {
  if (!isValidUuid(attemptId)) throw new Error("Invalid attempt ID.");
  if (answers.length === 0) throw new Error("At least one answer is required.");

  return withDb(async (db) =>
    db.transaction(async (tx) => {
      const [attempt] = await tx
        .select({
          id: advancedQuizAttempts.id,
          userId: advancedQuizAttempts.userId,
          status: advancedQuizAttempts.status,
          totalQuestions: advancedQuizAttempts.totalQuestions,
        })
        .from(advancedQuizAttempts)
        .where(eq(advancedQuizAttempts.id, attemptId))
        .limit(1);

      if (!attempt) throw new Error("Advanced quiz attempt not found.");
      if (attempt.userId !== userId && !options?.allowAdminAccess) {
        throw new Error("Access denied: You do not own this attempt.");
      }
      if (attempt.status !== "in_progress") throw new Error("Attempt has already been submitted.");

      const lockedQuestions = await tx
        .select({
          id: advancedQuestions.id,
          correctOption: advancedQuestions.correctOption,
        })
        .from(advancedQuizAttemptQuestions)
        .innerJoin(advancedQuestions, eq(advancedQuizAttemptQuestions.questionId, advancedQuestions.id))
        .where(eq(advancedQuizAttemptQuestions.attemptId, attemptId));

      const lockedIds = new Set(lockedQuestions.map((q) => q.id));
      const answerMap = new Map<string, "A" | "B" | "C" | "D">();

      for (const ans of answers) {
        if (!lockedIds.has(ans.questionId)) {
          throw new Error("Submitted answer does not belong to this attempt.");
        }
        answerMap.set(ans.questionId, ans.selectedOption);
      }

      if (answerMap.size !== lockedQuestions.length) {
        throw new Error("Every locked question must be answered before submission.");
      }

      await tx.delete(advancedStudentAnswers).where(eq(advancedStudentAnswers.attemptId, attemptId));

      const scoringRows = lockedQuestions.map((q) => {
        const selected = answerMap.get(q.id)!;
        return {
          attemptId,
          questionId: q.id,
          selectedOption: selected,
          isCorrect: selected === q.correctOption,
        };
      });

      await tx.insert(advancedStudentAnswers).values(scoringRows);

      const score = scoringRows.filter((r) => r.isCorrect).length;
      const percentage = ((score / lockedQuestions.length) * 100).toFixed(2);
      const submittedAt = new Date();

      const [updated] = await tx
        .update(advancedQuizAttempts)
        .set({
          score,
          percentage,
          status: "submitted",
          submittedAt,
        })
        .where(eq(advancedQuizAttempts.id, attemptId))
        .returning();

      return {
        attempt: updated,
        answers: scoringRows.map((r) => ({
          questionId: r.questionId,
          selectedOption: r.selectedOption,
          isCorrect: r.isCorrect,
        })),
      };
    }),
  );
}

/**
 * Retrieve post-submission answer review for an Advanced attempt.
 * Strictly verifies status is 'submitted' so answer keys are never leaked early.
 */
export async function getAdvancedQuizAttemptReview(
  attemptId: string,
  userId: string,
  options?: { allowAdminAccess?: boolean },
) {
  if (!isValidUuid(attemptId)) return null;

  return withDb(async (db) => {
    const attempts = await db
      .select({
        id: advancedQuizAttempts.id,
        userId: advancedQuizAttempts.userId,
        courseId: advancedQuizAttempts.courseId,
        courseSlug: courses.slug,
        courseName: courses.name,
        collectionId: advancedQuizAttempts.collectionId,
        collectionTitle: advancedCollections.title,
        collectionSlug: advancedCollections.slug,
        totalQuestions: advancedQuizAttempts.totalQuestions,
        status: advancedQuizAttempts.status,
        score: advancedQuizAttempts.score,
        percentage: advancedQuizAttempts.percentage,
        startedAt: advancedQuizAttempts.startedAt,
        submittedAt: advancedQuizAttempts.submittedAt,
      })
      .from(advancedQuizAttempts)
      .innerJoin(courses, eq(advancedQuizAttempts.courseId, courses.id))
      .innerJoin(advancedCollections, eq(advancedQuizAttempts.collectionId, advancedCollections.id))
      .where(eq(advancedQuizAttempts.id, attemptId))
      .limit(1);

    if (attempts.length === 0) return null;
    const attempt = attempts[0];

    if (attempt.userId !== userId && !options?.allowAdminAccess) {
      throw new Error("Access denied: You do not own this quiz attempt.");
    }

    if (attempt.status !== "submitted") {
      throw new Error("Cannot review an unsubmitted quiz attempt.");
    }

    const reviewQuestions = await db
      .select({
        id: advancedQuestions.id,
        order: advancedQuizAttemptQuestions.questionOrder,
        questionText: advancedQuestions.questionText,
        optionA: advancedQuestions.optionA,
        optionB: advancedQuestions.optionB,
        optionC: advancedQuestions.optionC,
        optionD: advancedQuestions.optionD,
        correctOption: advancedQuestions.correctOption,
        explanation: advancedQuestions.explanation,
        selectedOption: advancedStudentAnswers.selectedOption,
        isCorrect: advancedStudentAnswers.isCorrect,
      })
      .from(advancedQuizAttemptQuestions)
      .innerJoin(advancedQuestions, eq(advancedQuizAttemptQuestions.questionId, advancedQuestions.id))
      .leftJoin(
        advancedStudentAnswers,
        and(
          eq(advancedStudentAnswers.attemptId, attemptId),
          eq(advancedStudentAnswers.questionId, advancedQuestions.id),
        ),
      )
      .where(eq(advancedQuizAttemptQuestions.attemptId, attemptId))
      .orderBy(asc(advancedQuizAttemptQuestions.questionOrder));

    return {
      attempt,
      questions: reviewQuestions,
    };
  });
}
