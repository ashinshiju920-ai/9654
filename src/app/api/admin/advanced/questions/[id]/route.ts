import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import {
  deleteAdvancedQuestion,
  updateAdvancedQuestion,
} from "@/lib/admin/advanced-practice";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const payload = body as {
    questionText?: string;
    prompt?: string;
    optionA?: string;
    optionB?: string;
    optionC?: string;
    optionD?: string;
    correctOption?: "A" | "B" | "C" | "D";
    explanation?: string | null;
    isActive?: boolean;
  };

  try {
    const updated = await updateAdvancedQuestion(auth.user.id, id, {
      questionText: payload.questionText || payload.prompt,
      optionA: payload.optionA,
      optionB: payload.optionB,
      optionC: payload.optionC,
      optionD: payload.optionD,
      correctOption: payload.correctOption,
      explanation: payload.explanation,
      isActive: payload.isActive,
    });

    return NextResponse.json(updated);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to update question.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const { id } = await params;

  try {
    const result = await deleteAdvancedQuestion(auth.user.id, id);
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to delete question.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
