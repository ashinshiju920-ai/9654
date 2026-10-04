import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { getAdvancedQuizAttemptReview } from "@/lib/admin/advanced-practice";
import { canUserAccessAdvancedAttempt } from "@/lib/entitlements";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { attemptId } = await params;

  try {
    const authorization = await canUserAccessAdvancedAttempt(user, attemptId);
    if (!authorization.allowed) {
      return NextResponse.json(
        {
          error:
            authorization.reason === "forbidden"
              ? "You do not have access to review this Advanced Practice attempt."
              : "Quiz attempt not found.",
        },
        { status: authorization.reason === "forbidden" ? 403 : 404 },
      );
    }

    const reviewData = await getAdvancedQuizAttemptReview(attemptId, user.id, {
      allowAdminAccess: user.role === "admin",
    });
    if (!reviewData) {
      return NextResponse.json({ error: "Quiz attempt not found." }, { status: 404 });
    }

    return NextResponse.json(reviewData);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to retrieve review." },
      { status: 400 },
    );
  }
}
