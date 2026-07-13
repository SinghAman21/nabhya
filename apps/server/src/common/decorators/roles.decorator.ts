import { SetMetadata } from "@nestjs/common";

export type RoleType = "superadmin" | "volunteer" | "organisation";

export const ROLES_KEY = "roles";

export const Roles = (...roles: RoleType[]) => SetMetadata(ROLES_KEY, roles);
