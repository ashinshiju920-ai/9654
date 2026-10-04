import type { CourseSlug } from "./courses";

export const courseAccents: Record<CourseSlug, string> = {
  ielts: "#DC5B6D",
  oet: "#5BBF8F",
  pte: "#5BA7E8",
  german: "#E7C95A",
};

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
