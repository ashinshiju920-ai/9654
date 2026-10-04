import "server-only";

import { eq } from "drizzle-orm";
import { withDb } from "@/lib/db";
import { courses, questions } from "@/lib/db/schema";
import { logAdminAudit } from "./audit";

export const MAX_IMPORT_BATCH_SIZE = 500;
export const RECOMMENDED_IMPORT_BATCH_SIZE = 250;

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

export type ValidationError = {
  row: number;
  field: string;
  message: string;
};

export type RowValidationError = {
  rowNumber: number;
  data: Record<string, string>;
  errors: string[];
};

export type DuplicateRow = {
  rowNumber: number;
  questionText: string;
  reason: string;
};

export type BulkValidationResult = {
  totalRows: number;
  validCount: number;
  duplicateCount: number;
  invalidCount: number;
  errorCount: number;
  valid: boolean;
  importableCount: number;
  errors: ValidationError[];
  validQuestions: ValidatedQuestion[];
  invalidRows: RowValidationError[];
  duplicateRows: DuplicateRow[];
};

const VALID_OPTIONS = new Set(["A", "B", "C", "D"]);

export function normalizeQuestionText(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    .toLowerCase()
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeOptionText(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    .toLowerCase()
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Robust RFC 4180 CSV parser supporting:
 * - UTF-8 BOM stripping
 * - Quoted fields with commas
 * - Escaped double quotes ("")
 * - Embedded newlines within quoted fields
 * - CRLF, LF, and CR line endings
 * - Formula sanitization
 * - Header aliasing and normalization
 */
export function parseCsvRows(csvText: string): Array<Record<string, string>> {
  if (!csvText || typeof csvText !== "string") {
    return [];
  }

  // 1. Strip UTF-8 BOM if present
  let text = csvText;
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  // 2. Tokenize CSV into rows and cells
  const rawRows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") {
        i++; // skip LF of CRLF
      }
      currentRow.push(currentCell);
      currentCell = "";
      if (currentRow.some((c) => c.trim().length > 0)) {
        rawRows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    if (currentRow.some((c) => c.trim().length > 0)) {
      rawRows.push(currentRow);
    }
  }

  if (rawRows.length < 2) {
    return [];
  }

  // 3. Normalize headers
  const headerRow = rawRows[0];
  const headers = headerRow.map((h) => {
    const norm = h.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    if (norm === "course" || norm === "course_id") return "course_slug";
    if (norm === "question" || norm === "prompt") return "question_text";
    if (norm === "correct" || norm === "correct_answer" || norm === "answer") return "correct_option";
    if (norm === "explain") return "explanation";
    return norm;
  });

  // 4. Build row objects
  const rows: Array<Record<string, string>> = [];
  for (let r = 1; r < rawRows.length; r++) {
    const cells = rawRows[r];
    const rowObj: Record<string, string> = {};
    headers.forEach((hdr, idx) => {
      const val = cells[idx] !== undefined ? cells[idx].trim() : "";
      rowObj[hdr] = sanitizeFormula(val);
    });
    rows.push(rowObj);
  }

  return rows;
}

export function sanitizeFormula(value: string): string {
  if (/^[=\-+@\t\r]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

export async function validateQuestionsBatch(
  rawRows: Array<Record<string, string>>,
  targetCourseSlug?: string,
): Promise<BulkValidationResult> {
  if (rawRows.length > MAX_IMPORT_BATCH_SIZE) {
    throw new Error(
      `Batch size (${rawRows.length}) exceeds the maximum limit of ${MAX_IMPORT_BATCH_SIZE} questions per import. Recommended batch size: ${RECOMMENDED_IMPORT_BATCH_SIZE} questions.`,
    );
  }

  const validQuestions: ValidatedQuestion[] = [];
  const invalidRows: RowValidationError[] = [];
  const duplicateRows: DuplicateRow[] = [];
  const flatErrors: ValidationError[] = [];

  // Fetch active courses from DB to build course lookup
  const dbCourses = await withDb((db) =>
    db.select({ id: courses.id, slug: courses.slug, name: courses.name }).from(courses),
  );

  const courseLookup = new Map<string, string>();
  const courseNameMap = new Map<string, string>();
  const courseIdMap = new Map<string, string>();
  for (const c of dbCourses) {
    if (c.slug) {
      const lowerSlug = c.slug.toLowerCase();
      courseLookup.set(lowerSlug, lowerSlug);
      courseNameMap.set(lowerSlug, c.name);
      courseIdMap.set(lowerSlug, c.id);
    }
    if (c.name) {
      const lowerSlug = c.slug.toLowerCase();
      courseLookup.set(c.name.toLowerCase(), lowerSlug);
    }
  }

  const normalizedTargetSlug = targetCourseSlug?.trim().toLowerCase();
  if (normalizedTargetSlug && !courseLookup.has(normalizedTargetSlug)) {
    throw new Error(`Target course '${targetCourseSlug}' does not exist in the database.`);
  }

  // Pre-fetch existing course questions in 1 query for course-scoped duplicate detection
  const targetCourseId = normalizedTargetSlug ? courseIdMap.get(normalizedTargetSlug) : undefined;
  const existingCourseQuestionSet = new Set<string>();

  if (targetCourseId) {
    const existingDbQuestions = await withDb((db) =>
      db
        .select({ questionText: questions.questionText })
        .from(questions)
        .where(eq(questions.courseId, targetCourseId)),
    );
    for (const q of existingDbQuestions) {
      const norm = normalizeQuestionText(q.questionText);
      if (norm) existingCourseQuestionSet.add(norm);
    }
  }

  // Track in-batch seen questions: normalizedQuestionText -> firstRowNumber
  const seenInBatch = new Map<string, number>();

  for (let idx = 0; idx < rawRows.length; idx++) {
    const row = rawRows[idx];
    const rowNumber = idx + 2; // 1-indexed, accounting for header row
    const errors: string[] = [];

    // Course slug resolution & course-specific enforcement
    const courseRaw = (row.course_slug || row.course || "").trim().toLowerCase();
    let resolvedSlug: string | undefined;

    if (normalizedTargetSlug) {
      if (courseRaw) {
        const resolvedRowSlug = courseLookup.get(courseRaw);
        if (resolvedRowSlug !== normalizedTargetSlug) {
          const targetName = courseNameMap.get(normalizedTargetSlug) || normalizedTargetSlug.toUpperCase();
          const rowName = resolvedRowSlug ? (courseNameMap.get(resolvedRowSlug) || resolvedRowSlug.toUpperCase()) : courseRaw.toUpperCase();
          const msg = `Row ${rowNumber} targets ${rowName}, but this import is configured for ${targetName}.`;
          errors.push(msg);
          flatErrors.push({ row: rowNumber, field: "course_slug", message: msg });
        } else {
          resolvedSlug = normalizedTargetSlug;
        }
      } else {
        // Course column omitted in course-specific import mode -> use target course
        resolvedSlug = normalizedTargetSlug;
      }
    } else {
      // Legacy multi-course mode: requires course_slug in each row
      if (!courseRaw) {
        const msg = "Course slug is required (e.g. ielts, oet, pte, german).";
        errors.push(msg);
        flatErrors.push({ row: rowNumber, field: "course_slug", message: msg });
      } else {
        resolvedSlug = courseLookup.get(courseRaw);
        if (!resolvedSlug) {
          const msg = `Course '${courseRaw}' is not found in database.`;
          errors.push(msg);
          flatErrors.push({ row: rowNumber, field: "course_slug", message: msg });
        }
      }
    }

    // Question text validation
    const questionText = (row.question_text || row.question || "").trim();
    if (!questionText) {
      const msg = "Question text is required.";
      errors.push(msg);
      flatErrors.push({ row: rowNumber, field: "question_text", message: msg });
    } else if (questionText.length < 5) {
      const msg = "Question text is too short (minimum 5 characters).";
      errors.push(msg);
      flatErrors.push({ row: rowNumber, field: "question_text", message: msg });
    } else if (questionText.length > 2000) {
      const msg = "Question text exceeds maximum length of 2000 characters.";
      errors.push(msg);
      flatErrors.push({ row: rowNumber, field: "question_text", message: msg });
    } else if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(questionText)) {
      const msg = "Question text contains invalid control characters.";
      errors.push(msg);
      flatErrors.push({ row: rowNumber, field: "question_text", message: msg });
    }

    // Options validation
    const optA = (row.option_a || "").trim();
    const optB = (row.option_b || "").trim();
    const optC = (row.option_c || "").trim();
    const optD = (row.option_d || "").trim();

    if (!optA) {
      const msg = "Option A is required.";
      errors.push(msg);
      flatErrors.push({ row: rowNumber, field: "option_a", message: msg });
    } else if (optA.length > 500) {
      const msg = "Option A exceeds 500 characters.";
      errors.push(msg);
      flatErrors.push({ row: rowNumber, field: "option_a", message: msg });
    } else if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(optA)) {
      const msg = "Option A contains invalid control characters.";
      errors.push(msg);
      flatErrors.push({ row: rowNumber, field: "option_a", message: msg });
    }

    if (!optB) {
      const msg = "Option B is required.";
      errors.push(msg);
      flatErrors.push({ row: rowNumber, field: "option_b", message: msg });
    } else if (optB.length > 500) {
      const msg = "Option B exceeds 500 characters.";
      errors.push(msg);
      flatErrors.push({ row: rowNumber, field: "option_b", message: msg });
    } else if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(optB)) {
      const msg = "Option B contains invalid control characters.";
      errors.push(msg);
      flatErrors.push({ row: rowNumber, field: "option_b", message: msg });
    }

    if (!optC) {
      const msg = "Option C is required.";
      errors.push(msg);
      flatErrors.push({ row: rowNumber, field: "option_c", message: msg });
    } else if (optC.length > 500) {
      const msg = "Option C exceeds 500 characters.";
      errors.push(msg);
      flatErrors.push({ row: rowNumber, field: "option_c", message: msg });
    } else if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(optC)) {
      const msg = "Option C contains invalid control characters.";
      errors.push(msg);
      flatErrors.push({ row: rowNumber, field: "option_c", message: msg });
    }

    if (!optD) {
      const msg = "Option D is required.";
      errors.push(msg);
      flatErrors.push({ row: rowNumber, field: "option_d", message: msg });
    } else if (optD.length > 500) {
      const msg = "Option D exceeds 500 characters.";
      errors.push(msg);
      flatErrors.push({ row: rowNumber, field: "option_d", message: msg });
    } else if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(optD)) {
      const msg = "Option D contains invalid control characters.";
      errors.push(msg);
      flatErrors.push({ row: rowNumber, field: "option_d", message: msg });
    }

    // Option duplicate detection (differing only by whitespace/case)
    const normA = normalizeOptionText(optA);
    const normB = normalizeOptionText(optB);
    const normC = normalizeOptionText(optC);
    const normD = normalizeOptionText(optD);

    if (optA && optB && optC && optD) {
      if (normA === normB && normB === normC && normC === normD) {
        const msg = "All four options are identical.";
        errors.push(msg);
        flatErrors.push({ row: rowNumber, field: "options", message: msg });
      } else {
        const pairs: Array<[string, string, string, string]> = [
          ["Option A", "Option B", normA, normB],
          ["Option A", "Option C", normA, normC],
          ["Option A", "Option D", normA, normD],
          ["Option B", "Option C", normB, normC],
          ["Option B", "Option D", normB, normD],
          ["Option C", "Option D", normC, normD],
        ];
        for (const [name1, name2, val1, val2] of pairs) {
          if (val1 === val2) {
            const msg = `${name1} and ${name2} have duplicate text.`;
            errors.push(msg);
            flatErrors.push({ row: rowNumber, field: "options", message: msg });
          }
        }
      }
    }

    // Correct Option validation
    const correctOpt = (row.correct_option || "").trim().toUpperCase();
    if (!correctOpt) {
      const msg = "Correct option is required (must be A, B, C, or D).";
      errors.push(msg);
      flatErrors.push({ row: rowNumber, field: "correct_option", message: msg });
    } else if (!VALID_OPTIONS.has(correctOpt)) {
      const msg = `Invalid correct option '${correctOpt}'. Must be A, B, C, or D.`;
      errors.push(msg);
      flatErrors.push({ row: rowNumber, field: "correct_option", message: msg });
    }

    // Suspicious content: Question prompt identical to an answer option
    const normQ = normalizeQuestionText(questionText);
    if (normQ && (normQ === normA || normQ === normB || normQ === normC || normQ === normD)) {
      const msg = "Question prompt and answer option text cannot be identical.";
      errors.push(msg);
      flatErrors.push({ row: rowNumber, field: "question_text", message: msg });
    }

    // Explanation validation
    const explanation = (row.explanation || "").trim() || null;
    if (explanation && explanation.length > 2000) {
      const msg = "Explanation exceeds 2000 characters.";
      errors.push(msg);
      flatErrors.push({ row: rowNumber, field: "explanation", message: msg });
    }

    // Check for structural validation errors first
    if (errors.length > 0) {
      invalidRows.push({
        rowNumber,
        data: row,
        errors,
      });
      continue;
    }

    // Duplicate detection (In-batch and in-database course-scoped)
    if (resolvedSlug) {
      let isDuplicate = false;
      let dupReason = "";

      if (seenInBatch.has(normQ)) {
        const firstRow = seenInBatch.get(normQ);
        isDuplicate = true;
        dupReason = `Duplicate of Row ${firstRow} within this CSV file.`;
      } else if (existingCourseQuestionSet.has(normQ)) {
        const targetName = courseNameMap.get(resolvedSlug) || resolvedSlug.toUpperCase();
        isDuplicate = true;
        dupReason = `This question already exists in the ${targetName} question bank.`;
      }

      if (isDuplicate) {
        duplicateRows.push({
          rowNumber,
          questionText,
          reason: dupReason,
        });
      } else {
        seenInBatch.set(normQ, rowNumber);
        validQuestions.push({
          courseSlug: resolvedSlug,
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
  }

  return {
    totalRows: rawRows.length,
    validCount: validQuestions.length,
    duplicateCount: duplicateRows.length,
    invalidCount: invalidRows.length,
    errorCount: flatErrors.length,
    valid: invalidRows.length === 0 && duplicateRows.length === 0 && validQuestions.length > 0,
    importableCount: validQuestions.length,
    errors: flatErrors,
    validQuestions,
    invalidRows,
    duplicateRows,
  };
}

/**
 * Transactionally commits validated questions into the database.
 * Re-validates data server-side and automatically rolls back if any chunk fails.
 */
export async function commitBulkQuestions(
  adminUserId: string,
  validQuestions: ValidatedQuestion[],
  targetCourseSlug?: string,
): Promise<{ success: boolean; importedCount: number }> {
  if (validQuestions.length === 0) {
    return { success: true, importedCount: 0 };
  }

  const normalizedTarget = targetCourseSlug?.trim().toLowerCase();

  return withDb(async (db) =>
    db.transaction(async (tx) => {
      // Map courseSlug -> courseId
      const dbCourses = await tx
        .select({ id: courses.id, slug: courses.slug, name: courses.name })
        .from(courses);

      const courseMap = new Map<string, string>();
      const courseNameMap = new Map<string, string>();
      for (const c of dbCourses) {
        const lowerSlug = c.slug.toLowerCase();
        courseMap.set(lowerSlug, c.id);
        courseNameMap.set(lowerSlug, c.name);
      }

      if (normalizedTarget && !courseMap.has(normalizedTarget)) {
        throw new Error(`Target course '${targetCourseSlug}' not found in database.`);
      }

      // Re-validate all questions before inserting
      for (const q of validQuestions) {
        const qSlug = q.courseSlug.toLowerCase();
        if (normalizedTarget && qSlug !== normalizedTarget) {
          throw new Error(
            `Question targets course '${q.courseSlug}', but batch destination is configured for '${normalizedTarget}'.`,
          );
        }
        if (!courseMap.has(qSlug)) {
          throw new Error(`Course '${q.courseSlug}' not found in database.`);
        }
        if (!q.questionText || !q.optionA || !q.optionB || !q.optionC || !q.optionD) {
          throw new Error("Missing required question text or options.");
        }
        if (!VALID_OPTIONS.has(q.correctOption)) {
          throw new Error(`Invalid correct option '${q.correctOption}'. Must be A, B, C, or D.`);
        }
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

        await tx.insert(questions).values(valuesToInsert);
        imported += valuesToInsert.length;
      }

      const targetLabel = normalizedTarget
        ? (courseNameMap.get(normalizedTarget) || normalizedTarget.toUpperCase())
        : "across courses";

      await logAdminAudit({
        adminUserId,
        action: "question.bulk_import",
        targetType: "question",
        details: `Bulk imported ${imported} questions into ${targetLabel}`,
      });

      return { success: true, importedCount: imported };
    }),
  );
}

export const CSV_IMPORT_TEMPLATE = `course_slug,question_text,option_a,option_b,option_c,option_d,correct_option,explanation
ielts,"Which sentence demonstrates correct subject-verb agreement?","The group of students were late.","The group of students was late.","The students group were late.","Group students was late.",B,"The subject 'group' is singular and takes the singular verb 'was'."
oet,"What is the recommended clinical handover protocol?","ISBAR protocol","Casual debrief","Text message","End-of-shift memo",A,"ISBAR (Identify, Situation, Background, Assessment, Recommendation) is the standard structured communication protocol."
pte,"Which word correctly completes: 'The findings were statistically _____.'","significant","significance","signify","significantly",A,"The adjective 'significant' correctly complements the linking verb."
german,"Welcher Artikel gehoert zu 'Buch'?","Der","Die","Das","Dem",C,"Das Buch ist ein neutrales Nomen im Deutschen."`;

export const COURSE_SPECIFIC_TEMPLATES: Record<string, string> = {
  ielts: `question_text,option_a,option_b,option_c,option_d,correct_option,explanation
"Which sentence demonstrates correct subject-verb agreement?","The group of students were late.","The group of students was late.","The students group were late.","Group students was late.",B,"The subject 'group' is singular and takes the singular verb 'was'."
"Identify the cohesive device used to show contrast:","Moreover","Consequently","Nevertheless","Furthermore",C,"'Nevertheless' is an adverbial linker used to indicate contrast."
"Choose the correct collocation: 'He made a _____ decision.'","weighty","heavy","deep","dense",A,"'Weighty decision' is a recognized formal collocation."`,
  oet: `question_text,option_a,option_b,option_c,option_d,correct_option,explanation
"What is the recommended clinical handover protocol?","ISBAR protocol","Casual debrief","Text message","End-of-shift memo",A,"ISBAR (Identify, Situation, Background, Assessment, Recommendation) is the standard structured communication protocol."
"In triage, what is the primary purpose of early vital sign assessment?","Administrative documentation","Detecting clinical deterioration","Discharge planning","Bed allocation",B,"Vital signs allow rapid detection of physiological deterioration."
"Which term best describes involuntary muscle contraction?","Spasm","Flaccidity","Atrophy","Paresis",A,"A spasm is an involuntary and abnormal contraction of a muscle."`,
  pte: `question_text,option_a,option_b,option_c,option_d,correct_option,explanation
"Which word correctly completes: 'The findings were statistically _____.'","significant","significance","signify","significantly",A,"The adjective 'significant' correctly complements the linking verb."
"Select the correct synonym for 'ubiquitous':","Omnipresent","Scarce","Temporary","Confined",A,"'Ubiquitous' means present, appearing, or found everywhere."
"Choose the word that best fits academic register: 'The author _____ that the hypothesis is flawed.'","argues","tells","says out","speaks",A,"'Argues' is the accepted standard academic reporting verb."`,
  german: `question_text,option_a,option_b,option_c,option_d,correct_option,explanation
"Welcher Artikel gehoert zu 'Buch'?","Der","Die","Das","Dem",C,"Das Buch ist ein neutrales Nomen im Deutschen."
"Ergaenzen Sie: 'Ich interessiere mich _____ moderne Kunst.'","fuer","ueber","an","auf",A,"Das Reflexivverb 'sich interessieren' verlangt die Praeposition 'fuer' mit Akkusativ."
"Welche Konjunktion verlangt die Nebensatz-Wortstellung?","weil","denn","aber","oder",A,"'Weil' leitet einen Kausalsatz ein und stellt das Verb ans Satzende."`,
};

export { sanitizeFormula as sanitizeCsvCell };

export function generateCsvTemplate(courseSlug?: string): string {
  if (courseSlug) {
    const lower = courseSlug.trim().toLowerCase();
    if (COURSE_SPECIFIC_TEMPLATES[lower]) {
      return COURSE_SPECIFIC_TEMPLATES[lower];
    }
  }
  return CSV_IMPORT_TEMPLATE;
}
