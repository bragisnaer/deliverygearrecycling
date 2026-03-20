export type UserRole = "reco-admin" | "reco" | "client" | "client-global" | "transport" | "prison";

export const USER_ROLES: readonly UserRole[] = [
	"reco-admin",
	"reco",
	"client",
	"client-global",
	"transport",
	"prison",
] as const;
