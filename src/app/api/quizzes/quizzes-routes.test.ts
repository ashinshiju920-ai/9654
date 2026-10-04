import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn(),
}));

vi.mock("@/lib/db/quiz", () => ({
  createQuizAttempt: vi.fn(),
  getLockedQuizAttempt: vi.fn(),
  submitQuizAttempt: vi.fn(),
  getQuizAttemptReview: vi.fn(),
}));

vi.mock("@/lib/entitlements", () => ({
  canUserAccessCourse: vi.fn(async () => true),
}));

import { requireUser } from "@/lib/auth";
import {
  createQuizAttempt,
  getLockedQuizAttempt,
  submitQuizAttempt,
  getQuizAttemptReview,
} from "@/lib/db/quiz";
import { canUserAccessCourse } from "@/lib/entitlements";

import { POST as createQuizRoute } from "./route";
import { GET as getAttemptRoute } from "./[attemptId]/route";
import { POST as submitAttemptRoute } from "./[attemptId]/submit/route";
import { GET as getReviewRoute } from "./[attemptId]/review/route";

describe("Quiz API End-to-End Route Tests", () => {
  const validUuid = "11111111-1111-4111-a111-111111111111";
  const otherUuid = "22222222-2222-4222-a222-222222222222";

  const mockUser = {
    id: "user-1",
    email: "student@test.com",
    fullName: "Student One",
    role: "student",
    accountStatus: "active",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/quizzes", () => {
    it("returns 401 when student is not authenticated", async () => {
      vi.mocked(requireUser).mockRejectedValue(new Error("Unauthorized"));

      const req = new Request("http://localhost/api/quizzes", {
        method: "POST",
        body: JSON.stringify({ courseSlug: "ielts", testSize: 20 }),
      });

      const res = await createQuizRoute(req);
      expect(res.status).toBe(401);
    });

    it("returns 400 for invalid course or missing size", async () => {
      vi.mocked(requireUser).mockResolvedValue(mockUser);

      // Invalid course
      const req1 = new Request("http://localhost/api/quizzes", {
        method: "POST",
        body: JSON.stringify({ courseSlug: "invalid-course", testSize: 20 }),
      });
      const res1 = await createQuizRoute(req1);
      expect(res1.status).toBe(400);

      // Invalid size
      const req2 = new Request("http://localhost/api/quizzes", {
        method: "POST",
        body: JSON.stringify({ courseSlug: "ielts", testSize: 15 }),
      });
      const res2 = await createQuizRoute(req2);
      expect(res2.status).toBe(400);
      const data2 = (await res2.json()) as { error: string };
      expect(data2.error).toContain("Choose 20, 50, or 100");
    });

    it("successfully creates 20, 50, and 100 question attempts without leaking answers", async () => {
      vi.mocked(requireUser).mockResolvedValue(mockUser);
      vi.mocked(canUserAccessCourse).mockResolvedValue(true);

      vi.mocked(createQuizAttempt).mockResolvedValue({
        attemptId: validUuid,
        courseName: "IELTS",
        testSize: 20,
        questions: [
          {
            id: "q-1",
            order: 1,
            questionText: "Sample question?",
            optionA: "A",
            optionB: "B",
            optionC: "C",
            optionD: "D",
          },
        ],
      });

      const req = new Request("http://localhost/api/quizzes", {
        method: "POST",
        body: JSON.stringify({ courseSlug: "ielts", testSize: 20 }),
      });

      const res = await createQuizRoute(req);
      expect(res.status).toBe(201);
      const data = (await res.json()) as { attemptId: string; questions: Array<Record<string, unknown>> };
      expect(data.attemptId).toBe(validUuid);
      expect(data.questions[0]).not.toHaveProperty("correctOption");
      expect(data.questions[0]).not.toHaveProperty("explanation");
    });

    it("handles insufficient question error gracefully", async () => {
      vi.mocked(requireUser).mockResolvedValue(mockUser);
      vi.mocked(canUserAccessCourse).mockResolvedValue(true);

      vi.mocked(createQuizAttempt).mockRejectedValue(
        new Error("Not enough questions available for this course (needed 100, found 25)."),
      );

      const req = new Request("http://localhost/api/quizzes", {
        method: "POST",
        body: JSON.stringify({ courseSlug: "german", testSize: 100 }),
      });

      const res = await createQuizRoute(req);
      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data.error).toContain("Not enough questions available");
    });

    it("denies authenticated students without Standard course entitlement", async () => {
      vi.mocked(requireUser).mockResolvedValue(mockUser);
      vi.mocked(canUserAccessCourse).mockResolvedValue(false);

      const req = new Request("http://localhost/api/quizzes", {
        method: "POST",
        body: JSON.stringify({ courseSlug: "ielts", testSize: 20 }),
      });

      const res = await createQuizRoute(req);
      expect(res.status).toBe(403);
      expect(createQuizAttempt).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/quizzes/[attemptId]", () => {
    it("prevents unauthenticated access", async () => {
      vi.mocked(requireUser).mockRejectedValue(new Error("Unauthorized"));

      const res = await getAttemptRoute(new Request("http://localhost/api/quizzes/" + validUuid), {
        params: Promise.resolve({ attemptId: validUuid }),
      });

      expect(res.status).toBe(401);
    });

    it("returns 404 when attempt not found or not owned by user", async () => {
      vi.mocked(requireUser).mockResolvedValue({
        id: "attacker",
        email: "attacker@test.com",
        fullName: "Attacker",
        role: "student",
        accountStatus: "active",
      });

      vi.mocked(getLockedQuizAttempt).mockResolvedValue(null);

      const res = await getAttemptRoute(new Request("http://localhost/api/quizzes/" + otherUuid), {
        params: Promise.resolve({ attemptId: otherUuid }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/quizzes/[attemptId]/submit", () => {
    it("submits answers and returns verified scoring results", async () => {
      vi.mocked(requireUser).mockResolvedValue(mockUser);

      vi.mocked(submitQuizAttempt).mockResolvedValue({
        attempt: {
          id: validUuid,
          testSize: 20,
          status: "submitted",
          score: 18,
          percentage: "90.00",
          submittedAt: new Date(),
        },
        answers: [
          { questionId: validUuid, selectedOption: "A", isCorrect: true },
        ],
      });

      const req = new Request("http://localhost/api/quizzes/" + validUuid + "/submit", {
        method: "POST",
        body: JSON.stringify({
          answers: [{ questionId: validUuid, selectedOption: "A" }],
        }),
      });

      const res = await submitAttemptRoute(req, {
        params: Promise.resolve({ attemptId: validUuid }),
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as { attempt: { score: number; percentage: string } };
      expect(data.attempt.score).toBe(18);
      expect(data.attempt.percentage).toBe("90.00");
    });

    it("rejects invalid options or missing answers", async () => {
      vi.mocked(requireUser).mockResolvedValue(mockUser);

      const req = new Request("http://localhost/api/quizzes/" + validUuid + "/submit", {
        method: "POST",
        body: JSON.stringify({
          answers: [{ questionId: validUuid, selectedOption: "Z" }],
        }),
      });

      const res = await submitAttemptRoute(req, {
        params: Promise.resolve({ attemptId: validUuid }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/quizzes/[attemptId]/review", () => {
    it("rejects unauthenticated review access", async () => {
      vi.mocked(requireUser).mockRejectedValue(new Error("Unauthorized"));

      const res = await getReviewRoute(new Request("http://localhost/api/quizzes/" + validUuid + "/review"), {
        params: Promise.resolve({ attemptId: validUuid }),
      });

      expect(res.status).toBe(401);
    });

    it("rejects reviewing in-progress (unsubmitted) attempts to prevent cheating", async () => {
      vi.mocked(requireUser).mockResolvedValue(mockUser);

      vi.mocked(getQuizAttemptReview).mockRejectedValue(
        new Error("Cannot review an unsubmitted quiz attempt."),
      );

      const res = await getReviewRoute(new Request("http://localhost/api/quizzes/" + validUuid + "/review"), {
        params: Promise.resolve({ attemptId: validUuid }),
      });

      expect(res.status).toBe(403);
      const data = (await res.json()) as { error: string };
      expect(data.error).toContain("Cannot review an unsubmitted quiz attempt");
    });

    it("rejects cross-user review access", async () => {
      vi.mocked(requireUser).mockResolvedValue({
        id: "attacker",
        email: "attacker@test.com",
        fullName: "Attacker",
        role: "student",
        accountStatus: "active",
      });

      vi.mocked(getQuizAttemptReview).mockRejectedValue(
        new Error("Access denied: You do not own this quiz attempt."),
      );

      const res = await getReviewRoute(new Request("http://localhost/api/quizzes/" + validUuid + "/review"), {
        params: Promise.resolve({ attemptId: validUuid }),
      });

      expect(res.status).toBe(403);
      const data = (await res.json()) as { error: string };
      expect(data.error).toContain("Access denied");
    });

    it("returns verified review data with explanations when submitted", async () => {
      vi.mocked(requireUser).mockResolvedValue(mockUser);

      vi.mocked(getQuizAttemptReview).mockResolvedValue({
        attempt: {
          id: validUuid,
          userId: "user-1",
          courseId: "c-1",
          courseSlug: "ielts",
          courseName: "IELTS",
          testSize: 20,
          status: "submitted",
          score: 19,
          percentage: "95.00",
          startedAt: new Date(),
          submittedAt: new Date(),
        },
        questions: [
          {
            id: "q-1",
            order: 1,
            questionText: "What is correct?",
            optionA: "First",
            optionB: "Second",
            optionC: "Third",
            optionD: "Fourth",
            correctOption: "A",
            explanation: "Because first is correct.",
            selectedOption: "A",
            isCorrect: true,
          },
        ],
      });

      const res = await getReviewRoute(new Request("http://localhost/api/quizzes/" + validUuid + "/review"), {
        params: Promise.resolve({ attemptId: validUuid }),
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as { questions: Array<{ correctOption: string; explanation: string; isCorrect: boolean }> };
      expect(data.questions[0].correctOption).toBe("A");
      expect(data.questions[0].explanation).toBe("Because first is correct.");
      expect(data.questions[0].isCorrect).toBe(true);
    });
  });
});
