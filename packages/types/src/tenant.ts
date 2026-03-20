export type DomainContext = "ops" | "client" | "public";

export interface TenantContext {
	context: DomainContext;
	tenantSlug: string | null;
}
