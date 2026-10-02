import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth";
import {
  parseCsvRows,
  validateQuestionsBatch,
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

  const { csvText, questions: jsonRows } = body as {
    csvText?: string;
    questions?: Array<Record<string, string>>;
  };

  let rowsToValidate: Array<Record<string, string>> = [];

  if (typeof csvText === "string" && csvText.trim()) {
    rowsToValidate = parseCsvRows(csvText);
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

  if (rowsToValidate.length > 500) {
    return NextResponse.json(
      { error: "Batch size exceeds the limit of 500 questions per import." },
      { status: 400 },
    );
  }

  try {
    const result = await validateQuestionsBatch(rowsToValidate);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Validation failed." },
      { status: 500 },
    );
  }
}
