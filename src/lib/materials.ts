import "server-only";

import { cache } from "react";

import type { CourseSlug } from "@/lib/courses";
import { createClient } from "@/lib/supabase/server";
import type { PublishedPdf } from "@/lib/types";

type PdfRow = {
  created_at: string;
  description: string | null;
  file_size_bytes: number | null;
  id: string;
  mime_type: string | null;
  title: string;
};

export const getPublishedPdfsForCourse = cache(
  async (courseSlug: CourseSlug): Promise<PublishedPdf[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("course_pdfs")
      .select(
        `
          id,
          title,
          description,
          file_size_bytes,
          mime_type,
          created_at,
          courses!inner(slug, is_active)
        `,
      )
      .eq("is_published", true)
      .eq("courses.slug", courseSlug)
      .eq("courses.is_active", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error("Unable to load study materials.");
    }

    return ((data ?? []) as PdfRow[]).map((pdf) => ({
      courseSlug,
      description: pdf.description,
      fileSizeBytes: pdf.file_size_bytes,
      id: pdf.id,
      mimeType: pdf.mime_type ?? "application/pdf",
      publishedAt: pdf.created_at,
      title: pdf.title,
    }));
  },
);

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
