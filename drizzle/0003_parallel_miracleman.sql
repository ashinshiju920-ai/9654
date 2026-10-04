CREATE TABLE "course_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"access_tier" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"source" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"external_reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_entitlements_external_reference_unique" UNIQUE("source","external_reference","user_id","course_id","access_tier"),
	CONSTRAINT "course_entitlements_access_tier_check" CHECK ("course_entitlements"."access_tier" in ('STANDARD', 'ADVANCED')),
	CONSTRAINT "course_entitlements_status_check" CHECK ("course_entitlements"."status" in ('ACTIVE', 'REVOKED', 'EXPIRED')),
	CONSTRAINT "course_entitlements_source_check" CHECK ("course_entitlements"."source" in ('CASHFREE', 'ADMIN', 'PROMOTION', 'IMPORT', 'MIGRATION'))
);
--> statement-breakpoint
ALTER TABLE "course_entitlements" ADD CONSTRAINT "course_entitlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_entitlements" ADD CONSTRAINT "course_entitlements_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "course_entitlements_user_course_tier_status_idx" ON "course_entitlements" USING btree ("user_id","course_id","access_tier","status");--> statement-breakpoint
CREATE INDEX "course_entitlements_course_status_idx" ON "course_entitlements" USING btree ("course_id","status");--> statement-breakpoint
CREATE INDEX "course_entitlements_external_reference_idx" ON "course_entitlements" USING btree ("source","external_reference");