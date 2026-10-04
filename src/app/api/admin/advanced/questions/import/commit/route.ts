import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import {
  commitAdvancedBulkQuestions,
  validateAdvancedImportRows,
  type ValidatedAdvancedQuestion,
} from "@/lib/admin/advanced-import";

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

  const { collectionId, validQuestions } = body as {
    collectionId?: string;
    validQuestions?: ValidatedAdvancedQuestion[];
  };

  if (!collectionId || typeof collectionId !== "string" || !collectionId.trim()) {
    return NextResponse.json(
      { error: "Target Advanced Collection is required." },
      { status: 400 },
    );
  }

  if (!Array.isArray(validQuestions) || validQuestions.length === 0) {
    return NextResponse.json(
      { error: "No validated questions provided for import." },
      { status: 400 },
    );
  }

  try {
    // Re-validate questions server-side for integrity
    const validation = await validateAdvancedImportRows(
      collectionId.trim(),
      validQuestions.map((q) => ({
        question_text: q.questionText,
        option_a: q.optionA,
        option_b: q.optionB,
        option_c: q.optionC,
        option_d: q.optionD,
        correct_option: q.correctOption,
        explanation: q.explanation || undefined,
      })),
    );

    if (validation.invalidRows.length > 0 || validation.duplicateRows.length > 0) {
      return NextResponse.json(
        {
          error: "Server re-validation failed. Some questions are invalid or duplicates.",
          details: {
            invalidRows: validation.invalidRows,
            duplicateRows: validation.duplicateRows,
          },
        },
        { status: 400 },
      );
    }

    const result = await commitAdvancedBulkQuestions(
      auth.user.id,
      collectionId.trim(),
      validation.validQuestions,
    );

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to commit Advanced questions." },
      { status: 500 },
    );
  }
}
