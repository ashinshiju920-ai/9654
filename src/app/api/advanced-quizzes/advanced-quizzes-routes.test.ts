import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn(),
}));

vi.mock("@/lib/entitlements", () => ({
  canUserAccessAdvancedCollection: vi.fn(),
  canUserAccessAdvancedAttempt: vi.fn(),
}));

vi.mock("@/lib/admin/advanced-practice", () => ({
  createAdvancedQuizAttempt: vi.fn(),
  getLockedAdvancedQuizAttempt: vi.fn(),
  submitAdvancedQuizAttempt: vi.fn(),
  getAdvancedQuizAttemptReview: vi.fn(),
}));

import { requireUser } from "@/lib/auth";
import {
  canUserAccessAdvancedAttempt,
  canUserAccessAdvancedCollection,
} from "@/lib/entitlements";
import {
  createAdvancedQuizAttempt,
  getAdvancedQuizAttemptReview,
  getLockedAdvancedQuizAttempt,
  submitAdvancedQuizAttempt,
} from "@/lib/admin/advanced-practice";

import { POST as createAdvancedRoute } from "./route";
import { GET as getAdvancedAttemptRoute } from "./[attemptId]/route";
import { POST as submitAdvancedAttemptRoute } from "./[attemptId]/submit/route";
import { GET as reviewAdvancedAttemptRoute } from "./[attemptId]/review/route";

const attemptId = "11111111-1111-4111-a111-111111111111";
const student = {
  id: "student-1",
  email: "student@example.com",
  fullName: "Student",
  role: "student",
  accountStatus: "active",
};
const admin = { ...student, id: "admin-1", email: "admin@example.com", role: "admin" };

describe("Advanced quiz entitlement routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated user starts Advanced quiz", async () => {
    vi.mocked(requireUser).mockRejectedValue(new Error("Unauthorized"));

    const res = await createAdvancedRoute(
      new Request("http://localhost/api/advanced-quizzes", {
        method: "POST",
        body: JSON.stringify({ collectionId: "col-1" }),
      }),
    );

    expect(res.status).toBe(401);
  });

  it("denies authenticated student without Advanced entitlement", async () => {
    vi.mocked(requireUser).mockResolvedValue(student);
    vi.mocked(canUserAccessAdvancedCollection).mockResolvedValue({
      allowed: false,
      reason: "forbidden",
      context: { courseId: "ielts-course" },
    } as never);

    const res = await createAdvancedRoute(
      new Request("http://localhost/api/advanced-quizzes", {
        method: "POST",
        body: JSON.stringify({ collectionId: "col-1" }),
      }),
    );

    expect(res.status).toBe(403);
    expect(createAdvancedQuizAttempt).not.toHaveBeenCalled();
  });

  it("does not allow collection slug starts without course slug", async () => {
    vi.mocked(requireUser).mockResolvedValue(student);

    const res = await createAdvancedRoute(
      new Request("http://localhost/api/advanced-quizzes", {
        method: "POST",
        body: JSON.stringify({ collectionSlug: "set-1" }),
      }),
    );

    expect(res.status).toBe(400);
  });

  it("allows student with Advanced entitlement to start Advanced quiz", async () => {
    vi.mocked(requireUser).mockResolvedValue(student);
    vi.mocked(canUserAccessAdvancedCollection).mockResolvedValue({
      allowed: true,
      reason: "allowed",
      context: { courseId: "ielts-course" },
    } as never);
    vi.mocked(createAdvancedQuizAttempt).mockResolvedValue({
      attemptId,
      collectionTitle: "IELTS Set 1",
      collectionSlug: "set-1",
      courseName: "IELTS",
      courseSlug: "ielts",
      totalQuestions: 1,
      questions: [],
    });

    const res = await createAdvancedRoute(
      new Request("http://localhost/api/advanced-quizzes", {
        method: "POST",
        body: JSON.stringify({ collectionId: "col-1" }),
      }),
    );

    expect(res.status).toBe(201);
  });

  it("returns 404 when student tries another student's attempt", async () => {
    vi.mocked(requireUser).mockResolvedValue(student);
    vi.mocked(canUserAccessAdvancedAttempt).mockResolvedValue({
      allowed: false,
      reason: "not_found",
      context: { userId: "other-student" },
    } as never);

    const res = await getAdvancedAttemptRoute(new Request(`http://localhost/api/advanced-quizzes/${attemptId}`), {
      params: Promise.resolve({ attemptId }),
    });

    expect(res.status).toBe(404);
    expect(getLockedAdvancedQuizAttempt).not.toHaveBeenCalled();
  });

  it("denies submit when Advanced entitlement was revoked or expired", async () => {
    vi.mocked(requireUser).mockResolvedValue(student);
    vi.mocked(canUserAccessAdvancedAttempt).mockResolvedValue({
      allowed: false,
      reason: "forbidden",
      context: { userId: student.id },
    } as never);

    const res = await submitAdvancedAttemptRoute(
      new Request(`http://localhost/api/advanced-quizzes/${attemptId}/submit`, {
        method: "POST",
        body: JSON.stringify({ answers: [{ questionId: "q-1", selectedOption: "A" }] }),
      }),
      { params: Promise.resolve({ attemptId }) },
    );

    expect(res.status).toBe(403);
    expect(submitAdvancedQuizAttempt).not.toHaveBeenCalled();
  });

  it("denies review for another student's attempt", async () => {
    vi.mocked(requireUser).mockResolvedValue(student);
    vi.mocked(canUserAccessAdvancedAttempt).mockResolvedValue({
      allowed: false,
      reason: "not_found",
      context: { userId: "other-student" },
    } as never);

    const res = await reviewAdvancedAttemptRoute(
      new Request(`http://localhost/api/advanced-quizzes/${attemptId}/review`),
      { params: Promise.resolve({ attemptId }) },
    );

    expect(res.status).toBe(404);
    expect(getAdvancedQuizAttemptReview).not.toHaveBeenCalled();
  });

  it("admin retains Advanced attempt access", async () => {
    vi.mocked(requireUser).mockResolvedValue(admin);
    vi.mocked(canUserAccessAdvancedAttempt).mockResolvedValue({
      allowed: true,
      reason: "allowed",
      context: { userId: "student-1" },
    } as never);
    vi.mocked(getLockedAdvancedQuizAttempt).mockResolvedValue({
      attempt: {
        id: attemptId,
        userId: "student-1",
        courseId: "course-1",
        courseSlug: "ielts",
        courseName: "IELTS",
        collectionId: "col-1",
        collectionTitle: "Set 1",
        collectionSlug: "set-1",
        totalQuestions: 1,
        status: "in_progress",
        score: null,
        percentage: null,
        startedAt: new Date(),
        submittedAt: null,
      },
      questions: [],
    });

    const res = await getAdvancedAttemptRoute(new Request(`http://localhost/api/advanced-quizzes/${attemptId}`), {
      params: Promise.resolve({ attemptId }),
    });

    expect(res.status).toBe(200);
    expect(getLockedAdvancedQuizAttempt).toHaveBeenCalledWith(attemptId, admin.id, {
      allowAdminAccess: true,
    });
  });
});
