import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  courses,
  questions,
  quizAttempts,
  quizAttemptQuestions,
} from "@/lib/db/schema";
import { quizSizes } from "@/lib/quiz";
import type { QuizSize } from "@/lib/types";

export type PublicQuizQuestion = {
  id: string;
  order: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
};

/**
 * Create a new quiz attempt for a student.
 *
 * Enforces:
 * - Attempt is bound to the authenticated user ID
 * - Requested size is strictly 20, 50, or 100
 * - Questions are randomized, selected, and locked into `quiz_attempt_questions`
 * - Answer keys ('correctOption') and explanations are NEVER returned to the student
 */
export async function createQuizAttempt(
  userId: string,
  courseSlug: string,
  testSize: number,
): Promise<{
  attemptId: string;
  courseName: string;
  testSize: number;
  questions: PublicQuizQuestion[];
}> {
  if (!quizSizes.includes(testSize as QuizSize)) {
    throw new Error(`Invalid test size: ${testSize}. Must be 20, 50, or 100.`);
  }

  const courseList = await db
    .select({ id: courses.id, name: courses.name, isActive: courses.isActive })
    .from(courses)
    .where(and(eq(courses.slug, courseSlug), eq(courses.isActive, true)))
    .limit(1);

  if (courseList.length === 0) {
    throw new Error(`Course '${courseSlug}' not found or inactive.`);
  }

  const course = courseList[0];

  // Retrieve active question bank
  const allQuestions = await db
    .select({
      id: questions.id,
      questionText: questions.questionText,
      optionA: questions.optionA,
      optionB: questions.optionB,
      optionC: questions.optionC,
      optionD: questions.optionD,
    })
    .from(questions)
    .where(and(eq(questions.courseId, course.id), eq(questions.isActive, true)));

  if (allQuestions.length < testSize) {
    throw new Error(
      `Not enough questions available for this course (needed ${testSize}, found ${allQuestions.length}).`,
    );
  }

  // Shuffle and select subset
  const shuffled = [...allQuestions].sort(() => Math.random() - 0.5).slice(0, testSize);

  // Insert quiz attempt record
  const [attempt] = await db
    .insert(quizAttempts)
    .values({
      userId,
      courseId: course.id,
      testSize,
      status: "in_progress",
    })
    .returning({ id: quizAttempts.id });

  // Lock selected questions to this attempt
  const attemptQuestionRows = shuffled.map((q, index) => ({
    attemptId: attempt.id,
    questionId: q.id,
    questionOrder: index + 1,
  }));

  await db.insert(quizAttemptQuestions).values(attemptQuestionRows);

  return {
    attemptId: attempt.id,
    courseName: course.name,
    testSize,
    questions: shuffled.map((q, index) => ({
      id: q.id,
      order: index + 1,
      questionText: q.questionText,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
    })),
  };
}

/**
 * Retrieve attempt metadata ensuring student ownership.
 */
export async function getQuizAttempt(attemptId: string, userId: string) {
  const attempts = await db
    .select({
      id: quizAttempts.id,
      userId: quizAttempts.userId,
      courseId: quizAttempts.courseId,
      courseSlug: courses.slug,
      courseName: courses.name,
      testSize: quizAttempts.testSize,
      status: quizAttempts.status,
      score: quizAttempts.score,
      percentage: quizAttempts.percentage,
      startedAt: quizAttempts.startedAt,
      submittedAt: quizAttempts.submittedAt,
    })
    .from(quizAttempts)
    .innerJoin(courses, eq(quizAttempts.courseId, courses.id))
    .where(eq(quizAttempts.id, attemptId))
    .limit(1);

  if (attempts.length === 0) {
    return null;
  }

  const attempt = attempts[0];

  // Strictly enforce attempt ownership
  if (attempt.userId !== userId) {
    throw new Error("Access denied: You do not own this quiz attempt.");
  }

  return attempt;
}

/**
 * Get all completed or in-progress quiz attempts for a student.
 */
export async function getUserQuizHistory(userId: string) {
  return db
    .select({
      id: quizAttempts.id,
      courseName: courses.name,
      courseSlug: courses.slug,
      testSize: quizAttempts.testSize,
      status: quizAttempts.status,
      score: quizAttempts.score,
      percentage: quizAttempts.percentage,
      startedAt: quizAttempts.startedAt,
      submittedAt: quizAttempts.submittedAt,
    })
    .from(quizAttempts)
    .innerJoin(courses, eq(quizAttempts.courseId, courses.id))
    .where(eq(quizAttempts.userId, userId))
    .orderBy(desc(quizAttempts.createdAt));
}
