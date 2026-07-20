import { z } from "zod";

/**
 * Canonical role vocabulary for the whole platform.
 *
 * These strings are the `roles.name` values seeded in the database and the
 * values carried on `request.user.roles` — client and server must not invent
 * their own spellings. The Expo route group is still named `(ngo)` for URL
 * readability, but the role itself is always `organisation`.
 */
export const roleSchema = z.enum(["superadmin", "volunteer", "organisation"]);

export type Role = z.infer<typeof roleSchema>;

export const ROLES = roleSchema.options;

/** Roles a user is allowed to self-assign at signup. */
export const selectableRoleSchema = z.enum(["volunteer", "organisation"]);

export type SelectableRole = z.infer<typeof selectableRoleSchema>;

export const selectRoleSchema = z.object({
	role: selectableRoleSchema,
});

export type SelectRoleInput = z.infer<typeof selectRoleSchema>;
