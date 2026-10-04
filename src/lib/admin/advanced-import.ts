import "server-only";

import { eq } from "drizzle-orm";
import { withDb } from "@/lib/db";
import { advancedCollections, advancedQuestions } from "@/lib/db/schema";
import { logAdminAudit } from "./audit";

export const MAX_ADVANCED_IMPORT_BATCH = 500;
export const RECOMMENDED_ADVANCED_IMPORT_BATCH = 250;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_OPTIONS = new Set(["A", "B", "C", "D"]);

export type AdvancedRawQuestionInput = {
  question_text?: string;
  question?: string;
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  correct_option?: string;
  explanation?: string;
};

export type ValidatedAdvancedQuestion = {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: "A" | "B" | "C" | "D";
  explanation: string | null;
};

export type AdvancedValidationError = {
  row: number;
  field: string;
  message: string;
};

export type AdvancedRowValidationError = {
  rowNumber: number;
  data: Record<string, string>;
  errors: string[];
};

export type AdvancedDuplicateRow = {
  rowNumber: number;
  questionText: string;
  reason: string;
};

export type AdvancedBulkValidationResult = {
  totalRows: number;
  validCount: number;
  duplicateCount: number;
  invalidCount: number;
  errorCount: number;
  valid: boolean;
  importableCount: number;
  errors: AdvancedValidationError[];
  validQuestions: ValidatedAdvancedQuestion[];
  invalidRows: AdvancedRowValidationError[];
  duplicateRows: AdvancedDuplicateRow[];
};

export function normalizeAdvancedText(text: string): string {
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
 * - Quoted fields with embedded commas and quotes ("")
 * - Embedded newlines within quoted fields
 * - CRLF, LF, and CR line endings
 * - Formula injection sanitization
 */
export function parseAdvancedCsvRows(csvText: string): Array<Record<string, string>> {
  if (!csvText || typeof csvText !== "string") {
    return [];
  }

  // Strip BOM
  let text = csvText.charCodeAt(0) === 0xfeff ? csvText.slice(1) : csvText;
  text = text.replace(/^\uEFBBBF/, "");

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let insideQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const char = text[i];

    if (insideQuotes) {
      if (char === '"') {
        if (i + 1 < len && text[i + 1] === '"') {
          // Escaped quote
          currentField += '"';
          i += 2;
          continue;
        } else {
          // Closing quote
          insideQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
        i++;
        continue;
      } else if (char === ",") {
        currentRow.push(currentField);
        currentField = "";
        i++;
        continue;
      } else if (char === "\r") {
        if (i + 1 < len && text[i + 1] === "\n") {
          i++; // skip LF
        }
        currentRow.push(currentField);
        currentField = "";
        if (currentRow.some((f) => f.trim().length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        i++;
        continue;
      } else if (char === "\n") {
        currentRow.push(currentField);
        currentField = "";
        if (currentRow.some((f) => f.trim().length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  // Handle final trailing field/row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((f) => f.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length < 2) {
    return [];
  }

  // Normalize headers
  const headerMap: Record<string, string> = {
    question_text: "question_text",
    question: "question_text",
    prompt: "question_text",
    option_a: "option_a",
    optiona: "option_a",
    a: "option_a",
    option_b: "option_b",
    optionb: "option_b",
    b: "option_b",
    option_c: "option_c",
    optionc: "option_c",
    c: "option_c",
    option_d: "option_d",
    optiond: "option_d",
    d: "option_d",
    correct_option: "correct_option",
    correctoption: "correct_option",
    correct_answer: "correct_option",
    answer: "correct_option",
    explanation: "explanation",
    explain: "explanation",
    rationale: "explanation",
  };

  const rawHeaders = rows[0];
  const canonicalHeaders = rawHeaders.map((h) => {
    const cleaned = h
      .toLowerCase()
      .replace(/[\x00-\x1F\x7F-\x9F]/g, "")
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
    return headerMap[cleaned] || cleaned;
  });

  const parsedRecords: Array<Record<string, string>> = [];

  for (let r = 1; r < rows.length; r++) {
    const rowValues = rows[r];
    const record: Record<string, string> = {};

    for (let c = 0; c < canonicalHeaders.length; c++) {
      const header = canonicalHeaders[c];
      let val = rowValues[c] !== undefined ? rowValues[c].trim() : "";

      // Formula injection sanitization: strip leading =, +, -, @
      if (val.length > 1 && /^[-+=@]/.test(val)) {
        val = `'${val}`;
      }

      record[header] = val;
    }

    parsedRecords.push(record);
  }

  return parsedRecords;
}

/**
 * Validates CSV rows specifically for an authoritative target Advanced collection.
 * 
 * Enforces:
 * - Selected collection is authoritative (no row-level diversion)
 * - Required fields: question_text, option_a, option_b, option_c, option_d, correct_option
 * - Valid option values (A, B, C, D)
 * - No duplicate options within a single question (e.g., Option A === Option B)
 * - Scoped duplicate detection:
 *     1. Within the CSV batch
 *     2. Within the selected Advanced collection in database
 * - Bounded row count check (<= 500)
 */
export async function validateAdvancedImportRows(
  targetCollectionId: string,
  rawRows: AdvancedRawQuestionInput[],
): Promise<AdvancedBulkValidationResult> {
  if (!UUID_REGEX.test(targetCollectionId)) {
    throw new Error("Invalid target collection ID.");
  }

  if (!rawRows || rawRows.length === 0) {
    return {
      totalRows: 0,
      validCount: 0,
      duplicateCount: 0,
      invalidCount: 0,
      errorCount: 0,
      valid: false,
      importableCount: 0,
      errors: [{ row: 0, field: "file", message: "CSV file contains no question rows." }],
      validQuestions: [],
      invalidRows: [],
      duplicateRows: [],
    };
  }

  if (rawRows.length > MAX_ADVANCED_IMPORT_BATCH) {
    return {
      totalRows: rawRows.length,
      validCount: 0,
      duplicateCount: 0,
      invalidCount: rawRows.length,
      errorCount: 1,
      valid: false,
      importableCount: 0,
      errors: [
        {
          row: 0,
          field: "file",
          message: `Upload exceeds maximum allowed batch limit of ${MAX_ADVANCED_IMPORT_BATCH} questions (received ${rawRows.length}). Please split into smaller batches of ${RECOMMENDED_ADVANCED_IMPORT_BATCH} questions.`,
        },
      ],
      validQuestions: [],
      invalidRows: [],
      duplicateRows: [],
    };
  }

  // 1. Fetch collection details and existing question fingerprints in this collection
  const { collectionTitle, existingQuestionSet } = await withDb(async (db) => {
    const colRows = await db
      .select({ id: advancedCollections.id, title: advancedCollections.title })
      .from(advancedCollections)
      .where(eq(advancedCollections.id, targetCollectionId))
      .limit(1);

    if (colRows.length === 0) {
      throw new Error("Target Advanced collection not found.");
    }

    const existingQs = await db
      .select({ questionText: advancedQuestions.questionText })
      .from(advancedQuestions)
      .where(eq(advancedQuestions.collectionId, targetCollectionId));

    const set = new Set<string>();
    for (const q of existingQs) {
      set.add(normalizeAdvancedText(q.questionText));
    }

    return { collectionTitle: colRows[0].title, existingQuestionSet: set };
  });

  const flatErrors: AdvancedValidationError[] = [];
  const invalidRows: AdvancedRowValidationError[] = [];
  const duplicateRows: AdvancedDuplicateRow[] = [];
  const validQuestions: ValidatedAdvancedQuestion[] = [];
  const seenInBatch = new Map<string, number>();

  for (let idx = 0; idx < rawRows.length; idx++) {
    const row = rawRows[idx];
    const rowNumber = idx + 2; // +1 for 0-index, +1 for header row
    const errors: string[] = [];

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
    }

    if (!optB) {
      const msg = "Option B is required.";
      errors.push(msg);
      flatErrors.push({ row: rowNumber, field: "option_b", message: msg });
    } else if (optB.length > 500) {
      const msg = "Option B exceeds 500 characters.";
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
    }

    if (!optD) {
      const msg = "Option D is required.";
      errors.push(msg);
      flatErrors.push({ row: rowNumber, field: "option_d", message: msg });
    } else if (optD.length > 500) {
      const msg = "Option D exceeds 500 characters.";
      errors.push(msg);
      flatErrors.push({ row: rowNumber, field: "option_d", message: msg });
    }

    // Duplicate option detection
    const normA = normalizeAdvancedText(optA);
    const normB = normalizeAdvancedText(optB);
    const normC = normalizeAdvancedText(optC);
    const normD = normalizeAdvancedText(optD);

    if (normA && normB && normA === normB) {
      const msg = "Option A and Option B cannot be identical.";
      errors.push(msg);
      flatErrors.push({ row: rowNumber, field: "option_b", message: msg });
    }
    if (normA && normC && normA === normC) {
      const msg = "Option A and Option C cannot be identical.";
      errors.push(msg);
      flatErrors.push({ row: rowNumber, field: "option_c", message: msg });
    }
    if (normA && normD && normA === normD) {
      const msg = "Option A and Option D cannot be identical.";
      errors.push(msg);
      flatErrors.push({ row: rowNumber, field: "option_d", message: msg });
    }
    if (normB && normC && normB === normC) {
      const msg = "Option B and Option C cannot be identical.";
      errors.push(msg);
      flatErrors.push({ row: rowNumber, field: "option_c", message: msg });
    }
    if (normB && normD && normB === normD) {
      const msg = "Option B and Option D cannot be identical.";
      errors.push(msg);
      flatErrors.push({ row: rowNumber, field: "option_d", message: msg });
    }
    if (normC && normD && normC === normD) {
      const msg = "Option C and Option D cannot be identical.";
      errors.push(msg);
      flatErrors.push({ row: rowNumber, field: "option_d", message: msg });
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

    // Question prompt identical to an option check
    const normQ = normalizeAdvancedText(questionText);
    if (normQ && (normQ === normA || normQ === normB || normQ === normC || normQ === normD)) {
      const msg = "Question prompt and an answer option text cannot be identical.";
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
        data: row as Record<string, string>,
        errors,
      });
      continue;
    }

    // Scoped Duplicate detection:
    // A. Duplicate within CSV
    // B. Duplicate already within target collection
    let isDuplicate = false;
    let dupReason = "";

    if (seenInBatch.has(normQ)) {
      const firstRow = seenInBatch.get(normQ);
      isDuplicate = true;
      dupReason = `Duplicate of Row ${firstRow} within this CSV file.`;
    } else if (existingQuestionSet.has(normQ)) {
      isDuplicate = true;
      dupReason = `This question already exists in '${collectionTitle}'.`;
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
 * Transactionally commits validated questions into the target Advanced collection.
 */
export async function commitAdvancedBulkQuestions(
  adminUserId: string,
  targetCollectionId: string,
  validQuestions: ValidatedAdvancedQuestion[],
): Promise<{ success: boolean; importedCount: number }> {
  if (!UUID_REGEX.test(targetCollectionId)) {
    throw new Error("Invalid target collection ID.");
  }

  if (validQuestions.length === 0) {
    return { success: true, importedCount: 0 };
  }

  return withDb(async (db) =>
    db.transaction(async (tx) => {
      // 1. Verify collection exists
      const colRows = await tx
        .select({ id: advancedCollections.id, title: advancedCollections.title })
        .from(advancedCollections)
        .where(eq(advancedCollections.id, targetCollectionId))
        .limit(1);

      if (colRows.length === 0) {
        throw new Error("Target Advanced collection not found.");
      }

      const collection = colRows[0];

      // 2. Insert questions in safe chunks of 100
      const CHUNK_SIZE = 100;
      let totalInserted = 0;

      for (let i = 0; i < validQuestions.length; i += CHUNK_SIZE) {
        const chunk = validQuestions.slice(i, i + CHUNK_SIZE);

        const rowsToInsert = chunk.map((q) => ({
          collectionId: targetCollectionId,
          questionText: q.questionText,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          correctOption: q.correctOption,
          explanation: q.explanation,
          isActive: true,
        }));

        await tx.insert(advancedQuestions).values(rowsToInsert);
        totalInserted += rowsToInsert.length;
      }

      await logAdminAudit({
        adminUserId,
        action: "advanced_question.bulk_import",
        targetType: "advanced_collection",
        targetId: targetCollectionId,
        details: `Imported ${totalInserted} questions into Advanced Collection '${collection.title}'`,
      });

      return {
        success: true,
        importedCount: totalInserted,
      };
    }),
  );
}
