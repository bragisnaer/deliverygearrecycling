CREATE TABLE "tenant_branding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"logo_url" text,
	"favicon_url" text,
	"primary_color" text,
	"secondary_color" text,
	"background_color" text,
	"foreground_color" text,
	"accent_color" text,
	"heading_font" text,
	"body_font" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_branding_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
ALTER TABLE "tenant_branding" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "material_library" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "material_library_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "material_library" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "tenant_branding" ADD CONSTRAINT "tenant_branding_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tenant_branding_tenant_id_idx" ON "tenant_branding" USING btree ("tenant_id");--> statement-breakpoint
CREATE POLICY "tenant_branding_deny_all" ON "tenant_branding" AS RESTRICTIVE FOR ALL TO public USING (false);--> statement-breakpoint
CREATE POLICY "tenant_branding_reco_admin_all" ON "tenant_branding" AS PERMISSIVE FOR ALL TO "reco_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "tenant_branding_reco_read" ON "tenant_branding" AS PERMISSIVE FOR SELECT TO "reco_role" USING (true);--> statement-breakpoint
CREATE POLICY "tenant_branding_client_read" ON "tenant_branding" AS PERMISSIVE FOR SELECT TO "client_role" USING (tenant_id = current_setting('request.jwt.claim.tenant_id', true));--> statement-breakpoint
CREATE POLICY "material_library_deny_all" ON "material_library" AS RESTRICTIVE FOR ALL TO public USING (false);--> statement-breakpoint
CREATE POLICY "material_library_reco_admin_all" ON "material_library" AS PERMISSIVE FOR ALL TO "reco_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "material_library_authenticated_read" ON "material_library" AS PERMISSIVE FOR SELECT TO "client_role", "prison_role", "reco_role", "transport_role" USING (true);