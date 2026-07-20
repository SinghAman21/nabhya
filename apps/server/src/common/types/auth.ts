import type { Role } from "@nabhya/shared";

/**
 * Canonical role vocabulary lives in @nabhya/shared so the client, the guards
 * and the seeded `roles` table can never drift apart.
 */
export type UserRole = Role;

/** Shape attached to `request.user` by JwtGuard. */
export interface AuthUser {
	id: string;
	email: string;
	/**
	 * Primary role — first assigned, or null before the user has chosen one.
	 * Prefer `roles` for authorization checks.
	 */
	role: UserRole | null;
	roles: UserRole[];
	name: string | null;
}

export interface NeonJwtPayload {
	sub: string;
	email: string;
	name?: string;
	iat?: number;
	exp?: number;
}
