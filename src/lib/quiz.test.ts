import { describe, expect, it, vi } from "vitest";

import { selectQuestionsForAttempt } from "./quiz";
import type { Question } from "./types";

const questions = Array.from({ length: 100 }, (_, index): Question => ({
  id: `question-${index + 1}`,
  courseSlug: "ielts",
  prompt: `Question ${index + 1}`,
  options: ["A", "B", "C", "D"],
  correctOptionIndex: 0,
  explanation: null,
  isPublished: true,
}));

describe("selectQuestionsForAttempt", () => {
  it("locks an attempt to the requested number of questions", () => {
    const selected = selectQuestionsForAttempt(questions, 20);

    expect(selected).toHaveLength(20);
    expect(new Set(selected.map((question) => question.id))).toHaveLength(20);
  });

  it("shuffles before selecting questions", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const selected = selectQuestionsForAttempt(questions, 20);

    expect(selected[0]?.id).not.toBe("question-1");

    vi.restoreAllMocks();
  });

  it("fails when the bank does not contain enough questions", () => {
    expect(() => selectQuestionsForAttempt(questions.slice(0, 19), 20)).toThrow(
      "Cannot create a 20-question quiz from 19 questions.",
    );
  });
});
