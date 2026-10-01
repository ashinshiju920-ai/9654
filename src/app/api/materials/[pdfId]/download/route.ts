import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { courses, coursePdfs } from "@/lib/db/schema";
import { isUuid } from "@/lib/materials";
import { createPdfDownloadUrl } from "@/lib/r2/client";

type DownloadRouteProps = {
  params: Promise<{
    pdfId: string;
  }>;
};

export async function POST(_request: Request, { params }: DownloadRouteProps) {
  const { pdfId } = await params;

  if (!isUuid(pdfId)) {
    return NextResponse.json({ error: "Invalid material request." }, { status: 400 });
  }

  // Server-side authentication check
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Please log in to download study materials." },
      { status: 401 },
    );
  }

  // Look up PDF and its parent course with active/published status
  const results = await db
    .select({
      id: coursePdfs.id,
      title: coursePdfs.title,
      r2ObjectKey: coursePdfs.r2ObjectKey,
      isPublished: coursePdfs.isPublished,
      courseActive: courses.isActive,
    })
    .from(coursePdfs)
    .innerJoin(courses, eq(coursePdfs.courseId, courses.id))
    .where(
      and(
        eq(coursePdfs.id, pdfId),
        eq(coursePdfs.isPublished, true),
        eq(courses.isActive, true),
      ),
    )
    .limit(1);

  if (results.length === 0) {
    return NextResponse.json(
      { error: "This study material is not available." },
      { status: 404 },
    );
  }

  const pdf = results[0];

  try {
    const url = await createPdfDownloadUrl(pdf.r2ObjectKey, pdf.title);
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json(
      { error: "The file is temporarily unavailable. Please try again later." },
      { status: 503 },
    );
  }
}
