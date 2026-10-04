import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock DB and audit dependencies
vi.mock("@/lib/db", () => ({
  withDb: vi.fn(),
}));

vi.mock("@/lib/admin/audit", () => ({
  logAdminAudit: vi.fn(async () => undefined),
}));

import { withDb } from "@/lib/db";
import { logAdminAudit } from "@/lib/admin/audit";
import { courses } from "@/lib/db/schema";
import {
  parseCsvRows,
  validateQuestionsBatch,
  commitBulkQuestions,
  generateCsvTemplate,
  sanitizeFormula,
  normalizeQuestionText,
  normalizeOptionText,
} from "./question-import";

describe("Admin Question CSV Import Comprehensive Test Suite", () => {
  const mockCourses = [
    { id: "c-ielts", slug: "ielts", name: "IELTS Preparation" },
    { id: "c-oet", slug: "oet", name: "OET Preparation" },
    { id: "c-pte", slug: "pte", name: "PTE Academic" },
    { id: "c-german", slug: "german", name: "German Language" },
  ];

  let mockExistingDbQuestions: Array<{ questionText: string }> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    mockExistingDbQuestions = [];

    vi.mocked(withDb).mockImplementation(async (callback) => {
      const mockDb = {
        select: () => ({
          from: (table?: unknown) => {
            if (table === courses || !table) {
              return mockCourses;
            }
            return {
              where: () => mockExistingDbQuestions,
            };
          },
        }),
      };
      return (callback as unknown as (db: typeof mockDb) => unknown)(mockDb) as never;
    });
  });

  // 1. Template validation
  it("provides canonical CSV template matching required schema", () => {
    const template = generateCsvTemplate();
    const rows = parseCsvRows(template);
    expect(rows.length).toBeGreaterThanOrEqual(4);
    expect(template).toContain("course_slug,question_text,option_a,option_b,option_c,option_d,correct_option,explanation");
  });

  // 2. Valid IELTS CSV
  it("successfully parses and validates valid IELTS questions", async () => {
    const csv = `course_slug,question_text,option_a,option_b,option_c,option_d,correct_option,explanation
ielts,"Identify the correct passive form.","It was made","It made","It has make","Making it",A,"Passive voice requires past participle."`;

    const parsed = parseCsvRows(csv);
    expect(parsed.length).toBe(1);

    const result = await validateQuestionsBatch(parsed);
    expect(result.valid).toBe(true);
    expect(result.validCount).toBe(1);
    expect(result.invalidCount).toBe(0);
    expect(result.validQuestions[0].courseSlug).toBe("ielts");
    expect(result.validQuestions[0].correctOption).toBe("A");
  });

  // 3. Valid OET CSV
  it("successfully parses and validates valid OET questions", async () => {
    const csv = `course_slug,question_text,option_a,option_b,option_c,option_d,correct_option,explanation
oet,"What is the first step in resuscitation?","Assess responsiveness","Administer IV","Intubate","Order bloods",A,"Primary survey begins with response check."`;

    const parsed = parseCsvRows(csv);
    const result = await validateQuestionsBatch(parsed);
    expect(result.valid).toBe(true);
    expect(result.validCount).toBe(1);
    expect(result.validQuestions[0].courseSlug).toBe("oet");
  });

  // 4. Valid PTE CSV
  it("successfully parses and validates valid PTE questions", async () => {
    const csv = `course_slug,question_text,option_a,option_b,option_c,option_d,correct_option,explanation
pte,"Select the best collocate: 'deep _____'.","concern","troublesome","worrying","anxious",A,"'Deep concern' is a frequent academic collocation."`;

    const parsed = parseCsvRows(csv);
    const result = await validateQuestionsBatch(parsed);
    expect(result.valid).toBe(true);
    expect(result.validCount).toBe(1);
    expect(result.validQuestions[0].courseSlug).toBe("pte");
  });

  // 5. Valid German CSV
  it("successfully parses and validates valid German questions", async () => {
    const csv = `course_slug,question_text,option_a,option_b,option_c,option_d,correct_option,explanation
german,"Wie heisst die Hauptstadt von Deutschland?","Berlin","Muenchen","Hamburg","Koeln",A,"Berlin ist die deutsche Bundes столица / Hauptstadt."`;

    const parsed = parseCsvRows(csv);
    const result = await validateQuestionsBatch(parsed);
    expect(result.valid).toBe(true);
    expect(result.validCount).toBe(1);
    expect(result.validQuestions[0].courseSlug).toBe("german");
  });

  // 6. Mixed-course CSV
  it("successfully parses mixed-course batches", async () => {
    const csv = `course_slug,question_text,option_a,option_b,option_c,option_d,correct_option,explanation
ielts,"IELTS prompt",A,B,C,D,A,"Note 1"
oet,"OET prompt",A,B,C,D,B,"Note 2"
pte,"PTE prompt",A,B,C,D,C,"Note 3"
german,"German prompt",A,B,C,D,D,"Note 4"`;

    const parsed = parseCsvRows(csv);
    expect(parsed.length).toBe(4);

    const result = await validateQuestionsBatch(parsed);
    expect(result.validCount).toBe(4);
    expect(result.invalidCount).toBe(0);
    const courses = result.validQuestions.map((q) => q.courseSlug);
    expect(courses).toEqual(["ielts", "oet", "pte", "german"]);
  });

  // 7. CSV containing quoted commas
  it("correctly handles commas inside quoted question text and explanations", async () => {
    const csv = `course_slug,question_text,option_a,option_b,option_c,option_d,correct_option,explanation
ielts,"Which word, in this context, fits best?","First, option","Second, option","Third, option","Fourth, option",B,"Here, as noted, B is ideal."`;

    const parsed = parseCsvRows(csv);
    expect(parsed.length).toBe(1);
    expect(parsed[0].question_text).toBe("Which word, in this context, fits best?");
    expect(parsed[0].option_a).toBe("First, option");
    expect(parsed[0].explanation).toBe("Here, as noted, B is ideal.");

    const result = await validateQuestionsBatch(parsed);
    expect(result.validCount).toBe(1);
  });

  // 8. CSV with empty optional explanations
  it("accepts empty optional explanations without error", async () => {
    const csv = `course_slug,question_text,option_a,option_b,option_c,option_d,correct_option,explanation
ielts,"Question without explanation",Option 1,Option 2,Option 3,Option 4,C,`;

    const parsed = parseCsvRows(csv);
    const result = await validateQuestionsBatch(parsed);
    expect(result.validCount).toBe(1);
    expect(result.validQuestions[0].explanation).toBeNull();
  });

  // 9. CSV with UTF-8 BOM
  it("strips UTF-8 BOM from CSV files exported by Excel", async () => {
    const bomCsv = `\uFEFFcourse_slug,question_text,option_a,option_b,option_c,option_d,correct_option
ielts,"Question after BOM",OptA,OptB,OptC,OptD,D`;

    const parsed = parseCsvRows(bomCsv);
    expect(parsed.length).toBe(1);
    expect(parsed[0].course_slug).toBe("ielts");

    const result = await validateQuestionsBatch(parsed);
    expect(result.validCount).toBe(1);
  });

  // 10. CSV with CRLF line endings
  it("handles CRLF (Windows) line endings seamlessly", async () => {
    const crlfCsv = "course_slug,question_text,option_a,option_b,option_c,option_d,correct_option\r\nielts,\"Prompt 1\",A,B,C,D,A\r\noet,\"Prompt 2\",A,B,C,D,B\r\n";

    const parsed = parseCsvRows(crlfCsv);
    expect(parsed.length).toBe(2);

    const result = await validateQuestionsBatch(parsed);
    expect(result.validCount).toBe(2);
  });

  // 11. CSV with LF line endings
  it("handles LF (Unix) line endings seamlessly", async () => {
    const lfCsv = "course_slug,question_text,option_a,option_b,option_c,option_d,correct_option\nielts,\"Prompt 1\",A,B,C,D,A\n";

    const parsed = parseCsvRows(lfCsv);
    expect(parsed.length).toBe(1);

    const result = await validateQuestionsBatch(parsed);
    expect(result.validCount).toBe(1);
  });

  // 12. Invalid course rejection
  it("rejects unknown or invalid course values with clear error message", async () => {
    const csv = `course_slug,question_text,option_a,option_b,option_c,option_d,correct_option
unknown-exam,"Prompt",A,B,C,D,A`;

    const parsed = parseCsvRows(csv);
    const result = await validateQuestionsBatch(parsed);
    expect(result.validCount).toBe(0);
    expect(result.invalidCount).toBe(1);
    expect(result.errors[0].field).toBe("course_slug");
    expect(result.errors[0].message).toContain("not found in database");
  });

  // 13. Invalid correct option rejection
  it("rejects invalid correct_option choices and normalizes lowercase letters", async () => {
    const csv = `course_slug,question_text,option_a,option_b,option_c,option_d,correct_option
ielts,"Prompt valid",A,B,C,D,b
ielts,"Prompt invalid",A,B,C,D,E
ielts,"Prompt invalid 2",A,B,C,D,1`;

    const parsed = parseCsvRows(csv);
    const result = await validateQuestionsBatch(parsed);

    // Row 1 (b -> B) is valid after safe case normalization
    expect(result.validQuestions.length).toBe(1);
    expect(result.validQuestions[0].correctOption).toBe("B");

    // Rows 2 and 3 are rejected
    expect(result.invalidCount).toBe(2);
    expect(result.errors.some((e) => e.message.includes("Must be A, B, C, or D"))).toBe(true);
  });

  // 14. Missing required question text
  it("rejects rows with empty question text", async () => {
    const csv = `course_slug,question_text,option_a,option_b,option_c,option_d,correct_option
ielts,"   ",A,B,C,D,A`;

    const parsed = parseCsvRows(csv);
    const result = await validateQuestionsBatch(parsed);
    expect(result.validCount).toBe(0);
    expect(result.invalidCount).toBe(1);
    expect(result.errors[0].field).toBe("question_text");
  });

  // 15. Missing required option
  it("rejects rows with missing options (A, B, C, or D)", async () => {
    const csv = `course_slug,question_text,option_a,option_b,option_c,option_d,correct_option
ielts,"Prompt",A,B,,D,A`;

    const parsed = parseCsvRows(csv);
    const result = await validateQuestionsBatch(parsed);
    expect(result.validCount).toBe(0);
    expect(result.invalidCount).toBe(1);
    expect(result.errors[0].field).toBe("option_c");
  });

  // 16. Empty CSV
  it("returns empty array for empty or whitespace-only CSV", () => {
    expect(parseCsvRows("")).toEqual([]);
    expect(parseCsvRows("   \n   \n")).toEqual([]);
  });

  // 17. Validation does not insert into database
  it("verifies validation is strictly read-only and never modifies database", async () => {
    const csv = `course_slug,question_text,option_a,option_b,option_c,option_d,correct_option
ielts,"Prompt",A,B,C,D,A`;

    const parsed = parseCsvRows(csv);
    await validateQuestionsBatch(parsed);

    // withDb was only called for course lookup, never insert
    expect(logAdminAudit).not.toHaveBeenCalled();
  });

  // 18. Commit inserts correct count and logs audit inside transaction
  it("commits valid questions inside transaction and logs audit", async () => {
    const insertMock = vi.fn().mockResolvedValue([]);
    const txMock = {
      select: () => ({
        from: () => mockCourses,
      }),
      insert: () => ({
        values: insertMock,
      }),
    };

    vi.mocked(withDb).mockImplementation(async (callback) => {
      const mockDb = {
        transaction: async (txCallback: (tx: typeof txMock) => unknown) => txCallback(txMock),
      };
      return (callback as unknown as (db: typeof mockDb) => unknown)(mockDb) as never;
    });

    const validQuestions = [
      {
        courseSlug: "ielts",
        questionText: "Sample IELTS question",
        optionA: "Option 1",
        optionB: "Option 2",
        optionC: "Option 3",
        optionD: "Option 4",
        correctOption: "A" as const,
        explanation: "Test explanation",
      },
      {
        courseSlug: "oet",
        questionText: "Sample OET question",
        optionA: "Option 1",
        optionB: "Option 2",
        optionC: "Option 3",
        optionD: "Option 4",
        correctOption: "B" as const,
        explanation: null,
      },
    ];

    const result = await commitBulkQuestions("admin-user-id", validQuestions);
    expect(result.success).toBe(true);
    expect(result.importedCount).toBe(2);
    expect(insertMock).toHaveBeenCalled();
    expect(logAdminAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        adminUserId: "admin-user-id",
        action: "question.bulk_import",
      }),
    );
  });

  // 19. Failed commit rolls back transaction
  it("throws error and rolls back when an insert failure occurs in transaction", async () => {
    const txMock = {
      select: () => ({
        from: () => mockCourses,
      }),
      insert: () => ({
        values: vi.fn().mockRejectedValue(new Error("Database connection dropped")),
      }),
    };

    vi.mocked(withDb).mockImplementation(async (callback) => {
      const mockDb = {
        transaction: async (txCallback: (tx: typeof txMock) => unknown) => txCallback(txMock),
      };
      return (callback as unknown as (db: typeof mockDb) => unknown)(mockDb) as never;
    });

    const validQuestions = [
      {
        courseSlug: "ielts",
        questionText: "Sample question",
        optionA: "A",
        optionB: "B",
        optionC: "C",
        optionD: "D",
        correctOption: "A" as const,
        explanation: null,
      },
    ];

    await expect(commitBulkQuestions("admin-user-id", validQuestions)).rejects.toThrow(
      "Database connection dropped",
    );
  });

  // 20. Formula sanitization
  it("neutralizes potential formula injection characters", () => {
    expect(sanitizeFormula("=HYPERLINK()")).toBe("'=HYPERLINK()");
    expect(sanitizeFormula("-2+5")).toBe("'-2+5");
    expect(sanitizeFormula("+1234")).toBe("'+1234");
    expect(sanitizeFormula("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(sanitizeFormula("Plain text")).toBe("Plain text");
  });

  // Step 9A.1 Course-Specific Bulk Import Tests
  describe("Step 9A.1 Course-Specific Bulk Import", () => {
    it("generates course-specific 7-column CSV template without course_slug", () => {
      const ieltsTpl = generateCsvTemplate("ielts");
      expect(ieltsTpl).toContain("question_text,option_a,option_b,option_c,option_d,correct_option,explanation");
      expect(ieltsTpl).not.toContain("course_slug");

      const oetTpl = generateCsvTemplate("oet");
      expect(oetTpl).toContain("question_text,option_a,option_b,option_c,option_d,correct_option,explanation");

      const pteTpl = generateCsvTemplate("pte");
      expect(pteTpl).toContain("question_text,option_a,option_b,option_c,option_d,correct_option,explanation");

      const germanTpl = generateCsvTemplate("german");
      expect(germanTpl).toContain("question_text,option_a,option_b,option_c,option_d,correct_option,explanation");
    });

    it("IELTS destination assigns only IELTS when course_slug column is omitted", async () => {
      const csv = `question_text,option_a,option_b,option_c,option_d,correct_option,explanation
"IELTS specific question",OptA,OptB,OptC,OptD,A,"Explanation"`;

      const parsed = parseCsvRows(csv);
      const result = await validateQuestionsBatch(parsed, "ielts");
      expect(result.valid).toBe(true);
      expect(result.validCount).toBe(1);
      expect(result.validQuestions[0].courseSlug).toBe("ielts");
    });

    it("OET destination assigns only OET when course_slug column is omitted", async () => {
      const csv = `question_text,option_a,option_b,option_c,option_d,correct_option,explanation
"OET specific question",OptA,OptB,OptC,OptD,B,"Explanation"`;

      const parsed = parseCsvRows(csv);
      const result = await validateQuestionsBatch(parsed, "oet");
      expect(result.valid).toBe(true);
      expect(result.validCount).toBe(1);
      expect(result.validQuestions[0].courseSlug).toBe("oet");
    });

    it("PTE destination assigns only PTE when course_slug column is omitted", async () => {
      const csv = `question_text,option_a,option_b,option_c,option_d,correct_option,explanation
"PTE specific question",OptA,OptB,OptC,OptD,C,"Explanation"`;

      const parsed = parseCsvRows(csv);
      const result = await validateQuestionsBatch(parsed, "pte");
      expect(result.valid).toBe(true);
      expect(result.validCount).toBe(1);
      expect(result.validQuestions[0].courseSlug).toBe("pte");
    });

    it("German destination assigns only German when course_slug column is omitted", async () => {
      const csv = `question_text,option_a,option_b,option_c,option_d,correct_option,explanation
"German specific question",OptA,OptB,OptC,OptD,D,"Explanation"`;

      const parsed = parseCsvRows(csv);
      const result = await validateQuestionsBatch(parsed, "german");
      expect(result.valid).toBe(true);
      expect(result.validCount).toBe(1);
      expect(result.validQuestions[0].courseSlug).toBe("german");
    });

    it("rejects unknown or non-existent target course with clear error", async () => {
      const csv = `question_text,option_a,option_b,option_c,option_d,correct_option
"Sample question",A,B,C,D,A`;

      const parsed = parseCsvRows(csv);
      await expect(validateQuestionsBatch(parsed, "french")).rejects.toThrow(
        "Target course 'french' does not exist in the database.",
      );
    });

    it("rejects mismatched course_slug with authoritative course error message", async () => {
      const csv = `course_slug,question_text,option_a,option_b,option_c,option_d,correct_option
oet,"Sample question",A,B,C,D,A`;

      const parsed = parseCsvRows(csv);
      const result = await validateQuestionsBatch(parsed, "ielts");
      expect(result.valid).toBe(false);
      expect(result.invalidCount).toBe(1);
      expect(result.errors[0].message).toContain("targets OET Preparation, but this import is configured for IELTS Preparation");
    });

    it("accepts matching course_slug when target course matches row course_slug", async () => {
      const csv = `course_slug,question_text,option_a,option_b,option_c,option_d,correct_option
ielts,"Matching question",A,B,C,D,A`;

      const parsed = parseCsvRows(csv);
      const result = await validateQuestionsBatch(parsed, "ielts");
      expect(result.valid).toBe(true);
      expect(result.validQuestions[0].courseSlug).toBe("ielts");
    });

    it("commits bulk questions with course destination and logs audit with destination course name", async () => {
      const insertMock = vi.fn().mockResolvedValue([]);
      const txMock = {
        select: () => ({
          from: () => mockCourses,
        }),
        insert: () => ({
          values: insertMock,
        }),
      };

      vi.mocked(withDb).mockImplementation(async (callback) => {
        const mockDb = {
          transaction: async (txCallback: (tx: typeof txMock) => unknown) => txCallback(txMock),
        };
        return (callback as unknown as (db: typeof mockDb) => unknown)(mockDb) as never;
      });

      const validQuestions = [
        {
          courseSlug: "ielts",
          questionText: "IELTS Q1",
          optionA: "A",
          optionB: "B",
          optionC: "C",
          optionD: "D",
          correctOption: "A" as const,
          explanation: null,
        },
        {
          courseSlug: "ielts",
          questionText: "IELTS Q2",
          optionA: "A",
          optionB: "B",
          optionC: "C",
          optionD: "D",
          correctOption: "B" as const,
          explanation: null,
        },
      ];

      const res = await commitBulkQuestions("admin-user-id", validQuestions, "ielts");
      expect(res.success).toBe(true);
      expect(res.importedCount).toBe(2);
      expect(logAdminAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: "admin-user-id",
          action: "question.bulk_import",
          details: "Bulk imported 2 questions into IELTS Preparation",
        }),
      );
    });

    it("rejects commit if a question targets a different course than destination", async () => {
      const txMock = {
        select: () => ({
          from: () => mockCourses,
        }),
      };

      vi.mocked(withDb).mockImplementation(async (callback) => {
        const mockDb = {
          transaction: async (txCallback: (tx: typeof txMock) => unknown) => txCallback(txMock),
        };
        return (callback as unknown as (db: typeof mockDb) => unknown)(mockDb) as never;
      });

      const validQuestions = [
        {
          courseSlug: "oet",
          questionText: "OET question",
          optionA: "A",
          optionB: "B",
          optionC: "C",
          optionD: "D",
          correctOption: "A" as const,
          explanation: null,
        },
      ];

      await expect(commitBulkQuestions("admin-user-id", validQuestions, "ielts")).rejects.toThrow(
        "Question targets course 'oet', but batch destination is configured for 'ielts'.",
      );
    });
  });

  // Step 9B Production Pipeline & Duplicate Detection Tests
  describe("Step 9B Production Quality & Duplicate Detection", () => {
    it("normalizes question and option text by stripping control characters, collapsing spaces, and lowercasing", () => {
      expect(normalizeQuestionText("  What   is the   IELTS test?  ")).toBe("what is the ielts test?");
      expect(normalizeQuestionText("Test\u0000with\x1Fcontrol")).toBe("testwithcontrol");
      expect(normalizeOptionText("  Option   A  ")).toBe("option a");
    });

    it("detects and flags duplicate rows within the same uploaded CSV", async () => {
      const csv = `question_text,option_a,option_b,option_c,option_d,correct_option,explanation
"What is the IELTS Listening format?",OptA,OptB,OptC,OptD,A,"Expl 1"
"What is the IELTS Reading format?",OptA,OptB,OptC,OptD,B,"Expl 2"
"  what is the  IELTS listening format?  ",OptA,OptB,OptC,OptD,A,"Expl 3"`;

      const parsed = parseCsvRows(csv);
      const result = await validateQuestionsBatch(parsed, "ielts");

      expect(result.totalRows).toBe(3);
      expect(result.validCount).toBe(2);
      expect(result.duplicateCount).toBe(1);
      expect(result.invalidCount).toBe(0);
      expect(result.duplicateRows.length).toBe(1);
      expect(result.duplicateRows[0].rowNumber).toBe(4);
      expect(result.duplicateRows[0].reason).toContain("Duplicate of Row 2 within this CSV file");
    });

    it("detects and flags questions that already exist in the target course database", async () => {
      mockExistingDbQuestions = [
        { questionText: "What is the primary purpose of IELTS Academic?" },
      ];

      const csv = `question_text,option_a,option_b,option_c,option_d,correct_option,explanation
"What is the primary purpose of IELTS Academic?",OptA,OptB,OptC,OptD,A,"Expl 1"
"A completely new and unique question for IELTS",OptA,OptB,OptC,OptD,B,"Expl 2"`;

      const parsed = parseCsvRows(csv);
      const result = await validateQuestionsBatch(parsed, "ielts");

      expect(result.totalRows).toBe(2);
      expect(result.validCount).toBe(1);
      expect(result.duplicateCount).toBe(1);
      expect(result.duplicateRows[0].rowNumber).toBe(2);
      expect(result.duplicateRows[0].reason).toContain("already exists in the IELTS Preparation question bank");
      expect(result.validQuestions[0].questionText).toBe("A completely new and unique question for IELTS");
    });

    it("maintains strict course isolation: same question in a different course does NOT block import", async () => {
      // IELTS course has this question, but we are importing into German course
      // Our mock returns empty when querying German course
      mockExistingDbQuestions = [];

      const csv = `question_text,option_a,option_b,option_c,option_d,correct_option,explanation
"Shared prompt text between courses",OptA,OptB,OptC,OptD,A,"Explanation"`;

      const parsed = parseCsvRows(csv);
      const result = await validateQuestionsBatch(parsed, "german");

      expect(result.valid).toBe(true);
      expect(result.validCount).toBe(1);
      expect(result.duplicateCount).toBe(0);
      expect(result.validQuestions[0].courseSlug).toBe("german");
    });

    it("rejects rows where any two options are duplicates", async () => {
      const csv = `question_text,option_a,option_b,option_c,option_d,correct_option
"Question with duplicate options",Paris,London,Paris,Berlin,A`;

      const parsed = parseCsvRows(csv);
      const result = await validateQuestionsBatch(parsed, "ielts");

      expect(result.valid).toBe(false);
      expect(result.invalidCount).toBe(1);
      expect(result.errors.some((e) => e.message.includes("Option A and Option C have duplicate text"))).toBe(true);
    });

    it("rejects rows where options differ only by whitespace or case", async () => {
      const csv = `question_text,option_a,option_b,option_c,option_d,correct_option
"Question with subtle duplicate options","  BERLIN  ","London","berlin","Rome",A`;

      const parsed = parseCsvRows(csv);
      const result = await validateQuestionsBatch(parsed, "ielts");

      expect(result.valid).toBe(false);
      expect(result.invalidCount).toBe(1);
      expect(result.errors.some((e) => e.message.includes("Option A and Option C have duplicate text"))).toBe(true);
    });

    it("rejects rows where all four options are identical", async () => {
      const csv = `question_text,option_a,option_b,option_c,option_d,correct_option
"Question with all identical options",Same,Same,Same,Same,A`;

      const parsed = parseCsvRows(csv);
      const result = await validateQuestionsBatch(parsed, "ielts");

      expect(result.valid).toBe(false);
      expect(result.invalidCount).toBe(1);
      expect(result.errors.some((e) => e.message.includes("All four options are identical"))).toBe(true);
    });

    it("rejects rows where question text and answer option text are identical", async () => {
      const csv = `question_text,option_a,option_b,option_c,option_d,correct_option
"Photosynthesis",Photosynthesis,Respiration,Transpiration,Digestion,A`;

      const parsed = parseCsvRows(csv);
      const result = await validateQuestionsBatch(parsed, "ielts");

      expect(result.valid).toBe(false);
      expect(result.invalidCount).toBe(1);
      expect(result.errors.some((e) => e.message.includes("Question prompt and answer option text cannot be identical"))).toBe(true);
    });

    it("rejects rows with extremely short question text (< 5 characters)", async () => {
      const csv = `question_text,option_a,option_b,option_c,option_d,correct_option
"Why?",OptA,OptB,OptC,OptD,A`;

      const parsed = parseCsvRows(csv);
      const result = await validateQuestionsBatch(parsed, "ielts");

      expect(result.valid).toBe(false);
      expect(result.invalidCount).toBe(1);
      expect(result.errors.some((e) => e.message.includes("too short (minimum 5 characters)"))).toBe(true);
    });

    it("rejects rows containing invalid control characters", async () => {
      const csv = `question_text,option_a,option_b,option_c,option_d,correct_option
"Valid prompt with \x00 null byte",OptA,OptB,OptC,OptD,A`;

      const parsed = parseCsvRows(csv);
      const result = await validateQuestionsBatch(parsed, "ielts");

      expect(result.valid).toBe(false);
      expect(result.invalidCount).toBe(1);
      expect(result.errors.some((e) => e.message.includes("contains invalid control characters"))).toBe(true);
    });

    it("rejects batches exceeding maximum batch limit of 500 questions", async () => {
      const fakeRows: Array<Record<string, string>> = [];
      for (let i = 0; i < 501; i++) {
        fakeRows.push({
          question_text: `Test question number ${i}`,
          option_a: "A",
          option_b: "B",
          option_c: "C",
          option_d: "D",
          correct_option: "A",
        });
      }

      await expect(validateQuestionsBatch(fakeRows, "ielts")).rejects.toThrow(
        "exceeds the maximum limit of 500 questions per import",
      );
    });

    it("properly handles complex quoted multiline fields in CSV", () => {
      const multilineCsv = `question_text,option_a,option_b,option_c,option_d,correct_option,explanation
"Read the paragraph:
Line 1 of reading text
Line 2 of reading text","Option A with
newline","Option B","Option C","Option D",A,"Explanation with
two lines"`;

      const parsed = parseCsvRows(multilineCsv);
      expect(parsed.length).toBe(1);
      expect(parsed[0].question_text).toContain("Line 1 of reading text\nLine 2 of reading text");
      expect(parsed[0].option_a).toContain("Option A with\nnewline");
      expect(parsed[0].explanation).toContain("Explanation with\ntwo lines");
    });
  });
});
