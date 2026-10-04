import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import {
  createAdvancedCollection,
  getAdvancedCollections,
} from "@/lib/admin/advanced-practice";

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const url = new URL(request.url);
  const courseSlug = url.searchParams.get("course") || url.searchParams.get("courseSlug") || undefined;
  const isPublishedParam = url.searchParams.get("isPublished");
  const isPublished = isPublishedParam === "true" ? true : isPublishedParam === "false" ? false : undefined;
  const search = url.searchParams.get("search") || undefined;

  try {
    const collections = await getAdvancedCollections({
      courseSlug,
      isPublished,
      search,
    });

    return NextResponse.json({ collections });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load Advanced collections." },
      { status: 500 },
    );
  }
}

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

  const payload = body as {
    courseSlugOrId?: string;
    courseId?: string;
    courseSlug?: string;
    course?: string;
    title?: string;
    slug?: string;
    description?: string;
    displayOrder?: number;
    isPublished?: boolean;
  };

  const course = (payload.courseSlugOrId || payload.courseId || payload.courseSlug || payload.course || "").trim();
  const title = (payload.title || "").trim();
  const slug = (payload.slug || "").trim();

  if (!course) {
    return NextResponse.json({ error: "Course is required." }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: "Collection title is required." }, { status: 400 });
  }
  if (!slug) {
    return NextResponse.json({ error: "Collection slug is required." }, { status: 400 });
  }

  try {
    const created = await createAdvancedCollection(auth.user.id, {
      courseSlugOrId: course,
      title,
      slug,
      description: payload.description,
      displayOrder: payload.displayOrder,
      isPublished: payload.isPublished,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to create Advanced collection.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
