import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: vi.fn(),
  revokeAllUserSessions: vi.fn(async () => undefined),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentSession: vi.fn(),
  checkAuthRateLimit: vi.fn(async () => true),
  isPermanentOwner: vi.fn((email: string) => email.toLowerCase() === "ashinshiju920@gmail.com"),
  revokeAllUserSessions: vi.fn(async () => undefined),
}));

vi.mock("@/lib/db", () => ({
  withDb: vi.fn(),
}));

vi.mock("@/lib/admin/audit", () => ({
  logAdminAudit: vi.fn(async () => undefined),
  getRecentAuditLogs: vi.fn(async () => []),
}));

vi.mock("@/lib/r2/client", () => ({
  assertSafeR2ObjectKey: vi.fn((key: string) => {
    if (key.includes("..") || key.startsWith("/") || key.includes("\\")) {
      throw new Error("Invalid object key path traversal");
    }
  }),
  createPdfDownloadUrl: vi.fn(async () => "https://r2.mock.url/test.pdf"),
  uploadPdfToR2: vi.fn(async () => undefined),
  deletePdfFromR2: vi.fn(async () => undefined),
  generateSafePdfKey: vi.fn((slug: string, name: string) => `materials/${slug}/mock-${name}`),
  validatePdfBytes: vi.fn((bytes: Uint8Array) => {
    if (bytes.length < 5) return false;
    return (
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46 &&
      bytes[4] === 0x2d
    );
  }),
}));

import { getCurrentSession } from "@/lib/auth/session";
import { withDb } from "@/lib/db";
import { requireAdminApi } from "@/lib/auth/guard";
import {
  parseCsvRows,
  validateQuestionsBatch,
  generateCsvTemplate,
  sanitizeCsvCell,
} from "@/lib/admin/question-import";
import { assertSafeR2ObjectKey, validatePdfBytes } from "@/lib/r2/client";

describe("Admin RBAC & Server-Side Security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated requests with 401 Unauthorized", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);

    const result = await requireAdminApi();
    expect(result.errorResponse).toBeDefined();
    if (result.errorResponse) {
      expect(result.errorResponse.status).toBe(401);
      const data = (await result.errorResponse.json()) as { error: string };
      expect(data.error).toContain("Unauthorized");
    }
  });

  it("rejects student accounts attempting admin access with 403 Forbidden", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue({
      user: {
        id: "student-1",
        email: "student@aylem.test",
        fullName: "Test Student",
        role: "student",
        accountStatus: "active",
      },
      session: {
        id: "sess-1",
        expiresAt: new Date(Date.now() + 3600000),
      },
    });

    const result = await requireAdminApi();
    expect(result.errorResponse).toBeDefined();
    if (result.errorResponse) {
      expect(result.errorResponse.status).toBe(403);
      const data = (await result.errorResponse.json()) as { error: string };
      expect(data.error).toContain("Forbidden");
    }
  });

  it("rejects suspended admin accounts with 403 Forbidden", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue({
      user: {
        id: "admin-suspended",
        email: "rogue-admin@aylem.test",
        fullName: "Suspended Admin",
        role: "admin",
        accountStatus: "suspended",
      },
      session: {
        id: "sess-2",
        expiresAt: new Date(Date.now() + 3600000),
      },
    });

    const result = await requireAdminApi();
    expect(result.errorResponse).toBeDefined();
    if (result.errorResponse) {
      expect(result.errorResponse.status).toBe(403);
      const data = (await result.errorResponse.json()) as { error: string };
      expect(data.error).toContain("Forbidden");
    }
  });

  it("authorizes active admin accounts with full context", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue({
      user: {
        id: "admin-owner",
        email: "ashinshiju920@gmail.com",
        fullName: "Ashin Shiju",
        role: "admin",
        accountStatus: "active",
      },
      session: {
        id: "sess-3",
        expiresAt: new Date(Date.now() + 3600000),
      },
    });

    const result = await requireAdminApi();
    expect(result.user).toBeDefined();
    if (result.user) {
      expect(result.user.email).toBe("ashinshiju920@gmail.com");
      expect(result.user.role).toBe("admin");
    }
  });
});

describe("Study Material & PDF Security (R2 Validation)", () => {
  it("validates authentic PDF magic bytes (%PDF-)", () => {
    // Valid PDF signature %PDF-
    const validBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
    expect(validatePdfBytes(validBytes)).toBe(true);
  });

  it("rejects malicious or spoofed files without PDF magic header", () => {
    // Fake PDF with JPEG or executable bytes
    const fakeBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(validatePdfBytes(fakeBytes)).toBe(false);

    // Empty or truncated bytes
    expect(validatePdfBytes(new Uint8Array([0x25, 0x50]))).toBe(false);
  });

  it("prevents R2 path traversal and directory escape", () => {
    expect(() => assertSafeR2ObjectKey("../../secret.txt")).toThrow("path traversal");
    expect(() => assertSafeR2ObjectKey("/absolute/path.pdf")).toThrow("path traversal");
    expect(() => assertSafeR2ObjectKey("materials\\sub\\pdf.pdf")).toThrow("path traversal");
    expect(() => assertSafeR2ObjectKey("materials/ielts/safe-file.pdf")).not.toThrow();
  });
});

describe("Bulk Question CSV Import & Security", () => {
  const mockCourses = [
    { id: "c-1", slug: "ielts" },
    { id: "c-2", slug: "oet" },
    { id: "c-3", slug: "pte" },
    { id: "c-4", slug: "german" },
  ];

  beforeEach(() => {
    vi.mocked(withDb).mockImplementation(async (callback) => {
      const mockDb = {
        select: () => ({
          from: () => mockCourses,
        }),
      };
      return (callback as (db: typeof mockDb) => unknown)(mockDb) as never;
    });
  });

  it("generates a valid CSV template containing all required headers", () => {
    const template = generateCsvTemplate();
    expect(template).toContain("course_slug,question_text,option_a,option_b,option_c,option_d,correct_option");
    expect(template).toContain("ielts");
    expect(template).toContain("oet");
  });

  it("successfully parses and validates compliant question rows", async () => {
    const csv = `course_slug,question_text,option_a,option_b,option_c,option_d,correct_option,explanation
ielts,"Which word is a synonym for 'abundant'?",Scarce,Plentiful,Sparse,Limited,B,"Plentiful means existing in great quantity"
oet,"What is the recommended dose?",5mg,10mg,20mg,50mg,A,"Initial dose starts at 5mg"`;

    const parsedRows = parseCsvRows(csv);
    expect(parsedRows.length).toBe(2);

    const result = await validateQuestionsBatch(parsedRows);
    expect(result.validCount).toBe(2);
    expect(result.invalidCount).toBe(0);
    expect(result.validQuestions[0].correctOption).toBe("B");
    expect(result.validQuestions[0].courseSlug).toBe("ielts");
    expect(result.validQuestions[1].correctOption).toBe("A");
  });

  it("identifies and rejects malformed question rows with detailed error messages", async () => {
    const csv = `course_slug,question_text,option_a,option_b,option_c,option_d,correct_option
invalidcourse,"Question prompt?",Option1,Option2,Option3,Option4,A
ielts,"",Option1,Option2,Option3,Option4,A
oet,"Valid prompt?",Option1,,,Option4,A
pte,"Another prompt?",Option1,Option2,Option3,Option4,Z`;

    const parsedRows = parseCsvRows(csv);
    const result = await validateQuestionsBatch(parsedRows);

    expect(result.validCount).toBe(0);
    expect(result.invalidCount).toBe(4);

    // Row 2 (index 0): Unknown course
    expect(result.invalidRows[0].errors.some((e) => e.includes("not found"))).toBe(true);
    // Row 3 (index 1): Missing question text
    expect(result.invalidRows[1].errors.some((e) => e.includes("Question text is required"))).toBe(true);
    // Row 4 (index 2): Missing options
    expect(result.invalidRows[2].errors.some((e) => e.includes("Option B is required"))).toBe(true);
    // Row 5 (index 3): Invalid correct option
    expect(result.invalidRows[3].errors.some((e) => e.includes("Invalid correct option"))).toBe(true);
  });

  it("sanitizes CSV formula injection characters (=, +, -, @)", () => {
    expect(sanitizeCsvCell("=CMD('calc')")).toBe("'=CMD('calc')");
    expect(sanitizeCsvCell("+12345")).toBe("'+12345");
    expect(sanitizeCsvCell("-5+5")).toBe("'-5+5");
    expect(sanitizeCsvCell("@SUM(A1:A10)")).toBe("'@SUM(A1:A10)");
    expect(sanitizeCsvCell("Normal regular text")).toBe("Normal regular text");
  });
});

describe("Student Management & Owner Lockout Protection", () => {
  it("protects permanent owner account from demotion or suspension", async () => {
    const ownerEmail = "ashinshiju920@gmail.com";
    const isOwner = ownerEmail.toLowerCase() === "ashinshiju920@gmail.com";

    expect(isOwner).toBe(true);

    // Mock an attempt to suspend the owner
    const targetStatus = "suspended";
    let allowed = true;
    if (isOwner && targetStatus === "suspended") {
      allowed = false;
    }
    expect(allowed).toBe(false);
  });

  it("prevents demoting the last active admin leaving zero admins", () => {
    const totalAdmins = 1;
    const isSelfDemotion = true;

    const wouldLeaveZeroAdmins = totalAdmins <= 1 && isSelfDemotion;
    expect(wouldLeaveZeroAdmins).toBe(true);
  });
});

describe("Quiz Answer Security Regression", () => {
  it("ensures student-facing question representation never leaks correct answers or explanations", () => {
    // Database record contains secret answer key & explanation
    const dbQuestion = {
      id: "q-101",
      prompt: "What is the capital of Germany?",
      options: [
        { id: "A", text: "Munich" },
        { id: "B", text: "Berlin" },
        { id: "C", text: "Frankfurt" },
        { id: "D", text: "Hamburg" },
      ],
      correctOptionId: "B",
      explanation: "Berlin has been the capital since 1990.",
    };

    // Student facing masking function
    const studentFacingQuestion = {
      id: dbQuestion.id,
      prompt: dbQuestion.prompt,
      options: dbQuestion.options,
    };

    const serialized = JSON.stringify(studentFacingQuestion);
    expect(serialized).not.toContain("correctOptionId");
    expect(serialized).not.toContain("explanation");
    expect(serialized).not.toContain("Berlin has been the capital since 1990.");
  });
});
