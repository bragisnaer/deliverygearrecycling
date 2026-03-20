CREATE TYPE "public"."user_role" AS ENUM('reco-admin', 'reco', 'client', 'client-global', 'transport', 'prison');--> statement-breakpoint
CREATE ROLE "client_role";--> statement-breakpoint
CREATE ROLE "prison_role";--> statement-breakpoint
CREATE ROLE "reco_admin";--> statement-breakpoint
CREATE ROLE "reco_role";--> statement-breakpoint
CREATE ROLE "transport_role";--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_name" text NOT NULL,
	"record_id" text NOT NULL,
	"tenant_id" text,
	"action" text NOT NULL,
	"old_data" jsonb,
	"new_data" jsonb,
	"changed_by" text,
	"changed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"userId" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" timestamp,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"emailVerified" timestamp,
	"image" text,
	"role" "user_role" DEFAULT 'client' NOT NULL,
	"tenant_id" text,
	"location_id" uuid,
	"facility_id" uuid,
	"can_view_financials" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token"),
	CONSTRAINT "verification_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "prison_facilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"contact_email" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "prison_facilities_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "prison_facilities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"exchange_rate_eur_dkk" numeric(10, 4) DEFAULT '7.4600' NOT NULL,
	"warehouse_ageing_threshold_days" integer DEFAULT 14 NOT NULL,
	"discrepancy_alert_threshold_pct" integer DEFAULT 15 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "system_settings_single_row" CHECK ("system_settings"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "system_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_table_name_record_id_idx" ON "audit_log" USING btree ("table_name","record_id");--> statement-breakpoint
CREATE INDEX "audit_log_changed_at_idx" ON "audit_log" USING btree ("changed_at");--> statement-breakpoint
CREATE INDEX "users_tenant_id_idx" ON "users" USING btree ("tenant_id");--> statement-breakpoint
CREATE POLICY "users_deny_all" ON "users" AS RESTRICTIVE FOR ALL TO public USING (false);--> statement-breakpoint
CREATE POLICY "users_reco_admin_all" ON "users" AS PERMISSIVE FOR ALL TO "reco_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "users_reco_read" ON "users" AS PERMISSIVE FOR SELECT TO "reco_role" USING (true);--> statement-breakpoint
CREATE POLICY "users_client_read" ON "users" AS PERMISSIVE FOR SELECT TO "client_role" USING (tenant_id = current_setting('request.jwt.claim.tenant_id', true));--> statement-breakpoint
CREATE POLICY "users_prison_read" ON "users" AS PERMISSIVE FOR SELECT TO "prison_role" USING (facility_id::text = current_setting('request.jwt.claim.facility_id', true));--> statement-breakpoint
CREATE POLICY "prison_facilities_deny_all" ON "prison_facilities" AS RESTRICTIVE FOR ALL TO public USING (false);--> statement-breakpoint
CREATE POLICY "prison_facilities_reco_admin_all" ON "prison_facilities" AS PERMISSIVE FOR ALL TO "reco_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "prison_facilities_reco_read" ON "prison_facilities" AS PERMISSIVE FOR SELECT TO "reco_role" USING (true);--> statement-breakpoint
CREATE POLICY "prison_facilities_prison_read" ON "prison_facilities" AS PERMISSIVE FOR SELECT TO "prison_role" USING (id::text = current_setting('request.jwt.claim.facility_id', true));--> statement-breakpoint
CREATE POLICY "tenants_deny_all" ON "tenants" AS RESTRICTIVE FOR ALL TO public USING (false);--> statement-breakpoint
CREATE POLICY "tenants_reco_admin_all" ON "tenants" AS PERMISSIVE FOR ALL TO "reco_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "tenants_reco_read" ON "tenants" AS PERMISSIVE FOR SELECT TO "reco_role" USING (true);--> statement-breakpoint
CREATE POLICY "tenants_client_read" ON "tenants" AS PERMISSIVE FOR SELECT TO "client_role" USING (id = current_setting('request.jwt.claim.tenant_id', true));--> statement-breakpoint
CREATE POLICY "system_settings_deny_all" ON "system_settings" AS RESTRICTIVE FOR ALL TO public USING (false);--> statement-breakpoint
CREATE POLICY "system_settings_reco_admin_all" ON "system_settings" AS PERMISSIVE FOR ALL TO "reco_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "system_settings_reco_read" ON "system_settings" AS PERMISSIVE FOR SELECT TO "reco_role" USING (true);