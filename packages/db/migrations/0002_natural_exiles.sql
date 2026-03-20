CREATE TYPE "public"."processing_stream" AS ENUM('recycling', 'reuse');--> statement-breakpoint
CREATE TYPE "public"."recycling_outcome" AS ENUM('recycled', 'reprocessed', 'incinerated', 'landfill');--> statement-breakpoint
CREATE TABLE "product_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"material_library_id" uuid NOT NULL,
	"weight_grams" numeric(10, 2) NOT NULL,
	"recycling_cost_per_kg_eur" numeric(10, 4),
	"recycling_cost_per_kg_dkk" numeric(10, 4),
	"recycling_outcome" "recycling_outcome",
	"disassembly_photo_paths" text[],
	"effective_from" timestamp DEFAULT now() NOT NULL,
	"effective_to" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_materials" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product_pricing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"price_eur" numeric(10, 4),
	"price_dkk" numeric(10, 4),
	"effective_from" timestamp NOT NULL,
	"effective_to" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_pricing" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"product_code" text NOT NULL,
	"product_group" text,
	"processing_stream" "processing_stream" NOT NULL,
	"description" text,
	"weight_grams" numeric(10, 2),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_materials" ADD CONSTRAINT "product_materials_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_materials" ADD CONSTRAINT "product_materials_material_library_id_material_library_id_fk" FOREIGN KEY ("material_library_id") REFERENCES "public"."material_library"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_pricing" ADD CONSTRAINT "product_pricing_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_materials_product_id_idx" ON "product_materials" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_pricing_product_id_idx" ON "product_pricing" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "products_tenant_id_idx" ON "products" USING btree ("tenant_id");--> statement-breakpoint
CREATE POLICY "product_materials_deny_all" ON "product_materials" AS RESTRICTIVE FOR ALL TO public USING (false);--> statement-breakpoint
CREATE POLICY "product_materials_reco_admin_all" ON "product_materials" AS PERMISSIVE FOR ALL TO "reco_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "product_materials_reco_read" ON "product_materials" AS PERMISSIVE FOR SELECT TO "reco_role" USING (true);--> statement-breakpoint
CREATE POLICY "product_materials_client_read" ON "product_materials" AS PERMISSIVE FOR SELECT TO "client_role" USING (EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND p.tenant_id = current_setting('request.jwt.claim.tenant_id', true)));--> statement-breakpoint
CREATE POLICY "product_pricing_deny_all" ON "product_pricing" AS RESTRICTIVE FOR ALL TO public USING (false);--> statement-breakpoint
CREATE POLICY "product_pricing_reco_admin_all" ON "product_pricing" AS PERMISSIVE FOR ALL TO "reco_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "product_pricing_reco_read" ON "product_pricing" AS PERMISSIVE FOR SELECT TO "reco_role" USING (true);--> statement-breakpoint
CREATE POLICY "products_deny_all" ON "products" AS RESTRICTIVE FOR ALL TO public USING (false);--> statement-breakpoint
CREATE POLICY "products_reco_admin_all" ON "products" AS PERMISSIVE FOR ALL TO "reco_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "products_reco_read" ON "products" AS PERMISSIVE FOR SELECT TO "reco_role" USING (true);--> statement-breakpoint
CREATE POLICY "products_client_read" ON "products" AS PERMISSIVE FOR SELECT TO "client_role" USING (tenant_id = current_setting('request.jwt.claim.tenant_id', true));

-- Partial unique index: product_code unique per tenant (PROD-01)
CREATE UNIQUE INDEX IF NOT EXISTS products_code_tenant_uniq ON products (tenant_id, product_code);

-- Unique constraint on pricing: prevent duplicate effective_from per product (Pitfall 4)
CREATE UNIQUE INDEX IF NOT EXISTS product_pricing_product_effective_from_uniq ON product_pricing (product_id, effective_from);

-- Enable FORCE RLS on new tables (same as 0001 migration pattern)
ALTER TABLE material_library FORCE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;
ALTER TABLE product_materials FORCE ROW LEVEL SECURITY;
ALTER TABLE product_pricing FORCE ROW LEVEL SECURITY;