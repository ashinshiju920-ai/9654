import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth";
import {
  commitBulkQuestions,
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

  const { questions: validQuestions } = body as {
    questions?: ValidatedQuestion[];
  };

  if (!Array.isArray(validQuestions) || validQuestions.length === 0) {
    return NextResponse.json(
      { error: "No validated questions provided to commit." },
      { status: 400 },
    );
  }

  if (validQuestions.length > 500) {
    return NextResponse.json(
      { error: "Batch size exceeds the limit of 500 questions per commit." },
      { status: 400 },
    );
  }

  try {
    const result = await commitBulkQuestions(auth.user.id, validQuestions);
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
