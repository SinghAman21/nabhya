import type { Role } from "@nabhya/shared";
import { SetMetadata } from "@nestjs/common";

export type RoleType = Role;

export const ROLES_KEY = "roles";

/**
 * Restricts a route to the listed roles (OR semantics - any match passes).
 * Enforced by RolesGuard, which runs after JwtGuard has populated request.user.
 */
export const Roles = (...roles: RoleType[]) => SetMetadata(ROLES_KEY, roles);
