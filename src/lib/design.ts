import type { CourseSlug } from "./courses";

export const courseAccents: Record<CourseSlug, string> = {
  ielts: "#C8102E",
  oet: "#0867E8",
  pte: "#08A957",
  german: "#111111",
};

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
