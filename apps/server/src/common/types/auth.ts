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

export interface SupabaseJwtPayload {
	sub: string;
	email: string;
	/** Custom claims set at signup (`options.data`) land here, not top-level. */
	user_metadata?: {
		name?: string;
		full_name?: string;
	};
	iat?: number;
	exp?: number;
}
