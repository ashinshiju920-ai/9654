import "server-only";

import { withDb } from "@/lib/db";
import { courses, questions } from "@/lib/db/schema";
import { logAdminAudit } from "./audit";

export type RawQuestionInput = {
  course_slug?: string;
  course?: string;
  question_text?: string;
  question?: string;
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  correct_option?: string;
  explanation?: string;
};

export type ValidatedQuestion = {
  courseSlug: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: "A" | "B" | "C" | "D";
  explanation: string | null;
};

export type RowValidationError = {
  rowNumber: number;
  data: Record<string, string>;
  errors: string[];
};

export type BulkValidationResult = {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  validQuestions: ValidatedQuestion[];
  invalidRows: RowValidationError[];
};

const VALID_OPTIONS = new Set(["A", "B", "C", "D"]);

export function parseCsvRows(csvText: string): Array<Record<string, string>> {
  const lines = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) {
    return [];
  }

  // Parse header
  const headerLine = lines[0];
  const headers = parseCsvLine(headerLine).map((h) => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"));

  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCsvLine(line);
    const rowObj: Record<string, string> = {};

    headers.forEach((header, index) => {
      rowObj[header] = values[index] !== undefined ? sanitizeFormula(values[index].trim()) : "";
    });

    rows.push(rowObj);
  }

  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function sanitizeFormula(value: string): string {
  if (/^[=\-+@\t\r]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

export async function validateQuestionsBatch(
  rawRows: Array<Record<string, string>>,
): Promise<BulkValidationResult> {
  const validQuestions: ValidatedQuestion[] = [];
  const invalidRows: RowValidationError[] = [];

  // Fetch all active courses from DB to validate course slugs
  const dbCourses = await withDb((db) =>
    db.select({ id: courses.id, slug: courses.slug }).from(courses),
  );
  const knownCourseSlugs = new Set(dbCourses.map((c) => c.slug.toLowerCase()));

  for (let idx = 0; idx < rawRows.length; idx++) {
    const row = rawRows[idx];
    const rowNumber = idx + 2; // 1-indexed, accounting for header row
    const errors: string[] = [];

    // Course slug resolution
    const courseRaw = (row.course_slug || row.course || "").trim().toLowerCase();
    if (!courseRaw) {
      errors.push("Course slug is required (e.g. ielts, oet, pte, german).");
    } else if (!knownCourseSlugs.has(courseRaw)) {
      errors.push(`Course '${courseRaw}' is not found in database.`);
    }

    // Question text
    const questionText = (row.question_text || row.question || "").trim();
    if (!questionText) {
      errors.push("Question text is required.");
    } else if (questionText.length > 2000) {
      errors.push("Question text exceeds maximum length of 2000 characters.");
    }

    // Options
    const optA = (row.option_a || "").trim();
    const optB = (row.option_b || "").trim();
    const optC = (row.option_c || "").trim();
    const optD = (row.option_d || "").trim();

    if (!optA) errors.push("Option A is required.");
    if (!optB) errors.push("Option B is required.");
    if (!optC) errors.push("Option C is required.");
    if (!optD) errors.push("Option D is required.");

    if (optA.length > 500) errors.push("Option A exceeds 500 characters.");
    if (optB.length > 500) errors.push("Option B exceeds 500 characters.");
    if (optC.length > 500) errors.push("Option C exceeds 500 characters.");
    if (optD.length > 500) errors.push("Option D exceeds 500 characters.");

    // Correct Option
    const correctOpt = (row.correct_option || "").trim().toUpperCase();
    if (!correctOpt) {
      errors.push("Correct option is required (must be A, B, C, or D).");
    } else if (!VALID_OPTIONS.has(correctOpt)) {
      errors.push(`Invalid correct option '${correctOpt}'. Must be A, B, C, or D.`);
    }

    // Explanation
    const explanation = (row.explanation || "").trim() || null;
    if (explanation && explanation.length > 2000) {
      errors.push("Explanation exceeds 2000 characters.");
    }

    if (errors.length > 0) {
      invalidRows.push({
        rowNumber,
        data: row,
        errors,
      });
    } else {
      validQuestions.push({
        courseSlug: courseRaw,
        questionText,
        optionA: optA,
        optionB: optB,
        optionC: optC,
        optionD: optD,
        correctOption: correctOpt as "A" | "B" | "C" | "D",
        explanation,
      });
    }
  }

  return {
    totalRows: rawRows.length,
    validCount: validQuestions.length,
    invalidCount: invalidRows.length,
    validQuestions,
    invalidRows,
  };
}

export async function commitBulkQuestions(
  adminUserId: string,
  validQuestions: ValidatedQuestion[],
): Promise<{ success: boolean; importedCount: number }> {
  if (validQuestions.length === 0) {
    return { success: true, importedCount: 0 };
  }

  return withDb(async (db) => {
    // Map courseSlug -> courseId
    const dbCourses = await db.select({ id: courses.id, slug: courses.slug }).from(courses);
    const courseMap = new Map<string, string>();
    for (const c of dbCourses) {
      courseMap.set(c.slug.toLowerCase(), c.id);
    }

    // Batch insert in chunks of 50
    const CHUNK_SIZE = 50;
    let imported = 0;

    for (let i = 0; i < validQuestions.length; i += CHUNK_SIZE) {
      const chunk = validQuestions.slice(i, i + CHUNK_SIZE);
      const valuesToInsert = chunk.map((q) => {
        const courseId = courseMap.get(q.courseSlug.toLowerCase());
        if (!courseId) {
          throw new Error(`Course ID missing for slug ${q.courseSlug}`);
        }
        return {
          courseId,
          questionText: q.questionText,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          correctOption: q.correctOption,
          explanation: q.explanation,
          isActive: true,
        };
      });

      await db.insert(questions).values(valuesToInsert);
      imported += valuesToInsert.length;
    }

    await logAdminAudit({
      adminUserId,
      action: "question.bulk_import",
      targetType: "question",
      details: `Imported ${imported} questions across courses`,
    });

    return { success: true, importedCount: imported };
  });
}

export const CSV_IMPORT_TEMPLATE = `course_slug,question_text,option_a,option_b,option_c,option_d,correct_option,explanation
ielts,"Which sentence demonstrates correct subject-verb agreement?","The group of students were late.","The group of students was late.","The students group were late.","Group students was late.",B,"The subject 'group' is singular and takes the singular verb 'was'."
oet,"What is the recommended clinical handover protocol?","ISBAR protocol","Casual debrief","Text message","End-of-shift memo",A,"ISBAR (Identify, Situation, Background, Assessment, Recommendation) is the standard structured communication protocol."
pte,"Which word correctly completes: 'The findings were statistically _____.'","significant","significance","signify","significantly",A,"The adjective 'significant' correctly complements the linking verb."
german,"Welcher Artikel gehoert zu 'Buch'?","Der","Die","Das","Dem",C,"Das Buch ist ein neutrales Nomen im Deutschen."`;

export { sanitizeFormula as sanitizeCsvCell };

export function generateCsvTemplate(): string {
  return CSV_IMPORT_TEMPLATE;
}
