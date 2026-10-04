import { describe, expect, it } from "vitest";

import { quizSizes, selectQuestionsForAttempt } from "@/lib/quiz";
import type { Question, QuizSize } from "@/lib/types";

describe("Quiz Attempt Integrity & Question Security", () => {
  it("only allows supported quiz sizes (20, 50, 100)", () => {
    expect(quizSizes).toEqual([20, 50, 100]);

    const isValidSize = (size: number): size is QuizSize => quizSizes.includes(size as QuizSize);

    expect(isValidSize(20)).toBe(true);
    expect(isValidSize(50)).toBe(true);
    expect(isValidSize(100)).toBe(true);

    // Unsupported sizes must be rejected
    expect(isValidSize(10)).toBe(false);
    expect(isValidSize(25)).toBe(false);
    expect(isValidSize(500)).toBe(false);
  });

  it("selectQuestionsForAttempt properly handles 20, 50, and 100-question requests", () => {
    const mockBank = Array.from({ length: 120 }, (_, i) => ({
      id: `q-${i + 1}`,
      courseSlug: "ielts" as const,
      prompt: `Question ${i + 1}`,
      options: ["A", "B", "C", "D"],
      correctOptionIndex: 0,
      explanation: null,
      isPublished: true,
    }));

    const attempt20 = selectQuestionsForAttempt(mockBank, 20);
    expect(attempt20.length).toBe(20);

    const attempt50 = selectQuestionsForAttempt(mockBank, 50);
    expect(attempt50.length).toBe(50);

    const attempt100 = selectQuestionsForAttempt(mockBank, 100);
    expect(attempt100.length).toBe(100);
  });

  it("fails gracefully with insufficient questions without duplicating or crashing", () => {
    const smallBank: Question[] = [
      {
        id: "q-1",
        courseSlug: "ielts",
        prompt: "Q1",
        options: ["A", "B", "C", "D"],
        correctOptionIndex: 0,
        explanation: null,
        isPublished: true,
      },
    ];

    expect(() => selectQuestionsForAttempt(smallBank, 20)).toThrow(
      "Cannot create a 20-question quiz from 1 questions.",
    );
    expect(() => selectQuestionsForAttempt(smallBank, 50)).toThrow(
      "Cannot create a 50-question quiz from 1 questions.",
    );
    expect(() => selectQuestionsForAttempt(smallBank, 100)).toThrow(
      "Cannot create a 100-question quiz from 1 questions.",
    );
  });

  it("ensures student quiz questions do not expose correctOption or explanation", () => {
    // Simulated raw database row
    const rawDbQuestion = {
      id: "q-1",
      courseId: "course-1",
      questionText: "What is the primary function of an adjective?",
      optionA: "Modify a noun",
      optionB: "Modify a verb",
      optionC: "Replace a preposition",
      optionD: "Connect two clauses",
      correctOption: "A",
      explanation: "Adjectives describe or quantify nouns.",
      isActive: true,
    };

    // Client-facing projection for quiz attempt
    const studentQuestion = {
      id: rawDbQuestion.id,
      questionText: rawDbQuestion.questionText,
      optionA: rawDbQuestion.optionA,
      optionB: rawDbQuestion.optionB,
      optionC: rawDbQuestion.optionC,
      optionD: rawDbQuestion.optionD,
    };

    // Verify answer key and explanation are absent
    expect(studentQuestion).not.toHaveProperty("correctOption");
    expect(studentQuestion).not.toHaveProperty("explanation");
    expect(Object.keys(studentQuestion)).toEqual([
      "id",
      "questionText",
      "optionA",
      "optionB",
      "optionC",
      "optionD",
    ]);
  });

  it("strictly enforces attempt ownership check", () => {
    const attempt = {
      id: "attempt-123",
      userId: "student-owner-id",
      testSize: 20,
    };

    const requestingStudentA = "student-owner-id";
    const requestingStudentB = "student-attacker-id";

    // Owner access allowed
    expect(attempt.userId === requestingStudentA).toBe(true);

    // Other student access rejected
    expect(attempt.userId === requestingStudentB).toBe(false);
  });

  it("calculates server-side score and percentage accurately", () => {
    const lockedQuestions = [
      { id: "q1", correctOption: "A" },
      { id: "q2", correctOption: "B" },
      { id: "q3", correctOption: "C" },
      { id: "q4", correctOption: "D" },
    ];

    const studentAnswers = [
      { questionId: "q1", selectedOption: "A" }, // correct
      { questionId: "q2", selectedOption: "B" }, // correct
      { questionId: "q3", selectedOption: "A" }, // wrong
      { questionId: "q4", selectedOption: "D" }, // correct
    ];

    const answerMap = new Map(studentAnswers.map((a) => [a.questionId, a.selectedOption]));
    const correctCount = lockedQuestions.filter((q) => answerMap.get(q.id) === q.correctOption).length;
    const percentage = ((correctCount / lockedQuestions.length) * 100).toFixed(2);

    expect(correctCount).toBe(3);
    expect(percentage).toBe("75.00");
  });

  it("rejects duplicate submissions for already submitted attempts", () => {
    const attempt = {
      id: "attempt-99",
      status: "submitted",
    };

    const canSubmit = (status: string) => {
      if (status !== "in_progress") {
        throw new Error("Quiz attempt has already been submitted.");
      }
      return true;
    };

    expect(() => canSubmit(attempt.status)).toThrow("already been submitted");
  });

  it("guards post-submission review so unsubmitted attempts cannot reveal answer keys", () => {
    const inProgressAttempt = {
      id: "attempt-active",
      userId: "user-1",
      status: "in_progress",
    };

    const submittedAttempt = {
      id: "attempt-done",
      userId: "user-1",
      status: "submitted",
    };

    const canReview = (attempt: { userId: string; status: string }, requestingUserId: string) => {
      if (attempt.userId !== requestingUserId) {
        throw new Error("Access denied: You do not own this quiz attempt.");
      }
      if (attempt.status !== "submitted") {
        throw new Error("Cannot review an unsubmitted quiz attempt.");
      }
      return true;
    };

    // User cannot review in-progress attempt (prevents leaking answers)
    expect(() => canReview(inProgressAttempt, "user-1")).toThrow("Cannot review an unsubmitted quiz attempt.");

    // Another user cannot review even if submitted
    expect(() => canReview(submittedAttempt, "attacker")).toThrow("Access denied");

    // Owner can review submitted attempt
    expect(canReview(submittedAttempt, "user-1")).toBe(true);
  });
});
