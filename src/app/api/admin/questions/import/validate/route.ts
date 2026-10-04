import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth";
import {
  parseCsvRows,
  validateQuestionsBatch,
  MAX_IMPORT_BATCH_SIZE,
  RECOMMENDED_IMPORT_BATCH_SIZE,
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

  const { csvText, csvContent, questions: jsonRows, courseSlug } = body as {
    csvText?: string;
    csvContent?: string;
    questions?: Array<Record<string, string>>;
    courseSlug?: string;
  };

  const textToParse = (typeof csvText === "string" ? csvText : typeof csvContent === "string" ? csvContent : "").trim();

  let rowsToValidate: Array<Record<string, string>> = [];

  if (textToParse) {
    rowsToValidate = parseCsvRows(textToParse);
  } else if (Array.isArray(jsonRows)) {
    rowsToValidate = jsonRows;
  } else {
    return NextResponse.json(
      { error: "Provide either 'csvText' string or 'questions' array for validation." },
      { status: 400 },
    );
  }

  if (rowsToValidate.length === 0) {
    return NextResponse.json(
      { error: "No question rows found to validate. Check file content and headers." },
      { status: 400 },
    );
  }

  if (rowsToValidate.length > MAX_IMPORT_BATCH_SIZE) {
    return NextResponse.json(
      {
        error: `Batch size (${rowsToValidate.length}) exceeds the maximum limit of ${MAX_IMPORT_BATCH_SIZE} questions per import. Recommended batch size: ${RECOMMENDED_IMPORT_BATCH_SIZE} questions.`,
      },
      { status: 400 },
    );
  }

  try {
    const result = await validateQuestionsBatch(rowsToValidate, courseSlug);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Validation failed." },
      { status: 500 },
    );
  }
}
