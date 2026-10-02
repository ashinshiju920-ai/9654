import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { requireAdminApi } from "@/lib/auth";
import { withDb } from "@/lib/db";
import { questions, studentAnswers } from "@/lib/db/schema";
import { isUuid } from "@/lib/materials";
import { logAdminAudit } from "@/lib/admin/audit";

const VALID_OPTIONS = new Set(["A", "B", "C", "D"]);

type QuestionRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, props: QuestionRouteProps) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const { id } = await props.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid question ID." }, { status: 400 });
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

  const {
    questionText,
    optionA,
    optionB,
    optionC,
    optionD,
    correctOption,
    explanation,
    isActive,
  } = body as {
    questionText?: string;
    optionA?: string;
    optionB?: string;
    optionC?: string;
    optionD?: string;
    correctOption?: string;
    explanation?: string | null;
    isActive?: boolean;
  };

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (typeof questionText === "string" && questionText.trim()) {
    updates.questionText = questionText.trim();
  }
  if (typeof optionA === "string" && optionA.trim()) {
    updates.optionA = optionA.trim();
  }
  if (typeof optionB === "string" && optionB.trim()) {
    updates.optionB = optionB.trim();
  }
  if (typeof optionC === "string" && optionC.trim()) {
    updates.optionC = optionC.trim();
  }
  if (typeof optionD === "string" && optionD.trim()) {
    updates.optionD = optionD.trim();
  }
  if (typeof correctOption === "string") {
    const optUpper = correctOption.trim().toUpperCase();
    if (VALID_OPTIONS.has(optUpper)) {
      updates.correctOption = optUpper as "A" | "B" | "C" | "D";
    }
  }
  if (explanation !== undefined) {
    updates.explanation = explanation ? explanation.trim() : null;
  }
  if (typeof isActive === "boolean") {
    updates.isActive = isActive;
  }

  try {
    const [updated] = await withDb((db) =>
      db
        .update(questions)
        .set(updates)
        .where(eq(questions.id, id))
        .returning(),
    );

    if (!updated) {
      return NextResponse.json({ error: "Question not found." }, { status: 404 });
    }

    await logAdminAudit({
      adminUserId: auth.user.id,
      action: "question.update",
      targetType: "question",
      targetId: id,
      details: `Updated question (Active: ${updated.isActive})`,
    });

    return NextResponse.json({
      success: true,
      question: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update question." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, props: QuestionRouteProps) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const { id } = await props.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid question ID." }, { status: 400 });
  }

  try {
    // Check if the question is referenced in student answers
    const hasAnswers = await withDb(async (db) => {
      const rows = await db
        .select({ id: studentAnswers.id })
        .from(studentAnswers)
        .where(eq(studentAnswers.questionId, id))
        .limit(1);
      return rows.length > 0;
    });

    if (hasAnswers) {
      // Safely archive question instead of violating foreign keys on completed student attempts
      await withDb((db) =>
        db
          .update(questions)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(questions.id, id))
          .returning(),
      );

      await logAdminAudit({
        adminUserId: auth.user.id,
        action: "question.update",
        targetType: "question",
        targetId: id,
        details: "Archived question (deactivated) due to existing historical student answers",
      });

      return NextResponse.json({
        success: true,
        archived: true,
        message: "Question has existing student attempt history and was safely archived/deactivated.",
      });
    }

    // Unreferenced question can be safely deleted
    const [deleted] = await withDb((db) =>
      db
        .delete(questions)
        .where(eq(questions.id, id))
        .returning({ id: questions.id }),
    );

    if (!deleted) {
      return NextResponse.json({ error: "Question not found." }, { status: 404 });
    }

    await logAdminAudit({
      adminUserId: auth.user.id,
      action: "question.delete",
      targetType: "question",
      targetId: id,
      details: "Deleted unreferenced question",
    });

    return NextResponse.json({ success: true, message: "Question deleted successfully." });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete question." },
      { status: 500 },
    );
  }
}
