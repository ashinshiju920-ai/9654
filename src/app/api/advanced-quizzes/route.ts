import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { createAdvancedQuizAttempt } from "@/lib/admin/advanced-practice";
import { canUserAccessAdvancedCollection } from "@/lib/entitlements";

export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const { collectionId, collectionSlug, courseSlug } = body as {
    collectionId?: string;
    collectionSlug?: string;
    courseSlug?: string;
  };

  const identifier = (collectionId || collectionSlug || "").trim();
  if (!identifier) {
    return NextResponse.json(
      { error: "Advanced Collection identifier (ID or slug) is required." },
      { status: 400 },
    );
  }
  if (!collectionId && collectionSlug && !courseSlug?.trim()) {
    return NextResponse.json(
      { error: "Course slug is required when starting an Advanced quiz by collection slug." },
      { status: 400 },
    );
  }

  try {
    const authorization = await canUserAccessAdvancedCollection(
      user,
      identifier,
      courseSlug?.trim() || undefined,
    );
    if (!authorization.allowed) {
      return NextResponse.json(
        {
          error:
            authorization.reason === "not_found"
              ? "Advanced Collection not found."
              : "You do not have access to this Advanced Practice collection.",
        },
        { status: authorization.reason === "not_found" ? 404 : 403 },
      );
    }

    const attempt = await createAdvancedQuizAttempt(
      user.id,
      identifier,
      courseSlug?.trim() || undefined,
    );
    return NextResponse.json(attempt, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create Advanced quiz attempt." },
      { status: 400 },
    );
  }
}
