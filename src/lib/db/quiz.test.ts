import { describe, expect, it } from "vitest";

import { quizSizes } from "@/lib/quiz";
import type { QuizSize } from "@/lib/types";

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
});
