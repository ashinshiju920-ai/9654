import "server-only";

import { and, asc, desc, eq, ilike, or } from "drizzle-orm";

import type { SessionUser } from "@/lib/auth";
import { withDb } from "@/lib/db";
import {
  advancedCollections,
  advancedQuizAttempts,
  courseEntitlements,
  courses,
  users,
} from "@/lib/db/schema";

export const accessTiers = ["STANDARD", "ADVANCED"] as const;
export type AccessTier = (typeof accessTiers)[number];

export const entitlementStatuses = ["ACTIVE", "REVOKED", "EXPIRED"] as const;
export type EntitlementStatus = (typeof entitlementStatuses)[number];

export const entitlementSources = [
  "CASHFREE",
  "ADMIN",
  "PROMOTION",
  "IMPORT",
  "MIGRATION",
  "MAIN_SITE_PURCHASE",
] as const;
export type EntitlementSource = (typeof entitlementSources)[number];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EntitlementRecord = {
  id: string;
  userId: string;
  courseId: string;
  accessTier: AccessTier;
  status: EntitlementStatus;
  source: EntitlementSource;
  grantedAt: Date;
  expiresAt: Date | null;
  externalReference: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type AdvancedCollectionAccessDecision =
  | {
      allowed: true;
      reason: "allowed";
      context: NonNullable<Awaited<ReturnType<typeof getAdvancedCollectionAccessContext>>>;
    }
  | {
      allowed: false;
      reason: "not_found" | "forbidden";
      context: Awaited<ReturnType<typeof getAdvancedCollectionAccessContext>>;
    };

type AdvancedAttemptAccessDecision =
  | {
      allowed: true;
      reason: "allowed";
      context: NonNullable<Awaited<ReturnType<typeof getAdvancedAttemptAccessContext>>>;
    }
  | {
      allowed: false;
      reason: "not_found" | "forbidden";
      context: Awaited<ReturnType<typeof getAdvancedAttemptAccessContext>>;
    };

export function isAccessTier(value: string): value is AccessTier {
  return accessTiers.includes(value as AccessTier);
}

export function isEntitlementSource(value: string): value is EntitlementSource {
  return entitlementSources.includes(value as EntitlementSource);
}

export function isEntitlementActive(
  entitlement: Pick<EntitlementRecord, "status" | "expiresAt">,
  now = new Date(),
) {
  return (
    entitlement.status === "ACTIVE" &&
    (!entitlement.expiresAt || entitlement.expiresAt.getTime() > now.getTime())
  );
}

export function entitlementTierAllows(heldTier: AccessTier, requiredTier: AccessTier) {
  if (heldTier === requiredTier) return true;
  // Policy: Advanced is a superset for the same course, so Advanced unlocks Standard materials/tests.
  return heldTier === "ADVANCED" && requiredTier === "STANDARD";
}

export async function resolveCourse(identifier: string) {
  const normalized = identifier.trim().toLowerCase();
  if (!normalized) return null;

  const rows = await withDb((db) =>
    db
      .select({
        id: courses.id,
        slug: courses.slug,
        name: courses.name,
        isActive: courses.isActive,
      })
      .from(courses)
      .where(UUID_REGEX.test(normalized) ? eq(courses.id, identifier) : eq(courses.slug, normalized))
      .limit(1),
  );

  return rows[0] || null;
}

export async function userHasCourseEntitlement(
  userId: string,
  courseId: string,
  requiredTier: AccessTier,
  now = new Date(),
) {
  const course = await resolveCourse(courseId);
  if (requiredTier === "STANDARD" && course?.isActive) {
    return true;
  }

  const rows = await withDb((db) =>
    db
      .select({
        id: courseEntitlements.id,
        userId: courseEntitlements.userId,
        courseId: courseEntitlements.courseId,
        accessTier: courseEntitlements.accessTier,
        status: courseEntitlements.status,
        source: courseEntitlements.source,
        grantedAt: courseEntitlements.grantedAt,
        expiresAt: courseEntitlements.expiresAt,
        externalReference: courseEntitlements.externalReference,
        createdAt: courseEntitlements.createdAt,
        updatedAt: courseEntitlements.updatedAt,
      })
      .from(courseEntitlements)
      .where(
        and(
          eq(courseEntitlements.userId, userId),
          eq(courseEntitlements.courseId, courseId),
          eq(courseEntitlements.status, "ACTIVE"),
        ),
      ),
  );

  return rows.some((row) => {
    const entitlement = row as EntitlementRecord;
    return (
      isAccessTier(entitlement.accessTier) &&
      isEntitlementActive(entitlement, now) &&
      entitlementTierAllows(entitlement.accessTier, requiredTier)
    );
  });
}

export async function userHasAnyActiveAdvancedEntitlement(userId: string, now = new Date()) {
  const rows = await withDb((db) =>
    db
      .select({
        id: courseEntitlements.id,
        status: courseEntitlements.status,
        expiresAt: courseEntitlements.expiresAt,
      })
      .from(courseEntitlements)
      .where(
        and(
          eq(courseEntitlements.userId, userId),
          eq(courseEntitlements.accessTier, "ADVANCED"),
          eq(courseEntitlements.status, "ACTIVE"),
        ),
      ),
  );

  return rows.some((row) => isEntitlementActive(row as Pick<EntitlementRecord, "status" | "expiresAt">, now));
}

export async function canUserAccessCourse(
  user: SessionUser,
  courseIdOrSlug: string,
  requiredTier: AccessTier,
) {
  if (user.role === "admin") return true;

  const course = await resolveCourse(courseIdOrSlug);
  if (!course || !course.isActive) return false;

  if (requiredTier === "STANDARD") return true;

  const hasDirect = await userHasCourseEntitlement(user.id, course.id, requiredTier);
  if (hasDirect) return true;

  if (requiredTier === "ADVANCED") {
    return userHasAnyActiveAdvancedEntitlement(user.id);
  }

  return false;
}

export async function getAdvancedCollectionAccessContext(
  collectionIdOrSlug: string,
  courseSlug?: string,
) {
  const normalizedCollection = collectionIdOrSlug.trim().toLowerCase();
  if (!normalizedCollection) return null;

  const rows = await withDb((db) =>
    db
      .select({
        collectionId: advancedCollections.id,
        collectionSlug: advancedCollections.slug,
        collectionTitle: advancedCollections.title,
        isPublished: advancedCollections.isPublished,
        courseId: courses.id,
        courseSlug: courses.slug,
        courseName: courses.name,
        courseActive: courses.isActive,
      })
      .from(advancedCollections)
      .innerJoin(courses, eq(advancedCollections.courseId, courses.id))
      .where(
        UUID_REGEX.test(collectionIdOrSlug)
          ? eq(advancedCollections.id, collectionIdOrSlug)
          : and(
              eq(advancedCollections.slug, normalizedCollection),
              courseSlug ? eq(courses.slug, courseSlug.trim().toLowerCase()) : eq(advancedCollections.slug, normalizedCollection),
            ),
      )
      .limit(1),
  );

  return rows[0] || null;
}

export async function canUserAccessAdvancedCollection(
  user: SessionUser,
  collectionIdOrSlug: string,
  courseSlug?: string,
): Promise<AdvancedCollectionAccessDecision> {
  const context = await getAdvancedCollectionAccessContext(collectionIdOrSlug, courseSlug);
  if (!context || !context.courseActive) {
    return { allowed: false as const, reason: "not_found" as const, context: null };
  }

  if (user.role === "admin") {
    return { allowed: true as const, reason: "allowed" as const, context };
  }

  if (!context.isPublished) {
    return { allowed: false as const, reason: "not_found" as const, context };
  }

  const hasEntitlement =
    (await userHasCourseEntitlement(user.id, context.courseId, "ADVANCED")) ||
    (await userHasAnyActiveAdvancedEntitlement(user.id));

  if (hasEntitlement) {
    return {
      allowed: true as const,
      reason: "allowed" as const,
      context,
    };
  }

  return {
    allowed: false as const,
    reason: "forbidden" as const,
    context,
  };
}

export async function getAdvancedAttemptAccessContext(attemptId: string) {
  if (!UUID_REGEX.test(attemptId)) return null;

  const rows = await withDb((db) =>
    db
      .select({
        attemptId: advancedQuizAttempts.id,
        userId: advancedQuizAttempts.userId,
        courseId: advancedQuizAttempts.courseId,
        collectionId: advancedQuizAttempts.collectionId,
        status: advancedQuizAttempts.status,
        courseSlug: courses.slug,
        courseName: courses.name,
      })
      .from(advancedQuizAttempts)
      .innerJoin(courses, eq(advancedQuizAttempts.courseId, courses.id))
      .where(eq(advancedQuizAttempts.id, attemptId))
      .limit(1),
  );

  return rows[0] || null;
}

export async function canUserAccessAdvancedAttempt(
  user: SessionUser,
  attemptId: string,
): Promise<AdvancedAttemptAccessDecision> {
  const context = await getAdvancedAttemptAccessContext(attemptId);
  if (!context) return { allowed: false as const, reason: "not_found" as const, context: null };

  if (user.role !== "admin" && context.userId !== user.id) {
    return { allowed: false as const, reason: "not_found" as const, context };
  }

  if (user.role === "admin") {
    return { allowed: true as const, reason: "allowed" as const, context };
  }

  const hasEntitlement =
    (await userHasCourseEntitlement(user.id, context.courseId, "ADVANCED")) ||
    (await userHasAnyActiveAdvancedEntitlement(user.id));

  if (hasEntitlement) {
    return {
      allowed: true as const,
      reason: "allowed" as const,
      context,
    };
  }

  return {
    allowed: false as const,
    reason: "forbidden" as const,
    context,
  };
}

export async function grantEntitlement(input: {
  userId: string;
  courseId: string;
  accessTier: AccessTier;
  source: EntitlementSource;
  expiresAt?: Date | null;
  externalReference?: string | null;
}) {
  return withDb(async (db) => {
    const [targetUser] = await db.select({ id: users.id }).from(users).where(eq(users.id, input.userId)).limit(1);
    if (!targetUser) throw new Error("Target user not found.");

    const [targetCourse] = await db.select({ id: courses.id }).from(courses).where(eq(courses.id, input.courseId)).limit(1);
    if (!targetCourse) throw new Error("Target course not found.");

    const baseConditions = [
      eq(courseEntitlements.userId, input.userId),
      eq(courseEntitlements.courseId, input.courseId),
      eq(courseEntitlements.accessTier, input.accessTier),
      eq(courseEntitlements.source, input.source),
    ];

    if (input.externalReference) {
      baseConditions.push(eq(courseEntitlements.externalReference, input.externalReference));
    }

    const existing = await db
      .select({ id: courseEntitlements.id })
      .from(courseEntitlements)
      .where(and(...baseConditions))
      .limit(1);

    if (existing[0]) {
      const [updated] = await db
        .update(courseEntitlements)
        .set({
          status: "ACTIVE",
          expiresAt: input.expiresAt ?? null,
          externalReference: input.externalReference ?? null,
          updatedAt: new Date(),
        })
        .where(eq(courseEntitlements.id, existing[0].id))
        .returning();
      return { entitlement: updated, created: false };
    }

    const [created] = await db
      .insert(courseEntitlements)
      .values({
        userId: input.userId,
        courseId: input.courseId,
        accessTier: input.accessTier,
        status: "ACTIVE",
        source: input.source,
        expiresAt: input.expiresAt ?? null,
        externalReference: input.externalReference ?? null,
      })
      .returning();

    return { entitlement: created, created: true };
  });
}

export async function revokeEntitlement(entitlementId: string) {
  if (!UUID_REGEX.test(entitlementId)) throw new Error("Invalid entitlement ID.");

  const [updated] = await withDb((db) =>
    db
      .update(courseEntitlements)
      .set({ status: "REVOKED", updatedAt: new Date() })
      .where(eq(courseEntitlements.id, entitlementId))
      .returning(),
  );

  if (!updated) throw new Error("Entitlement not found.");
  return updated;
}

export async function listEntitlements(options?: { search?: string; userId?: string }) {
  return withDb(async (db) => {
    const conditions = [];
    if (options?.userId) conditions.push(eq(courseEntitlements.userId, options.userId));
    if (options?.search?.trim()) {
      const pattern = `%${options.search.trim()}%`;
      conditions.push(or(ilike(users.email, pattern), ilike(users.fullName, pattern)));
    }

    const rows = await db
      .select({
        id: courseEntitlements.id,
        userId: courseEntitlements.userId,
        userEmail: users.email,
        userName: users.fullName,
        courseId: courseEntitlements.courseId,
        courseSlug: courses.slug,
        courseName: courses.name,
        accessTier: courseEntitlements.accessTier,
        status: courseEntitlements.status,
        source: courseEntitlements.source,
        grantedAt: courseEntitlements.grantedAt,
        expiresAt: courseEntitlements.expiresAt,
        externalReference: courseEntitlements.externalReference,
        createdAt: courseEntitlements.createdAt,
        updatedAt: courseEntitlements.updatedAt,
      })
      .from(courseEntitlements)
      .innerJoin(users, eq(courseEntitlements.userId, users.id))
      .innerJoin(courses, eq(courseEntitlements.courseId, courses.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(courseEntitlements.updatedAt));

    return rows;
  });
}

export async function getEntitlementAdminOptions() {
  return withDb(async (db) => {
    const studentRows = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
      })
      .from(users)
      .where(eq(users.role, "student"))
      .orderBy(asc(users.email))
      .limit(500);

    const courseRows = await db
      .select({
        id: courses.id,
        slug: courses.slug,
        name: courses.name,
      })
      .from(courses)
      .orderBy(asc(courses.displayOrder));

    return { students: studentRows, courses: courseRows };
  });
}
