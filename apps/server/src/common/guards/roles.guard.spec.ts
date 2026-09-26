import type { ExecutionContext } from "@nestjs/common";
import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { beforeEach, describe, expect, it } from "vitest";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { ROLES_KEY, type RoleType } from "../decorators/roles.decorator";
import type { AuthUser } from "../types";
import { RolesGuard } from "./roles.guard";

/**
 * The authorization boundary for every route in the app.
 *
 * A regression here does not fail loudly - it silently grants access - so
 * these cases matter more than their size suggests.
 */
function contextFor(user: AuthUser | undefined): ExecutionContext {
	return {
		switchToHttp: () => ({ getRequest: () => ({ user }) }),
		getHandler: () => () => undefined,
		getClass: () => class {},
	} as unknown as ExecutionContext;
}

function guardWith(metadata: {
	roles?: RoleType[];
	isPublic?: boolean;
}): RolesGuard {
	const reflector = new Reflector();
	// getAllAndOverride reads handler then class; stubbing it directly keeps the
	// test about the guard's decision rather than Nest's metadata plumbing.
	reflector.getAllAndOverride = ((key: string) => {
		if (key === IS_PUBLIC_KEY) return metadata.isPublic;
		if (key === ROLES_KEY) return metadata.roles;
		return undefined;
	}) as unknown as Reflector["getAllAndOverride"];

	return new RolesGuard(reflector);
}

const volunteer: AuthUser = {
	id: "u1",
	email: "v@example.com",
	role: "volunteer",
	roles: ["volunteer"],
	name: "Volunteer",
};

describe("RolesGuard", () => {
	let guard: RolesGuard;

	beforeEach(() => {
		guard = guardWith({ roles: ["organisation"] });
	});

	it("allows a public route through without any user", () => {
		const open = guardWith({ isPublic: true, roles: ["superadmin"] });
		expect(open.canActivate(contextFor(undefined))).toBe(true);
	});

	it("allows a route with no @Roles requirement", () => {
		const unrestricted = guardWith({});
		expect(unrestricted.canActivate(contextFor(volunteer))).toBe(true);
	});

	it("allows a caller holding the required role", () => {
		const organisation: AuthUser = {
			...volunteer,
			role: "organisation",
			roles: ["organisation"],
		};
		expect(guard.canActivate(contextFor(organisation))).toBe(true);
	});

	it("refuses a caller with the wrong role", () => {
		expect(() => guard.canActivate(contextFor(volunteer))).toThrow(
			ForbiddenException,
		);
	});

	it("refuses a caller who has chosen no role yet", () => {
		// Roles stay empty until role-select, so this is the state a brand new
		// account is in - it must not reach a role-gated route.
		const roleless: AuthUser = { ...volunteer, role: null, roles: [] };
		expect(() => guard.canActivate(contextFor(roleless))).toThrow(
			ForbiddenException,
		);
	});

	it("refuses when there is no user at all on a protected route", () => {
		expect(() => guard.canActivate(contextFor(undefined))).toThrow(
			ForbiddenException,
		);
	});

	it("uses OR semantics across several accepted roles", () => {
		const either = guardWith({ roles: ["organisation", "superadmin"] });
		const admin: AuthUser = {
			...volunteer,
			role: "superadmin",
			roles: ["superadmin"],
		};
		expect(either.canActivate(contextFor(admin))).toBe(true);
		expect(() => either.canActivate(contextFor(volunteer))).toThrow(
			ForbiddenException,
		);
	});

	it("matches when the caller holds several roles, one of which fits", () => {
		const multi: AuthUser = {
			...volunteer,
			roles: ["volunteer", "organisation"],
		};
		expect(guard.canActivate(contextFor(multi))).toBe(true);
	});

	it("explains what was required, so the client can act on the 403", () => {
		try {
			guard.canActivate(contextFor(volunteer));
			throw new Error("should have thrown");
		} catch (error) {
			expect((error as ForbiddenException).message).toContain("organisation");
		}
	});
});
