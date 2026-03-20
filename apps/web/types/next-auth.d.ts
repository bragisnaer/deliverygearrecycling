import type { DefaultSession } from "next-auth";
import type { UserRole } from "@repo/types";

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
