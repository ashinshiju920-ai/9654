import "server-only";

import { cache } from "react";
import { and, desc, eq, asc } from "drizzle-orm";

import type { CourseSlug } from "@/lib/courses";
import { getDb } from "@/lib/db";
import { courses, coursePdfs } from "@/lib/db/schema";
import type { PublishedPdf } from "@/lib/types";

export const getPublishedPdfsForCourse = cache(
  async (courseSlug: CourseSlug): Promise<PublishedPdf[]> => {
    try {
      const db = await getDb();
      const rows = await db
        .select({
          id: coursePdfs.id,
          title: coursePdfs.title,
          description: coursePdfs.description,
          fileSizeBytes: coursePdfs.fileSizeBytes,
          mimeType: coursePdfs.mimeType,
          createdAt: coursePdfs.createdAt,
        })
        .from(coursePdfs)
        .innerJoin(courses, eq(coursePdfs.courseId, courses.id))
        .where(
          and(
            eq(coursePdfs.isPublished, true),
            eq(courses.slug, courseSlug),
            eq(courses.isActive, true),
          ),
        )
        .orderBy(asc(coursePdfs.displayOrder), desc(coursePdfs.createdAt));

      return rows.map((pdf) => ({
        courseSlug,
        description: pdf.description,
        fileSizeBytes: pdf.fileSizeBytes,
        id: pdf.id,
        mimeType: pdf.mimeType ?? "application/pdf",
        publishedAt: pdf.createdAt.toISOString(),
        title: pdf.title,
      }));
    } catch {
      // In development or when database is not yet seeded, return empty array gracefully
      return [];
    }
  },
);

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
