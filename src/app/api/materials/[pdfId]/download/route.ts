import { NextResponse } from "next/server";

import { isUuid } from "@/lib/materials";
import { createPdfDownloadUrl } from "@/lib/r2/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type DownloadRouteProps = {
  params: Promise<{
    pdfId: string;
  }>;
};

type PdfDownloadRow = {
  courses: { is_active: boolean; slug: string }[] | { is_active: boolean; slug: string } | null;
  id: string;
  is_published: boolean;
  r2_object_key: string;
  title: string;
};

export async function POST(_request: Request, { params }: DownloadRouteProps) {
  const { pdfId } = await params;

  if (!isUuid(pdfId)) {
    return NextResponse.json({ error: "Invalid material request." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Please log in to download study materials." }, { status: 401 });
  }

  const adminSupabase = createAdminClient();
  const { data, error } = await adminSupabase
    .from("course_pdfs")
    .select("id,title,r2_object_key,is_published,courses!inner(slug,is_active)")
    .eq("id", pdfId)
    .eq("is_published", true)
    .eq("courses.is_active", true)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "This study material is not available." }, { status: 404 });
  }

  const pdf = data as PdfDownloadRow;
  const course = Array.isArray(pdf.courses) ? pdf.courses[0] : pdf.courses;

  if (!pdf.is_published || !course?.is_active) {
    return NextResponse.json({ error: "This study material is not available." }, { status: 404 });
  }

  try {
    const url = await createPdfDownloadUrl(pdf.r2_object_key, pdf.title);
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json(
      { error: "The file is temporarily unavailable. Please try again later." },
      { status: 503 },
    );
  }
}
