import type { DefaultSession } from "next-auth";

export type UserRole = "reco-admin" | "reco" | "client" | "client-global" | "transport" | "prison";

export const USER_ROLES: readonly UserRole[] = [
	"reco-admin",
	"reco",
	"client",
	"client-global",
	"transport",
	"prison",
] as const;

declare module "next-auth" {
	interface Session {
		user: DefaultSession["user"] & {
			role: UserRole;
			tenant_id: string | null;
			location_id: string | null;
			facility_id: string | null;
		};
	}

	interface User {
		role: UserRole;
		tenant_id: string | null;
		location_id: string | null;
		facility_id: string | null;
		can_view_financials?: boolean;
	}
}

declare module "next-auth/jwt" {
	interface JWT {
		role: UserRole;
		tenant_id: string | null;
		location_id: string | null;
		facility_id: string | null;
	}
}
