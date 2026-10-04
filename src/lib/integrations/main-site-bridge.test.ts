import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";

import {
  constantTimeEqual,
  createMainSiteSignature,
  verifyMainSiteSignature,
  processMainSitePurchase,
} from "./main-site-bridge";
import { resolveMainSiteCourseAccess } from "./main-site-mapping";

type MockDbState = {
  selectQueue: unknown[][];
  insertReturnQueue: unknown[];
};

const mockDbState: MockDbState = {
  selectQueue: [],
  insertReturnQueue: [],
};

// Mock dependencies for unit testing
vi.mock("@/lib/cloudflare/runtime", () => ({
  getRuntimeEnvValue: vi.fn(async (key: string) => {
    if (key === "MAIN_SITE_INTEGRATION_SECRET") return "test-secret-key-12345";
    if (key === "APP_BASE_URL") return "https://portal.aylemlearning.online";
    if (key === "MAIN_SITE_PRODUCT_COURSE_MAP") {
      return JSON.stringify({
        "main-ielts-standard": {
          courseSlug: "ielts",
          accessTier: "STANDARD",
          label: "Main IELTS Book",
        },
        "main-ielts-advanced": {
          courseSlug: "ielts",
          accessTier: "ADVANCED",
          label: "Main IELTS Advanced",
        },
        "main-oet-advanced": {
          courseSlug: "oet",
          accessTier: "ADVANCED",
          label: "Main OET Advanced",
        },
        "main-pte-standard": {
          courseSlug: "pte",
          accessTier: "STANDARD",
          label: "Main PTE Book",
        },
        "main-german-standard": {
          courseSlug: "german",
          accessTier: "STANDARD",
          label: "Main German Book",
        },
        "inactive-pte": {
          courseSlug: "pte",
          accessTier: "STANDARD",
          label: "Inactive PTE Book",
          active: false,
        },
      });
    }
    return undefined;
  }),
}));

vi.mock("@/lib/db", () => ({
  withDb: vi.fn(async (callback: (db: unknown) => Promise<unknown>) => {
    const nextSelect = () => mockDbState.selectQueue.shift() ?? [];
    const nextInsertReturn = (data: unknown) => mockDbState.insertReturnQueue.shift() ?? data;
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => nextSelect(),
          }),
          innerJoin: () => ({
            where: () => nextSelect(),
          }),
        }),
      }),
      insert: () => ({
        values: (data: unknown) => ({
          returning: () => [nextInsertReturn(data)],
          onConflictDoNothing: () => Promise.resolve(),
          onConflictDoUpdate: () => Promise.resolve(),
        }),
      }),
    };
    return callback(mockDb);
  }),
}));

vi.mock("@/lib/email/resend", () => ({
  sendTransactionalEmail: vi.fn().mockResolvedValue({ status: "sent", id: "mock-email-id" }),
}));

vi.mock("@/lib/entitlements", () => ({
  grantEntitlement: vi.fn().mockResolvedValue({
    entitlement: { id: "ent-123", status: "ACTIVE" },
    created: true,
  }),
}));

beforeEach(() => {
  mockDbState.selectQueue = [];
  mockDbState.insertReturnQueue = [];
  vi.clearAllMocks();
});

describe("Main Site Bridge - Signature & Replay Protection", () => {
  const secret = "test-secret-key-12345";
  const now = 1791054000000;

  function sign(body: string, timestamp: number | string, key = secret) {
    const hmac = createHmac("sha256", key);
    hmac.update(`${timestamp}${body}`);
    return hmac.digest("hex");
  }

  it("verifies valid HMAC-SHA256 hex signature", async () => {
    const body = JSON.stringify({ orderId: "ord_1", paymentStatus: "PAID" });
    const timestamp = now;
    const signature = sign(body, timestamp);

    const result = await verifyMainSiteSignature({
      rawBody: body,
      timestamp: String(timestamp),
      signature,
      secret,
      now,
    });

    expect(result.valid).toBe(true);
  });

  it("creates Cloudflare-compatible HMAC signatures with Web Crypto", async () => {
    const body = JSON.stringify({ orderId: "ord_1", paymentStatus: "PAID" });
    const timestamp = String(now);

    await expect(createMainSiteSignature({ rawBody: body, timestamp, secret })).resolves.toBe(
      sign(body, timestamp),
    );
  });

  it("verifies valid HMAC-SHA256 base64 signature", async () => {
    const body = JSON.stringify({ orderId: "ord_1", paymentStatus: "PAID" });
    const timestamp = now;
    const hmac = createHmac("sha256", secret);
    hmac.update(`${timestamp}${body}`);
    const signature = hmac.digest("base64");

    const result = await verifyMainSiteSignature({
      rawBody: body,
      timestamp: String(timestamp),
      signature,
      secret,
      now,
    });

    expect(result.valid).toBe(true);
  });

  it("rejects invalid signature", async () => {
    const body = JSON.stringify({ orderId: "ord_1" });
    const result = await verifyMainSiteSignature({
      rawBody: body,
      timestamp: String(now),
      signature: "invalidsignature123",
      secret,
      now,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Invalid signature.");
  });

  it("rejects missing signature", async () => {
    const body = JSON.stringify({ orderId: "ord_1" });
    const result = await verifyMainSiteSignature({
      rawBody: body,
      timestamp: String(now),
      signature: null,
      secret,
      now,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Missing signature header.");
  });

  it("rejects missing timestamp", async () => {
    const body = JSON.stringify({ orderId: "ord_1" });
    const result = await verifyMainSiteSignature({
      rawBody: body,
      timestamp: "",
      signature: "sig",
      secret,
      now,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Missing timestamp header.");
  });

  it("rejects stale timestamp older than 5 minutes", async () => {
    const body = JSON.stringify({ orderId: "ord_1" });
    const staleTimestamp = now - 6 * 60 * 1000; // 6 mins ago
    const signature = sign(body, staleTimestamp);

    const result = await verifyMainSiteSignature({
      rawBody: body,
      timestamp: String(staleTimestamp),
      signature,
      secret,
      now,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toContain("outside the allowed tolerance");
  });

  it("rejects future timestamp drifting beyond 5 minutes", async () => {
    const body = JSON.stringify({ orderId: "ord_1" });
    const futureTimestamp = now + 6 * 60 * 1000; // 6 mins in future
    const signature = sign(body, futureTimestamp);

    const result = await verifyMainSiteSignature({
      rawBody: body,
      timestamp: String(futureTimestamp),
      signature,
      secret,
      now,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toContain("outside the allowed tolerance");
  });

  it("rejects tampered payload (tampered body with original signature)", async () => {
    const originalBody = JSON.stringify({ orderId: "ord_1", customerEmail: "legit@aylem.com" });
    const signature = sign(originalBody, now);
    const tamperedBody = JSON.stringify({ orderId: "ord_1", customerEmail: "hacker@aylem.com" });

    const result = await verifyMainSiteSignature({
      rawBody: tamperedBody,
      timestamp: String(now),
      signature,
      secret,
      now,
    });

    expect(result.valid).toBe(false);
  });

  it("constantTimeEqual compares strings securely", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
    expect(constantTimeEqual("", "")).toBe(true);
  });
});

describe("Main Site Course & Tier Mapping", () => {
  it("resolves configured main site product identifiers deterministically", async () => {
    await expect(resolveMainSiteCourseAccess({ productId: "main-ielts-standard" })).resolves.toEqual({
      ok: true,
      courseSlug: "ielts",
      accessTier: "STANDARD",
      productKey: "main-ielts-standard",
      label: "Main IELTS Book",
    });

    await expect(resolveMainSiteCourseAccess({ productId: "main-ielts-advanced" })).resolves.toEqual({
      ok: true,
      courseSlug: "ielts",
      accessTier: "ADVANCED",
      productKey: "main-ielts-advanced",
      label: "Main IELTS Advanced",
    });

    await expect(resolveMainSiteCourseAccess({ productId: "main-german-standard" })).resolves.toEqual({
      ok: true,
      courseSlug: "german",
      accessTier: "STANDARD",
      productKey: "main-german-standard",
      label: "Main German Book",
    });

    await expect(resolveMainSiteCourseAccess({ productId: "main-oet-advanced" })).resolves.toEqual({
      ok: true,
      courseSlug: "oet",
      accessTier: "ADVANCED",
      productKey: "main-oet-advanced",
      label: "Main OET Advanced",
    });

    await expect(resolveMainSiteCourseAccess({ productId: "main-pte-standard" })).resolves.toEqual({
      ok: true,
      courseSlug: "pte",
      accessTier: "STANDARD",
      productKey: "main-pte-standard",
      label: "Main PTE Book",
    });
  });

  it("resolves exact signed course-category event keys without fuzzy matching", async () => {
    await expect(resolveMainSiteCourseAccess({ courseKey: "ielts" })).resolves.toEqual({
      ok: true,
      courseSlug: "ielts",
      accessTier: "STANDARD",
      productKey: "ielts",
      label: "Main-site IELTS course event",
    });

    await expect(resolveMainSiteCourseAccess({ courseCategory: "OET" })).resolves.toEqual({
      ok: true,
      courseSlug: "oet",
      accessTier: "STANDARD",
      productKey: "oet",
      label: "Main-site OET course event",
    });

    await expect(resolveMainSiteCourseAccess({ courseSlug: "german" })).resolves.toEqual({
      ok: true,
      courseSlug: "german",
      accessTier: "STANDARD",
      productKey: "german",
      label: "Main-site German course event",
    });
  });

  it("does not trust arbitrary or fuzzy course categories", async () => {
    const res = await resolveMainSiteCourseAccess({ courseCategory: "ielts coaching book" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("Unmapped or unknown");
    }
  });

  it("rejects unmapped, unknown, inactive, or fuzzy product names", async () => {
    const res = await resolveMainSiteCourseAccess({ productId: "unregistered-course-xyz" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("Unmapped or unknown");
    }

    const inactive = await resolveMainSiteCourseAccess({ productId: "inactive-pte" });
    expect(inactive.ok).toBe(false);
    if (!inactive.ok) {
      expect(inactive.error).toContain("inactive");
    }
  });

  it("isolates courses: IELTS mapping never resolves to OET, PTE, or German", async () => {
    const res = await resolveMainSiteCourseAccess({ productId: "main-ielts-standard" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.courseSlug).toBe("ielts");
      expect(res.courseSlug).not.toBe("oet");
      expect(res.courseSlug).not.toBe("pte");
      expect(res.courseSlug).not.toBe("german");
    }
  });
});

describe("processMainSitePurchase business logic", () => {
  const secret = "test-secret-key-12345";
  const now = 1791054000000;

  function sign(body: string, timestamp: number | string) {
    const hmac = createHmac("sha256", secret);
    hmac.update(`${timestamp}${body}`);
    return hmac.digest("hex");
  }

  function signBase64(body: string, timestamp: number | string, key = secret) {
    const hmac = createHmac("sha256", key);
    hmac.update(`${timestamp}${body}`);
    return hmac.digest("base64");
  }

  function queueSuccessfulProvisioning(courseSlug = "ielts", existingUser = false) {
    mockDbState.selectQueue.push(
      [],
      [{ id: `course-${courseSlug}`, slug: courseSlug, name: courseSlug.toUpperCase(), isActive: true }],
      existingUser
        ? [
            {
              id: "user-existing",
              email: "student@example.com",
              fullName: "Existing Student",
              role: "student",
              accountStatus: "active",
            },
          ]
        : [],
    );

    if (!existingUser) {
      mockDbState.insertReturnQueue.push({
        id: "user-new",
        email: "student@example.com",
        fullName: "Student One",
      });
    }
  }

  it("accepts the exact Step 13B sender contract with base64 HMAC over timestamp + raw JSON bytes", async () => {
    const body = JSON.stringify({
      orderId: "order123",
      customerEmail: "Student@Example.COM",
      customerName: "Student One",
      courseSlug: "ielts",
      paymentStatus: "PAID",
    });
    const timestamp = String(now);
    queueSuccessfulProvisioning("ielts");

    const res = await processMainSitePurchase({
      rawBody: body,
      signature: signBase64(body, timestamp),
      timestamp,
      now: new Date(now),
    });

    expect(res).toMatchObject({
      success: true,
      orderId: "order123",
      externalReference: "main-site:order123:ielts:ielts:STANDARD",
      email: "student@example.com",
      courseSlug: "ielts",
      accessTier: "STANDARD",
      isNewStudent: true,
      emailSent: true,
    });
  });

  it("rejects the Step 13B contract when signed with the wrong secret", async () => {
    const body = JSON.stringify({
      orderId: "order123:ielts",
      customerEmail: "student@example.com",
      courseSlug: "ielts",
      paymentStatus: "PAID",
    });
    const timestamp = String(now);

    const res = await processMainSitePurchase({
      rawBody: body,
      signature: signBase64(body, timestamp, "wrong-secret"),
      timestamp,
      now: new Date(now),
    });

    expect(res).toEqual({ success: false, status: 401, error: "Invalid signature." });
  });

  it("rejects changed email, order ID, course, payment status, or raw body after signing", async () => {
    const original = JSON.stringify({
      orderId: "order123:ielts",
      customerEmail: "student@example.com",
      courseSlug: "ielts",
      paymentStatus: "PAID",
    });
    const timestamp = String(now);
    const signature = signBase64(original, timestamp);

    for (const changedBody of [
      JSON.stringify({
        orderId: "order123:ielts",
        customerEmail: "attacker@example.com",
        courseSlug: "ielts",
        paymentStatus: "PAID",
      }),
      JSON.stringify({
        orderId: "order999:ielts",
        customerEmail: "student@example.com",
        courseSlug: "ielts",
        paymentStatus: "PAID",
      }),
      JSON.stringify({
        orderId: "order123:ielts",
        customerEmail: "student@example.com",
        courseSlug: "oet",
        paymentStatus: "PAID",
      }),
      JSON.stringify({
        orderId: "order123:ielts",
        customerEmail: "student@example.com",
        courseSlug: "ielts",
        paymentStatus: "FAILED",
      }),
      `${original}\n`,
    ]) {
      const res = await processMainSitePurchase({
        rawBody: changedBody,
        signature,
        timestamp,
        now: new Date(now),
      });

      expect(res).toEqual({ success: false, status: 401, error: "Invalid signature." });
    }
  });

  it("provisions each supported course event with strict course isolation", async () => {
    for (const courseSlug of ["ielts", "oet", "pte", "german"] as const) {
      const body = JSON.stringify({
        orderId: `order-${courseSlug}`,
        customerEmail: "student@example.com",
        courseSlug,
        paymentStatus: "PAID",
      });
      const timestamp = String(now);
      queueSuccessfulProvisioning(courseSlug, true);

      const res = await processMainSitePurchase({
        rawBody: body,
        signature: signBase64(body, timestamp),
        timestamp,
        now: new Date(now),
      });

      expect(res).toMatchObject({
        success: true,
        externalReference: `main-site:order-${courseSlug}:${courseSlug}:${courseSlug}:STANDARD`,
        courseSlug,
        accessTier: "STANDARD",
        isNewStudent: false,
      });
    }
  });

  it("uses per-course idempotency for repeated and multi-course main-site events", async () => {
    const ieltsBody = JSON.stringify({
      orderId: "order123",
      customerEmail: "student@example.com",
      courseSlug: "ielts",
      paymentStatus: "PAID",
    });
    const oetBody = JSON.stringify({
      orderId: "order123",
      customerEmail: "student@example.com",
      courseSlug: "oet",
      paymentStatus: "PAID",
    });
    const timestamp = String(now);

    mockDbState.selectQueue.push([
      {
        id: "event-ielts",
        eventStatus: "PROCESSED",
        userId: "user-existing",
        customerEmail: "student@example.com",
        courseSlug: "ielts",
        accessTier: "STANDARD",
      },
    ]);
    const repeatedIelts = await processMainSitePurchase({
      rawBody: ieltsBody,
      signature: signBase64(ieltsBody, timestamp),
      timestamp,
      now: new Date(now),
    });

    queueSuccessfulProvisioning("oet", true);
    const firstOet = await processMainSitePurchase({
      rawBody: oetBody,
      signature: signBase64(oetBody, timestamp),
      timestamp,
      now: new Date(now),
    });

    expect(repeatedIelts).toMatchObject({
      success: true,
      idempotent: true,
      externalReference: "main-site:order123:ielts:ielts:STANDARD",
      courseSlug: "ielts",
    });
    expect(firstOet).toMatchObject({
      success: true,
      externalReference: "main-site:order123:oet:oet:STANDARD",
      courseSlug: "oet",
    });
  });

  it("rejects non-PAID purchases", async () => {
    const body = JSON.stringify({
      orderId: "ord_pending_1",
      customerEmail: "pending@example.com",
      courseSlug: "ielts",
      paymentStatus: "PENDING",
    });
    const timestamp = String(now);
    const signature = sign(body, timestamp);

    const res = await processMainSitePurchase({
      rawBody: body,
      signature,
      timestamp,
      now: new Date(now),
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.status).toBe(400);
      expect(res.error).toContain("Only PAID orders can be provisioned");
    }
  });

  it("rejects invalid email addresses", async () => {
    const body = JSON.stringify({
      orderId: "ord_bad_email",
      customerEmail: "invalid-email-address",
      courseSlug: "ielts",
      paymentStatus: "PAID",
    });
    const timestamp = String(now);
    const signature = sign(body, timestamp);

    const res = await processMainSitePurchase({
      rawBody: body,
      signature,
      timestamp,
      now: new Date(now),
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.status).toBe(400);
      expect(res.error).toContain("Invalid customer email address format");
    }
  });

  it("normalizes customer email with uppercase and leading/trailing spaces", async () => {
    const body = JSON.stringify({
      orderId: "ord_norm_1",
      customerEmail: "  STUDENT.TEST@AYLEM.COM  ",
      courseSlug: "ielts",
      paymentStatus: "PAID",
    });
    const timestamp = String(now);
    const signature = sign(body, timestamp);
    mockDbState.selectQueue.push(
      [],
      [{ id: "course-ielts", slug: "ielts", name: "IELTS", isActive: true }],
      [
        {
          id: "user-existing",
          email: "student.test@aylem.com",
          fullName: "Student Test",
          role: "student",
          accountStatus: "active",
        },
      ],
    );

    const res = await processMainSitePurchase({
      rawBody: body,
      signature,
      timestamp,
      now: new Date(now),
    });

    expect(res).toMatchObject({ success: true, email: "student.test@aylem.com" });
  });

  it("rejects when secret is not configured", async () => {
    const { getRuntimeEnvValue } = await import("@/lib/cloudflare/runtime");
    vi.mocked(getRuntimeEnvValue).mockResolvedValueOnce(undefined);
    const originalEnv = process.env.MAIN_SITE_INTEGRATION_SECRET;
    delete process.env.MAIN_SITE_INTEGRATION_SECRET;

    const body = JSON.stringify({ orderId: "1" });
    const res = await processMainSitePurchase({
      rawBody: body,
      signature: "sig",
      timestamp: String(now),
      now: new Date(now),
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.status).toBe(500);
      expect(res.error).toContain("secret is not configured");
    }

    if (originalEnv) {
      process.env.MAIN_SITE_INTEGRATION_SECRET = originalEnv;
    }
  });
});
