import type { CourseSlug } from "@/lib/courses";
import type { AccessTier } from "@/lib/entitlements";
import { getRuntimeEnvValue } from "@/lib/cloudflare/runtime";

/**
 * Deterministic mapping registry between main-site products and student portal courses.
 *
 * Requirements:
 * - Deterministic, auditable, and configurable.
 * - No guessing or fuzzy matching.
 * - By default, a standard main-site purchase resolves to STANDARD access tier
 *   unless explicitly mapped to ADVANCED.
 */

export type MainSiteProductMapping = {
  courseSlug: CourseSlug;
  accessTier: AccessTier;
  label: string;
  active?: boolean;
};

export const MAIN_SITE_PRODUCT_MAP: Record<string, MainSiteProductMapping> = {};

export const MAIN_SITE_COURSE_EVENT_MAP: Record<string, MainSiteProductMapping> = {
  ielts: { courseSlug: "ielts", accessTier: "STANDARD", label: "Main-site IELTS course event" },
  oet: { courseSlug: "oet", accessTier: "STANDARD", label: "Main-site OET course event" },
  pte: { courseSlug: "pte", accessTier: "STANDARD", label: "Main-site PTE course event" },
  german: { courseSlug: "german", accessTier: "STANDARD", label: "Main-site German course event" },
};

export type ResolveCourseAccessInput = {
  productId?: string | null;
  productSlug?: string | null;
  courseKey?: string | null;
  courseCategory?: string | null;
  courseSlug?: string | null;
  accessTier?: string | null;
};

export type ResolveCourseAccessResult =
  | {
      ok: true;
      courseSlug: CourseSlug;
      accessTier: AccessTier;
      productKey: string;
      label: string;
    }
  | {
      ok: false;
      error: string;
    };

const VALID_COURSE_SLUGS: Set<string> = new Set(["ielts", "oet", "pte", "german"]);
const VALID_ACCESS_TIERS: Set<string> = new Set(["STANDARD", "ADVANCED"]);

export async function resolveMainSiteCourseAccess(
  input: ResolveCourseAccessInput,
): Promise<ResolveCourseAccessResult> {
  const configuredMap = await loadConfiguredProductMap();
  const productMap = { ...MAIN_SITE_COURSE_EVENT_MAP, ...MAIN_SITE_PRODUCT_MAP, ...configuredMap };
  const candidateKeys = [
    input.productId,
    input.productSlug,
    input.courseKey,
    input.courseCategory,
    input.courseSlug,
  ]
    .filter((k): k is string => typeof k === "string" && k.trim().length > 0)
    .map((k) => k.trim().toLowerCase());

  for (const key of candidateKeys) {
    const mapped = productMap[key];
    if (mapped) {
      if (mapped.active === false) {
        return {
          ok: false,
          error: `Main-site product is explicitly inactive or not eligible for portal access: ${key}`,
        };
      }

      return {
        ok: true,
        courseSlug: mapped.courseSlug,
        accessTier: mapped.accessTier,
        productKey: key,
        label: mapped.label,
      };
    }
  }

  return {
    ok: false,
    error: `Unmapped or unknown product/course identity: ${
      input.productId || input.productSlug || input.courseSlug || "(none)"
    }`,
  };
}

async function loadConfiguredProductMap(): Promise<Record<string, MainSiteProductMapping>> {
  const raw =
    (await getRuntimeEnvValue("MAIN_SITE_PRODUCT_COURSE_MAP")) ||
    process.env.MAIN_SITE_PRODUCT_COURSE_MAP;

  if (!raw?.trim()) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("MAIN_SITE_PRODUCT_COURSE_MAP must be valid JSON.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("MAIN_SITE_PRODUCT_COURSE_MAP must be a JSON object.");
  }

  const result: Record<string, MainSiteProductMapping> = {};
  for (const [rawKey, value] of Object.entries(parsed)) {
    const key = rawKey.trim().toLowerCase();
    if (!key) continue;

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`Invalid main-site mapping for ${rawKey}.`);
    }

    const entry = value as Partial<MainSiteProductMapping>;
    const courseSlug = typeof entry.courseSlug === "string" ? entry.courseSlug.trim().toLowerCase() : "";
    const accessTier = typeof entry.accessTier === "string" ? entry.accessTier.trim().toUpperCase() : "";

    if (!VALID_COURSE_SLUGS.has(courseSlug) || !VALID_ACCESS_TIERS.has(accessTier)) {
      throw new Error(`Invalid courseSlug or accessTier in main-site mapping for ${rawKey}.`);
    }

    result[key] = {
      courseSlug: courseSlug as CourseSlug,
      accessTier: accessTier as AccessTier,
      label: typeof entry.label === "string" && entry.label.trim() ? entry.label.trim() : key,
      active: entry.active,
    };
  }

  return result;
}
