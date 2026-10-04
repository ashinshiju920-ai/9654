import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  withDb: vi.fn(),
}));

vi.mock("@/lib/entitlements", () => ({
  userHasCourseEntitlement: vi.fn(),
}));

vi.mock("@/lib/r2/client", () => ({
  createPdfDownloadResponse: vi.fn(async () => new Response("pdf-bytes", { status: 200 })),
}));

import { getCurrentUser } from "@/lib/auth";
import { withDb } from "@/lib/db";
import { userHasCourseEntitlement } from "@/lib/entitlements";
import { GET } from "./[pdfId]/download/route";

const pdfId = "11111111-1111-4111-a111-111111111111";
const student = {
  id: "student-1",
  email: "student@example.com",
  fullName: "Student",
  role: "student",
  accountStatus: "active",
};

describe("Protected material entitlement checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(withDb).mockResolvedValue([
      {
        id: pdfId,
        title: "IELTS PDF",
        r2ObjectKey: "materials/ielts/file.pdf",
        courseId: "ielts-course",
        isPublished: true,
        courseActive: true,
      },
    ] as never);
  });

  it("requires authentication for protected material", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const res = await GET(new Request(`http://localhost/api/materials/${pdfId}/download`), {
      params: Promise.resolve({ pdfId }),
    });

    expect(res.status).toBe(401);
  });

  it("denies student without Standard or Advanced entitlement", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(student);
    vi.mocked(userHasCourseEntitlement).mockResolvedValue(false);

    const res = await GET(new Request(`http://localhost/api/materials/${pdfId}/download`), {
      params: Promise.resolve({ pdfId }),
    });

    expect(res.status).toBe(403);
  });

  it("allows entitled student to download protected material", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(student);
    vi.mocked(userHasCourseEntitlement).mockResolvedValue(true);

    const res = await GET(new Request(`http://localhost/api/materials/${pdfId}/download`), {
      params: Promise.resolve({ pdfId }),
    });

    expect(res.status).toBe(200);
  });
});
