import type { CourseSlug } from "./courses";

export type PublishedPdf = {
  id: string;
  courseSlug: CourseSlug;
  title: string;
  description: string | null;
  fileSizeBytes: number | null;
  mimeType: string;
  publishedAt: string;
};

export type Question = {
  id: string;
  courseSlug: CourseSlug;
  prompt: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string | null;
  isPublished: boolean;
};

export type QuizSize = 20 | 50 | 100;
