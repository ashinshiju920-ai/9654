import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { submitAdvancedQuizAttempt } from "@/lib/admin/advanced-practice";
import { canUserAccessAdvancedAttempt } from "@/lib/entitlements";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { attemptId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const { answers } = body as {
    answers?: Array<{ questionId: string; selectedOption: "A" | "B" | "C" | "D" }>;
  };

  if (!Array.isArray(answers) || answers.length === 0) {
    return NextResponse.json(
      { error: "At least one answer must be submitted." },
      { status: 400 },
    );
  }

  try {
    const authorization = await canUserAccessAdvancedAttempt(user, attemptId);
    if (!authorization.allowed) {
      return NextResponse.json(
        {
          error:
            authorization.reason === "forbidden"
              ? "You do not have access to submit this Advanced Practice attempt."
              : "Quiz attempt not found.",
        },
        { status: authorization.reason === "forbidden" ? 403 : 404 },
      );
    }

    const result = await submitAdvancedQuizAttempt(attemptId, user.id, answers, {
      allowAdminAccess: user.role === "admin",
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit quiz attempt." },
      { status: 400 },
    );
  }
}
