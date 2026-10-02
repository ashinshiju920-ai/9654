import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { submitQuizAttempt, type QuizAnswerInput } from "@/lib/db/quiz";
import { isUuid } from "@/lib/materials";

type SubmitQuizRouteProps = {
  params: Promise<{
    attemptId: string;
  }>;
};

const validOptions = new Set(["A", "B", "C", "D"]);

export async function POST(request: Request, props: SubmitQuizRouteProps) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { attemptId } = await props.params;

  if (!isUuid(attemptId)) {
    return NextResponse.json({ error: "Invalid quiz attempt." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const { answers } = body as { answers?: unknown };

  if (!Array.isArray(answers)) {
    return NextResponse.json({ error: "Answers are required." }, { status: 400 });
  }

  const parsedAnswers: QuizAnswerInput[] = [];

  for (const answer of answers) {
    if (!answer || typeof answer !== "object") {
      return NextResponse.json({ error: "Invalid answer payload." }, { status: 400 });
    }

    const { questionId, selectedOption } = answer as {
      questionId?: string;
      selectedOption?: string;
    };

    if (!questionId || !isUuid(questionId) || !selectedOption || !validOptions.has(selectedOption)) {
      return NextResponse.json({ error: "Invalid answer payload." }, { status: 400 });
    }

    parsedAnswers.push({
      questionId,
      selectedOption: selectedOption as QuizAnswerInput["selectedOption"],
    });
  }

  try {
    const result = await submitQuizAttempt(attemptId, user.id, parsedAnswers);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to submit quiz attempt." },
      { status: 400 },
    );
  }
}
