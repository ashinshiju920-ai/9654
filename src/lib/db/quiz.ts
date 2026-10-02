import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";

import { withDb } from "@/lib/db";
import {
  courses,
  questions,
  quizAttempts,
  quizAttemptQuestions,
  studentAnswers,
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

export type QuizAnswerInput = {
  questionId: string;
  selectedOption: "A" | "B" | "C" | "D";
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

  return withDb(async (db) => {
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
  });
}

/**
 * Retrieve attempt metadata ensuring student ownership.
 */
export async function getQuizAttempt(attemptId: string, userId: string) {
  const attempts = await withDb((db) =>
    db
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
      .limit(1),
  );

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
  return withDb((db) =>
    db
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
      .orderBy(desc(quizAttempts.createdAt)),
  );
}

export async function getLockedQuizAttempt(attemptId: string, userId: string) {
  const attempt = await getQuizAttempt(attemptId, userId);

  if (!attempt) {
    return null;
  }

  const lockedQuestions = await withDb((db) =>
    db
      .select({
        id: questions.id,
        order: quizAttemptQuestions.questionOrder,
        questionText: questions.questionText,
        optionA: questions.optionA,
        optionB: questions.optionB,
        optionC: questions.optionC,
        optionD: questions.optionD,
      })
      .from(quizAttemptQuestions)
      .innerJoin(questions, eq(quizAttemptQuestions.questionId, questions.id))
      .where(eq(quizAttemptQuestions.attemptId, attemptId))
      .orderBy(quizAttemptQuestions.questionOrder),
  );

  return {
    attempt,
    questions: lockedQuestions,
  };
}

export async function submitQuizAttempt(
  attemptId: string,
  userId: string,
  answers: QuizAnswerInput[],
) {
  if (answers.length === 0) {
    throw new Error("At least one answer is required.");
  }

  return withDb(async (db) =>
    db.transaction(async (tx) => {
      const attemptRows = await tx
        .select({
          id: quizAttempts.id,
          userId: quizAttempts.userId,
          testSize: quizAttempts.testSize,
          status: quizAttempts.status,
        })
        .from(quizAttempts)
        .where(eq(quizAttempts.id, attemptId))
        .limit(1);

      if (attemptRows.length === 0) {
        throw new Error("Quiz attempt not found.");
      }

      const attempt = attemptRows[0];

      if (attempt.userId !== userId) {
        throw new Error("Access denied: You do not own this quiz attempt.");
      }

      if (attempt.status !== "in_progress") {
        throw new Error("Quiz attempt has already been submitted.");
      }

      const lockedQuestions = await tx
        .select({
          id: questions.id,
          correctOption: questions.correctOption,
        })
        .from(quizAttemptQuestions)
        .innerJoin(questions, eq(quizAttemptQuestions.questionId, questions.id))
        .where(eq(quizAttemptQuestions.attemptId, attemptId));

      const lockedQuestionIds = new Set(lockedQuestions.map((question) => question.id));
      const answerMap = new Map<string, QuizAnswerInput>();

      for (const answer of answers) {
        if (!lockedQuestionIds.has(answer.questionId)) {
          throw new Error("Submitted answer does not belong to this attempt.");
        }

        answerMap.set(answer.questionId, answer);
      }

      if (answerMap.size !== lockedQuestions.length) {
        throw new Error("Every locked question must be answered before submission.");
      }

      await tx.delete(studentAnswers).where(eq(studentAnswers.attemptId, attemptId));

      const scoringRows = lockedQuestions.map((question) => {
        const answer = answerMap.get(question.id);

        if (!answer) {
          throw new Error("Missing answer for locked question.");
        }

        return {
          attemptId,
          questionId: question.id,
          selectedOption: answer.selectedOption,
          isCorrect: answer.selectedOption === question.correctOption,
        };
      });

      await tx.insert(studentAnswers).values(scoringRows);

      const score = scoringRows.filter((row) => row.isCorrect).length;
      const percentage = ((score / lockedQuestions.length) * 100).toFixed(2);
      const submittedAt = new Date();

      const [updated] = await tx
        .update(quizAttempts)
        .set({
          score,
          percentage,
          status: "submitted",
          submittedAt,
        })
        .where(eq(quizAttempts.id, attemptId))
        .returning({
          id: quizAttempts.id,
          testSize: quizAttempts.testSize,
          status: quizAttempts.status,
          score: quizAttempts.score,
          percentage: quizAttempts.percentage,
          submittedAt: quizAttempts.submittedAt,
        });

      return {
        attempt: updated,
        answers: scoringRows.map((row) => ({
          questionId: row.questionId,
          selectedOption: row.selectedOption,
          isCorrect: row.isCorrect,
        })),
      };
    }),
  );
}

export async function deleteQuizAttempts(attemptIds: string[]) {
  if (attemptIds.length === 0) {
    return;
  }

  await withDb((db) =>
    db.delete(quizAttempts).where(inArray(quizAttempts.id, attemptIds)),
  );
}
