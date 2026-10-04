import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { requireAdminApi } from "@/lib/auth";
import { withDb } from "@/lib/db";
import { questions, studentAnswers, quizAttemptQuestions } from "@/lib/db/schema";
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

  const payload = body as {
    questionText?: string;
    prompt?: string;
    optionA?: string;
    optionB?: string;
    optionC?: string;
    optionD?: string;
    options?: Array<{ id: string; text: string }>;
    correctOption?: string;
    correctOptionId?: string;
    explanation?: string | null;
    isActive?: boolean;
  };

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  const qText = payload.questionText || payload.prompt;
  if (typeof qText === "string" && qText.trim()) {
    updates.questionText = qText.trim();
  }

  let optA = payload.optionA;
  let optB = payload.optionB;
  let optC = payload.optionC;
  let optD = payload.optionD;

  if (Array.isArray(payload.options)) {
    for (const opt of payload.options) {
      if (opt.id === "A" && optA === undefined) optA = opt.text;
      if (opt.id === "B" && optB === undefined) optB = opt.text;
      if (opt.id === "C" && optC === undefined) optC = opt.text;
      if (opt.id === "D" && optD === undefined) optD = opt.text;
    }
  }

  if (typeof optA === "string" && optA.trim()) {
    updates.optionA = optA.trim();
  }
  if (typeof optB === "string" && optB.trim()) {
    updates.optionB = optB.trim();
  }
  if (typeof optC === "string" && optC.trim()) {
    updates.optionC = optC.trim();
  }
  if (typeof optD === "string" && optD.trim()) {
    updates.optionD = optD.trim();
  }

  const rawCorrect = payload.correctOption || payload.correctOptionId;
  if (typeof rawCorrect === "string") {
    const optUpper = rawCorrect.trim().toUpperCase();
    if (VALID_OPTIONS.has(optUpper)) {
      updates.correctOption = optUpper as "A" | "B" | "C" | "D";
    }
  }
  if (payload.explanation !== undefined) {
    updates.explanation = payload.explanation ? payload.explanation.trim() : null;
  }
  if (typeof payload.isActive === "boolean") {
    updates.isActive = payload.isActive;
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
    // Check if the question is referenced in student answers or quiz attempts
    const hasAttemptHistory = await withDb(async (db) => {
      const answers = await db
        .select({ id: studentAnswers.id })
        .from(studentAnswers)
        .where(eq(studentAnswers.questionId, id))
        .limit(1);
      if (answers.length > 0) return true;

      const attemptQuestions = await db
        .select({ id: quizAttemptQuestions.id })
        .from(quizAttemptQuestions)
        .where(eq(quizAttemptQuestions.questionId, id))
        .limit(1);
      return attemptQuestions.length > 0;
    });

    if (hasAttemptHistory) {
      // Safely archive question instead of violating foreign keys or breaking historical attempts
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
        details: "Archived question (deactivated) due to existing historical student attempts/answers",
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
