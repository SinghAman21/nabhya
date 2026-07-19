export type UserRole = "superadmin" | "volunteer" | "organisation";

export interface NeonJwtPayload {
	sub: string;
	email: string;
	name?: string;
	iat?: number;
	exp?: number;
}
