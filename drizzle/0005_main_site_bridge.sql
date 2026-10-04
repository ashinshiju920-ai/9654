ALTER TABLE "course_entitlements" DROP CONSTRAINT IF EXISTS "course_entitlements_source_check";
ALTER TABLE "course_entitlements" ADD CONSTRAINT "course_entitlements_source_check" CHECK (source IN ('CASHFREE', 'ADMIN', 'PROMOTION', 'IMPORT', 'MIGRATION', 'MAIN_SITE_PURCHASE'));

CREATE TABLE IF NOT EXISTS "main_site_purchase_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_order_id" text NOT NULL,
	"external_reference" text NOT NULL,
	"user_id" uuid,
	"customer_email" text NOT NULL,
	"course_id" uuid,
	"course_slug" text NOT NULL,
	"access_tier" text NOT NULL,
	"payment_status" text NOT NULL,
	"event_status" text NOT NULL,
	"failure_reason" text,
	"metadata" text,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "main_site_purchase_events_external_reference_unique" UNIQUE("external_reference"),
	CONSTRAINT "main_site_purchase_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null,
	CONSTRAINT "main_site_purchase_events_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE set null
);

CREATE INDEX IF NOT EXISTS "main_site_purchase_events_external_order_id_idx" ON "main_site_purchase_events" ("external_order_id");
CREATE INDEX IF NOT EXISTS "main_site_purchase_events_customer_email_idx" ON "main_site_purchase_events" ("customer_email");
CREATE INDEX IF NOT EXISTS "main_site_purchase_events_processed_at_idx" ON "main_site_purchase_events" ("processed_at");
