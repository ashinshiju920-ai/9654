import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth";
import {
  commitBulkQuestions,
  parseCsvRows,
  validateQuestionsBatch,
  MAX_IMPORT_BATCH_SIZE,
  type ValidatedQuestion,
} from "@/lib/admin/question-import";

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const { questions: validQuestions, csvText, csvContent, courseSlug } = body as {
    questions?: ValidatedQuestion[];
    csvText?: string;
    csvContent?: string;
    courseSlug?: string;
  };

  let questionsToCommit: ValidatedQuestion[] = [];

  const rawCsv = (typeof csvText === "string" ? csvText : typeof csvContent === "string" ? csvContent : "").trim();

  if (Array.isArray(validQuestions) && validQuestions.length > 0) {
    questionsToCommit = validQuestions;
  } else if (rawCsv) {
    // If client passed raw CSV, re-parse and re-validate server-side
    const parsed = parseCsvRows(rawCsv);
    if (parsed.length === 0) {
      return NextResponse.json(
        { error: "No question rows found in CSV." },
        { status: 400 },
      );
    }
    const validationResult = await validateQuestionsBatch(parsed, courseSlug);
    if (validationResult.validQuestions.length === 0) {
      return NextResponse.json(
        { error: "No valid questions found to import." },
        { status: 400 },
      );
    }
    questionsToCommit = validationResult.validQuestions;
  } else {
    return NextResponse.json(
      { error: "No validated questions or CSV content provided to commit." },
      { status: 400 },
    );
  }

  if (questionsToCommit.length > MAX_IMPORT_BATCH_SIZE) {
    return NextResponse.json(
      { error: `Batch size exceeds the maximum limit of ${MAX_IMPORT_BATCH_SIZE} questions per commit.` },
      { status: 400 },
    );
  }

  try {
    const result = await commitBulkQuestions(auth.user.id, questionsToCommit, courseSlug);
    return NextResponse.json({
      success: true,
      importedCount: result.importedCount,
      message: `Successfully imported ${result.importedCount} questions.`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import questions." },
      { status: 500 },
    );
  }
}
