export const courseSlugs = ["ielts", "oet", "pte", "german"] as const;

export type CourseSlug = (typeof courseSlugs)[number];

export type Course = {
  slug: CourseSlug;
  name: string;
  description: string;
};

export const courses: Course[] = [
  {
    slug: "ielts",
    name: "IELTS",
    description: "Preparation materials and mock test practice for IELTS students.",
  },
  {
    slug: "oet",
    name: "OET",
    description: "Published PDFs and mock test practice for healthcare English preparation.",
  },
  {
    slug: "pte",
    name: "PTE",
    description: "Study PDFs and randomized question practice for PTE learners.",
  },
  {
    slug: "german",
    name: "German",
    description: "German language PDFs and mock test practice from the Aylem Learning team.",
  },
];

export function getCourse(slug: string): Course | undefined {
  return courses.find((course) => course.slug === slug);
}
