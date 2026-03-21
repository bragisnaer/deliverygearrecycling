CREATE TABLE "batch_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_lot_number" text NOT NULL,
	"reason" text NOT NULL,
	"flagged_by" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "batch_flags_batch_lot_number_unique" UNIQUE("batch_lot_number")
);
--> statement-breakpoint
ALTER TABLE "batch_flags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "intake_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"intake_record_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"informed_quantity" integer,
	"actual_quantity" integer NOT NULL,
	"batch_lot_number" text,
	"discrepancy_pct" numeric(8, 2),
	"quarantine_flagged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "intake_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "intake_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prison_facility_id" uuid NOT NULL,
	"pickup_id" uuid,
	"outbound_shipment_id" uuid,
	"tenant_id" text NOT NULL,
	"staff_name" text NOT NULL,
	"delivery_date" timestamp NOT NULL,
	"origin_market" text,
	"is_unexpected" boolean DEFAULT false NOT NULL,
	"discrepancy_flagged" boolean DEFAULT false NOT NULL,
	"quarantine_flagged" boolean DEFAULT false NOT NULL,
	"quarantine_overridden" boolean DEFAULT false NOT NULL,
	"quarantine_override_reason" text,
	"quarantine_overridden_by" uuid,
	"quarantine_overridden_at" timestamp,
	"notes" text,
	"reference" text DEFAULT '' NOT NULL,
	"delivered_at" timestamp DEFAULT now() NOT NULL,
	"submitted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "intake_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "batch_flags" ADD CONSTRAINT "batch_flags_flagged_by_users_id_fk" FOREIGN KEY ("flagged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_lines" ADD CONSTRAINT "intake_lines_intake_record_id_intake_records_id_fk" FOREIGN KEY ("intake_record_id") REFERENCES "public"."intake_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_lines" ADD CONSTRAINT "intake_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_records" ADD CONSTRAINT "intake_records_prison_facility_id_prison_facilities_id_fk" FOREIGN KEY ("prison_facility_id") REFERENCES "public"."prison_facilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_records" ADD CONSTRAINT "intake_records_pickup_id_pickups_id_fk" FOREIGN KEY ("pickup_id") REFERENCES "public"."pickups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_records" ADD CONSTRAINT "intake_records_outbound_shipment_id_outbound_shipments_id_fk" FOREIGN KEY ("outbound_shipment_id") REFERENCES "public"."outbound_shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_records" ADD CONSTRAINT "intake_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_records" ADD CONSTRAINT "intake_records_quarantine_overridden_by_users_id_fk" FOREIGN KEY ("quarantine_overridden_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_records" ADD CONSTRAINT "intake_records_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "intake_lines_intake_record_id_idx" ON "intake_lines" USING btree ("intake_record_id");--> statement-breakpoint
CREATE INDEX "intake_records_tenant_id_idx" ON "intake_records" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "intake_records_prison_facility_id_idx" ON "intake_records" USING btree ("prison_facility_id");--> statement-breakpoint
CREATE POLICY "batch_flags_prison_select" ON "batch_flags" AS PERMISSIVE FOR SELECT TO "prison_role" USING (true);--> statement-breakpoint
CREATE POLICY "batch_flags_reco_read" ON "batch_flags" AS PERMISSIVE FOR SELECT TO "reco_role" USING (true);--> statement-breakpoint
CREATE POLICY "batch_flags_reco_admin_all" ON "batch_flags" AS PERMISSIVE FOR ALL TO "reco_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "intake_lines_deny_all" ON "intake_lines" AS RESTRICTIVE FOR ALL TO public USING (false);--> statement-breakpoint
CREATE POLICY "intake_lines_prison_select" ON "intake_lines" AS PERMISSIVE FOR SELECT TO "prison_role" USING (EXISTS (
        SELECT 1 FROM intake_records ir
        WHERE ir.id = intake_lines.intake_record_id
          AND ir.prison_facility_id::text = current_setting('request.jwt.claim.facility_id', true)
      ));--> statement-breakpoint
CREATE POLICY "intake_lines_prison_insert" ON "intake_lines" AS PERMISSIVE FOR INSERT TO "prison_role" WITH CHECK (EXISTS (
        SELECT 1 FROM intake_records ir
        WHERE ir.id = intake_lines.intake_record_id
          AND ir.prison_facility_id::text = current_setting('request.jwt.claim.facility_id', true)
      ));--> statement-breakpoint
CREATE POLICY "intake_lines_reco_read" ON "intake_lines" AS PERMISSIVE FOR SELECT TO "reco_role" USING (true);--> statement-breakpoint
CREATE POLICY "intake_lines_reco_admin_all" ON "intake_lines" AS PERMISSIVE FOR ALL TO "reco_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "intake_records_deny_all" ON "intake_records" AS RESTRICTIVE FOR ALL TO public USING (false);--> statement-breakpoint
CREATE POLICY "intake_records_prison_select" ON "intake_records" AS PERMISSIVE FOR SELECT TO "prison_role" USING (prison_facility_id::text = current_setting('request.jwt.claim.facility_id', true));--> statement-breakpoint
CREATE POLICY "intake_records_prison_insert" ON "intake_records" AS PERMISSIVE FOR INSERT TO "prison_role" WITH CHECK (prison_facility_id::text = current_setting('request.jwt.claim.facility_id', true));--> statement-breakpoint
CREATE POLICY "intake_records_client_select" ON "intake_records" AS PERMISSIVE FOR SELECT TO "client_role" USING (tenant_id = current_setting('request.jwt.claim.tenant_id', true));--> statement-breakpoint
CREATE POLICY "intake_records_reco_read" ON "intake_records" AS PERMISSIVE FOR SELECT TO "reco_role" USING (true);--> statement-breakpoint
CREATE POLICY "intake_records_reco_admin_all" ON "intake_records" AS PERMISSIVE FOR ALL TO "reco_admin" USING (true) WITH CHECK (true);