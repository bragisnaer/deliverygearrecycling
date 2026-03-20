CREATE TYPE "public"."pickup_status" AS ENUM('submitted', 'confirmed', 'transport_booked', 'picked_up', 'at_warehouse', 'in_outbound_shipment', 'in_transit', 'delivered', 'intake_registered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."outbound_shipment_status" AS ENUM('created', 'in_transit', 'delivered');--> statement-breakpoint
CREATE TYPE "public"."transport_type" AS ENUM('direct', 'consolidation');--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"country" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "locations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pickup_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pickup_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pickup_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pickups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"location_id" uuid NOT NULL,
	"reference" text DEFAULT '' NOT NULL,
	"status" "pickup_status" DEFAULT 'submitted' NOT NULL,
	"pallet_count" integer NOT NULL,
	"pallet_dimensions" text,
	"estimated_weight_grams" numeric(12, 2),
	"preferred_date" timestamp NOT NULL,
	"confirmed_date" timestamp,
	"notes" text,
	"cancellation_reason" text,
	"cancelled_at" timestamp,
	"cancelled_by" uuid,
	"submitted_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pickups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "outbound_shipment_pickups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outbound_shipment_id" uuid NOT NULL,
	"pickup_id" uuid NOT NULL,
	"pallet_count" integer NOT NULL,
	"allocated_cost_eur" numeric(12, 4)
);
--> statement-breakpoint
ALTER TABLE "outbound_shipment_pickups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "outbound_shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transport_provider_id" uuid NOT NULL,
	"prison_facility_id" uuid NOT NULL,
	"transport_cost_warehouse_to_prison_eur" numeric(12, 4) NOT NULL,
	"total_pallet_count" integer NOT NULL,
	"status" "outbound_shipment_status" DEFAULT 'created' NOT NULL,
	"dispatched_at" timestamp,
	"delivered_at" timestamp,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "outbound_shipments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "transport_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pickup_id" uuid NOT NULL,
	"transport_provider_id" uuid NOT NULL,
	"transport_type" "transport_type" NOT NULL,
	"prison_facility_id" uuid,
	"transport_cost_market_to_destination_eur" numeric(12, 4),
	"confirmed_pickup_date" timestamp,
	"delivery_notes" text,
	"proof_of_delivery_path" text,
	"booked_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transport_bookings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "transport_provider_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transport_provider_id" uuid NOT NULL,
	"tenant_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transport_provider_clients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "transport_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"contact_email" text,
	"contact_phone" text,
	"service_regions" text,
	"provider_type" "transport_type" NOT NULL,
	"warehouse_address" text,
	"has_platform_access" boolean DEFAULT false NOT NULL,
	"user_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transport_providers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"tenant_id" text,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"entity_type" text,
	"entity_id" text,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickup_lines" ADD CONSTRAINT "pickup_lines_pickup_id_pickups_id_fk" FOREIGN KEY ("pickup_id") REFERENCES "public"."pickups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickup_lines" ADD CONSTRAINT "pickup_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickups" ADD CONSTRAINT "pickups_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickups" ADD CONSTRAINT "pickups_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickups" ADD CONSTRAINT "pickups_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickups" ADD CONSTRAINT "pickups_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_shipment_pickups" ADD CONSTRAINT "outbound_shipment_pickups_outbound_shipment_id_outbound_shipments_id_fk" FOREIGN KEY ("outbound_shipment_id") REFERENCES "public"."outbound_shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_shipment_pickups" ADD CONSTRAINT "outbound_shipment_pickups_pickup_id_pickups_id_fk" FOREIGN KEY ("pickup_id") REFERENCES "public"."pickups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_shipments" ADD CONSTRAINT "outbound_shipments_transport_provider_id_transport_providers_id_fk" FOREIGN KEY ("transport_provider_id") REFERENCES "public"."transport_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_shipments" ADD CONSTRAINT "outbound_shipments_prison_facility_id_prison_facilities_id_fk" FOREIGN KEY ("prison_facility_id") REFERENCES "public"."prison_facilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_shipments" ADD CONSTRAINT "outbound_shipments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_bookings" ADD CONSTRAINT "transport_bookings_pickup_id_pickups_id_fk" FOREIGN KEY ("pickup_id") REFERENCES "public"."pickups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_bookings" ADD CONSTRAINT "transport_bookings_transport_provider_id_transport_providers_id_fk" FOREIGN KEY ("transport_provider_id") REFERENCES "public"."transport_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_bookings" ADD CONSTRAINT "transport_bookings_prison_facility_id_prison_facilities_id_fk" FOREIGN KEY ("prison_facility_id") REFERENCES "public"."prison_facilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_bookings" ADD CONSTRAINT "transport_bookings_booked_by_users_id_fk" FOREIGN KEY ("booked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_provider_clients" ADD CONSTRAINT "transport_provider_clients_transport_provider_id_transport_providers_id_fk" FOREIGN KEY ("transport_provider_id") REFERENCES "public"."transport_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_provider_clients" ADD CONSTRAINT "transport_provider_clients_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_providers" ADD CONSTRAINT "transport_providers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "locations_tenant_id_idx" ON "locations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "pickup_lines_pickup_id_idx" ON "pickup_lines" USING btree ("pickup_id");--> statement-breakpoint
CREATE INDEX "pickups_tenant_id_idx" ON "pickups" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "pickups_status_idx" ON "pickups" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pickups_location_id_idx" ON "pickups" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "outbound_shipment_pickups_shipment_id_idx" ON "outbound_shipment_pickups" USING btree ("outbound_shipment_id");--> statement-breakpoint
CREATE INDEX "transport_bookings_pickup_id_idx" ON "transport_bookings" USING btree ("pickup_id");--> statement-breakpoint
CREATE INDEX "transport_provider_clients_provider_id_idx" ON "transport_provider_clients" USING btree ("transport_provider_id");--> statement-breakpoint
CREATE INDEX "transport_provider_clients_tenant_id_idx" ON "transport_provider_clients" USING btree ("tenant_id");--> statement-breakpoint
CREATE POLICY "locations_deny_all" ON "locations" AS RESTRICTIVE FOR ALL TO public USING (false);--> statement-breakpoint
CREATE POLICY "locations_reco_admin_all" ON "locations" AS PERMISSIVE FOR ALL TO "reco_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "locations_reco_read" ON "locations" AS PERMISSIVE FOR SELECT TO "reco_role" USING (true);--> statement-breakpoint
CREATE POLICY "locations_client_read" ON "locations" AS PERMISSIVE FOR SELECT TO "client_role" USING (tenant_id = current_setting('request.jwt.claim.tenant_id', true));--> statement-breakpoint
CREATE POLICY "pickup_lines_deny_all" ON "pickup_lines" AS RESTRICTIVE FOR ALL TO public USING (false);--> statement-breakpoint
CREATE POLICY "pickup_lines_reco_admin_all" ON "pickup_lines" AS PERMISSIVE FOR ALL TO "reco_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "pickup_lines_reco_read" ON "pickup_lines" AS PERMISSIVE FOR SELECT TO "reco_role" USING (true);--> statement-breakpoint
CREATE POLICY "pickup_lines_client_read" ON "pickup_lines" AS PERMISSIVE FOR SELECT TO "client_role" USING (EXISTS (SELECT 1 FROM pickups p WHERE p.id = pickup_id AND p.tenant_id = current_setting('request.jwt.claim.tenant_id', true)));--> statement-breakpoint
CREATE POLICY "pickup_lines_client_insert" ON "pickup_lines" AS PERMISSIVE FOR INSERT TO "client_role" WITH CHECK (EXISTS (SELECT 1 FROM pickups p WHERE p.id = pickup_id AND p.tenant_id = current_setting('request.jwt.claim.tenant_id', true)));--> statement-breakpoint
CREATE POLICY "pickups_deny_all" ON "pickups" AS RESTRICTIVE FOR ALL TO public USING (false);--> statement-breakpoint
CREATE POLICY "pickups_reco_admin_all" ON "pickups" AS PERMISSIVE FOR ALL TO "reco_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "pickups_reco_read" ON "pickups" AS PERMISSIVE FOR SELECT TO "reco_role" USING (true);--> statement-breakpoint
CREATE POLICY "pickups_client_read_insert" ON "pickups" AS PERMISSIVE FOR SELECT TO "client_role" USING (tenant_id = current_setting('request.jwt.claim.tenant_id', true));--> statement-breakpoint
CREATE POLICY "pickups_client_insert" ON "pickups" AS PERMISSIVE FOR INSERT TO "client_role" WITH CHECK (tenant_id = current_setting('request.jwt.claim.tenant_id', true));--> statement-breakpoint
CREATE POLICY "pickups_transport_read" ON "pickups" AS PERMISSIVE FOR SELECT TO "transport_role" USING (EXISTS (
        SELECT 1
        FROM transport_provider_clients tpc
        JOIN transport_providers tp ON tp.id = tpc.transport_provider_id
        WHERE tpc.tenant_id = pickups.tenant_id
          AND tp.user_id::text = current_setting('request.jwt.claim.sub', true)
      ));--> statement-breakpoint
CREATE POLICY "outbound_shipment_pickups_deny_all" ON "outbound_shipment_pickups" AS RESTRICTIVE FOR ALL TO public USING (false);--> statement-breakpoint
CREATE POLICY "outbound_shipment_pickups_reco_admin_all" ON "outbound_shipment_pickups" AS PERMISSIVE FOR ALL TO "reco_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "outbound_shipment_pickups_reco_read" ON "outbound_shipment_pickups" AS PERMISSIVE FOR SELECT TO "reco_role" USING (true);--> statement-breakpoint
CREATE POLICY "outbound_shipment_pickups_transport_read" ON "outbound_shipment_pickups" AS PERMISSIVE FOR SELECT TO "transport_role" USING (EXISTS (
        SELECT 1
        FROM outbound_shipments os
        JOIN transport_providers tp ON tp.id = os.transport_provider_id
        WHERE os.id = outbound_shipment_id
          AND tp.user_id::text = current_setting('request.jwt.claim.sub', true)
      ));--> statement-breakpoint
CREATE POLICY "outbound_shipments_deny_all" ON "outbound_shipments" AS RESTRICTIVE FOR ALL TO public USING (false);--> statement-breakpoint
CREATE POLICY "outbound_shipments_reco_admin_all" ON "outbound_shipments" AS PERMISSIVE FOR ALL TO "reco_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "outbound_shipments_reco_read" ON "outbound_shipments" AS PERMISSIVE FOR SELECT TO "reco_role" USING (true);--> statement-breakpoint
CREATE POLICY "outbound_shipments_transport_read" ON "outbound_shipments" AS PERMISSIVE FOR SELECT TO "transport_role" USING (EXISTS (
        SELECT 1
        FROM transport_providers tp
        WHERE tp.id = outbound_shipments.transport_provider_id
          AND tp.user_id::text = current_setting('request.jwt.claim.sub', true)
      ));--> statement-breakpoint
CREATE POLICY "outbound_shipments_transport_update" ON "outbound_shipments" AS PERMISSIVE FOR UPDATE TO "transport_role" USING (EXISTS (
        SELECT 1
        FROM transport_providers tp
        WHERE tp.id = outbound_shipments.transport_provider_id
          AND tp.user_id::text = current_setting('request.jwt.claim.sub', true)
      )) WITH CHECK (EXISTS (
        SELECT 1
        FROM transport_providers tp
        WHERE tp.id = outbound_shipments.transport_provider_id
          AND tp.user_id::text = current_setting('request.jwt.claim.sub', true)
      ));--> statement-breakpoint
CREATE POLICY "transport_bookings_deny_all" ON "transport_bookings" AS RESTRICTIVE FOR ALL TO public USING (false);--> statement-breakpoint
CREATE POLICY "transport_bookings_reco_admin_all" ON "transport_bookings" AS PERMISSIVE FOR ALL TO "reco_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "transport_bookings_reco_read" ON "transport_bookings" AS PERMISSIVE FOR SELECT TO "reco_role" USING (true);--> statement-breakpoint
CREATE POLICY "transport_bookings_transport_read" ON "transport_bookings" AS PERMISSIVE FOR SELECT TO "transport_role" USING (EXISTS (
        SELECT 1
        FROM transport_provider_clients tpc
        JOIN transport_providers tp ON tp.id = tpc.transport_provider_id
        WHERE tpc.transport_provider_id = transport_bookings.transport_provider_id
          AND tp.user_id::text = current_setting('request.jwt.claim.sub', true)
      ));--> statement-breakpoint
CREATE POLICY "transport_bookings_transport_update" ON "transport_bookings" AS PERMISSIVE FOR UPDATE TO "transport_role" USING (EXISTS (
        SELECT 1
        FROM transport_provider_clients tpc
        JOIN transport_providers tp ON tp.id = tpc.transport_provider_id
        WHERE tpc.transport_provider_id = transport_bookings.transport_provider_id
          AND tp.user_id::text = current_setting('request.jwt.claim.sub', true)
      )) WITH CHECK (EXISTS (
        SELECT 1
        FROM transport_provider_clients tpc
        JOIN transport_providers tp ON tp.id = tpc.transport_provider_id
        WHERE tpc.transport_provider_id = transport_bookings.transport_provider_id
          AND tp.user_id::text = current_setting('request.jwt.claim.sub', true)
      ));--> statement-breakpoint
CREATE POLICY "transport_provider_clients_deny_all" ON "transport_provider_clients" AS RESTRICTIVE FOR ALL TO public USING (false);--> statement-breakpoint
CREATE POLICY "transport_provider_clients_reco_admin_all" ON "transport_provider_clients" AS PERMISSIVE FOR ALL TO "reco_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "transport_provider_clients_transport_read" ON "transport_provider_clients" AS PERMISSIVE FOR SELECT TO "transport_role" USING (EXISTS (
        SELECT 1
        FROM transport_providers tp
        WHERE tp.id = transport_provider_id
          AND tp.user_id::text = current_setting('request.jwt.claim.sub', true)
      ));--> statement-breakpoint
CREATE POLICY "transport_providers_deny_all" ON "transport_providers" AS RESTRICTIVE FOR ALL TO public USING (false);--> statement-breakpoint
CREATE POLICY "transport_providers_reco_admin_all" ON "transport_providers" AS PERMISSIVE FOR ALL TO "reco_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "transport_providers_reco_read" ON "transport_providers" AS PERMISSIVE FOR SELECT TO "reco_role" USING (true);--> statement-breakpoint
CREATE POLICY "transport_providers_transport_read" ON "transport_providers" AS PERMISSIVE FOR SELECT TO "transport_role" USING (user_id::text = current_setting('request.jwt.claim.sub', true));--> statement-breakpoint
CREATE POLICY "notifications_deny_all" ON "notifications" AS RESTRICTIVE FOR ALL TO public USING (false);--> statement-breakpoint
CREATE POLICY "notifications_reco_admin_read_write" ON "notifications" AS PERMISSIVE FOR SELECT TO "reco_admin" USING (true);--> statement-breakpoint
CREATE POLICY "notifications_reco_admin_insert" ON "notifications" AS PERMISSIVE FOR INSERT TO "reco_admin" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "notifications_reco_admin_update" ON "notifications" AS PERMISSIVE FOR UPDATE TO "reco_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "notifications_transport_read" ON "notifications" AS PERMISSIVE FOR SELECT TO "transport_role" USING (user_id::text = current_setting('request.jwt.claim.sub', true));