import { userRoles, users } from "@nabhya/db/schema";
import type { ExecutionContext } from "@nestjs/common";
import {
	ServiceUnavailableException,
	UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { eq } from "drizzle-orm";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { IS_OPTIONAL_AUTH_KEY } from "../src/common/decorators/optional-auth.decorator";
import { IS_PUBLIC_KEY } from "../src/common/decorators/public.decorator";
import { seedRoles } from "./factories";
import { createTestDb, type TestDb, truncateAll } from "./harness";

/**
 * The whole authentication story, against the real guard.
 *
 * Only the JWKS *fetch* is replaced — signing and verification are genuine
 * ES256 through jose, so a change that weakens signature checking fails here
 * rather than in production. `createRemoteJWKSet` is the one piece that would
 * otherwise reach Supabase over the network; everything downstream of it is
 * the real code path a request takes.
 */

const keys = await (async () => {
	const { generateKeyPair } = await import("jose");
	return {
		supabase: await generateKeyPair("ES256"),
		impostor: await generateKeyPair("ES256"),
	};
})();

vi.mock("jose", async (importOriginal) => {
	const actual = await importOriginal<typeof import("jose")>();
	return {
		...actual,
		// jose calls the returned function with (protectedHeader, token) and
		// expects a verification key back.
		createRemoteJWKSet: () => async () => keys.supabase.publicKey,
	};
});

// Imported after the mock so the guard's JWKS property picks up the stub.
const { JwtGuard } = await import("../src/common/guards/jwt.guard");

/** Signs a token the way Supabase Auth does. */
async function signToken(
	claims: Record<string, unknown>,
	options: { key?: unknown; expiresIn?: string } = {},
) {
	const { SignJWT } = await import("jose");
	return new SignJWT(claims)
		.setProtectedHeader({ alg: "ES256" })
		.setIssuedAt()
		.setExpirationTime(options.expiresIn ?? "1h")
		.sign((options.key ?? keys.supabase.privateKey) as never);
}

type RouteMetadata = { public?: boolean; optionalAuth?: boolean };

/**
 * A context the guard's own Reflector can read real metadata from, so the
 * @Public / @OptionalAuth branches are exercised the way Nest exercises them.
 */
function contextFor(
	headers: Record<string, string>,
	metadata: RouteMetadata = {},
) {
	const request: { headers: Record<string, string>; user?: unknown } = {
		headers,
	};
	const handler = () => undefined;
	if (metadata.public) Reflect.defineMetadata(IS_PUBLIC_KEY, true, handler);
	if (metadata.optionalAuth) {
		Reflect.defineMetadata(IS_OPTIONAL_AUTH_KEY, true, handler);
	}

	return {
		request,
		context: {
			switchToHttp: () => ({ getRequest: () => request }),
			getHandler: () => handler,
			getClass: () => class Anonymous {},
		} as unknown as ExecutionContext,
	};
}

describe("JwtGuard — authentication flow", () => {
	let db: TestDb;
	let close: () => Promise<void>;
	let guard: InstanceType<typeof JwtGuard>;

	beforeAll(async () => {
		({ db, close } = await createTestDb());
		guard = new JwtGuard(new Reflector(), db as never);
	});

	afterAll(async () => {
		await close();
	});

	beforeEach(async () => {
		await truncateAll(db);
		await seedRoles(db);
	});

	describe("rejects", () => {
		it("a request with no Authorization header", async () => {
			const { context } = contextFor({});
			await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
				UnauthorizedException,
			);
		});

		it("a scheme other than Bearer", async () => {
			const token = await signToken({ sub: "a", email: "a@example.com" });
			const { context } = contextFor({ authorization: `Basic ${token}` });
			await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
				UnauthorizedException,
			);
		});

		it("a Bearer header carrying no token", async () => {
			const { context } = contextFor({ authorization: "Bearer" });
			await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
				UnauthorizedException,
			);
		});

		it("a token signed by someone else", async () => {
			// The signature check is the entire security boundary: a token minted
			// with any other key must never resolve to a user, nor create one.
			const token = await signToken(
				{ sub: "impostor", email: "evil@example.com" },
				{ key: keys.impostor.privateKey },
			);
			const { context } = contextFor({ authorization: `Bearer ${token}` });

			await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
				UnauthorizedException,
			);
			expect(await db.query.users.findMany()).toHaveLength(0);
		});

		it("an expired token", async () => {
			const token = await signToken(
				{ sub: "s", email: "s@example.com" },
				{ expiresIn: "-1h" },
			);
			const { context } = contextFor({ authorization: `Bearer ${token}` });
			await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
				UnauthorizedException,
			);
		});

		it("a well-signed token that carries no sub", async () => {
			const token = await signToken({ email: "nosub@example.com" });
			const { context } = contextFor({ authorization: `Bearer ${token}` });
			await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
				UnauthorizedException,
			);
		});

		it("a well-signed token that carries no email", async () => {
			const token = await signToken({ sub: "no-email" });
			const { context } = contextFor({ authorization: `Bearer ${token}` });
			await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
				UnauthorizedException,
			);
		});

		it("a token that is not a JWT at all", async () => {
			const { context } = contextFor({ authorization: "Bearer not.a.jwt" });
			await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
				UnauthorizedException,
			);
		});
	});

	describe("first sign-in", () => {
		it("provisions the app-side user row from the token claims", async () => {
			const token = await signToken({
				sub: "auth-1",
				email: "New.Person@Example.com",
				user_metadata: { name: "New Person" },
			});
			const { context, request } = contextFor({
				authorization: `Bearer ${token}`,
			});

			await expect(guard.canActivate(context)).resolves.toBe(true);

			const row = await db.query.users.findFirst({
				where: eq(users.authUserId, "auth-1"),
			});
			expect(row?.email).toBe("new.person@example.com");
			expect(row?.fullName).toBe("New Person");
			expect(row?.status).toBe("ACTIVE");
			expect(row?.verificationStatus).toBe("PENDING");
			expect(request.user).toMatchObject({
				email: "new.person@example.com",
				name: "New Person",
			});
		});

		it("accepts full_name as well as name in user_metadata", async () => {
			const token = await signToken({
				sub: "auth-2",
				email: "b@example.com",
				user_metadata: { full_name: "Full Name" },
			});
			const { context } = contextFor({ authorization: `Bearer ${token}` });

			await guard.canActivate(context);

			const row = await db.query.users.findFirst({
				where: eq(users.authUserId, "auth-2"),
			});
			expect(row?.fullName).toBe("Full Name");
		});

		it("grants no role at all", async () => {
			// The role-select screen is the only thing that grants one; a guard
			// that defaulted to volunteer would silently skip that decision.
			const token = await signToken({ sub: "auth-3", email: "c@example.com" });
			const { context, request } = contextFor({
				authorization: `Bearer ${token}`,
			});

			await guard.canActivate(context);

			expect(request.user).toMatchObject({ role: null, roles: [] });
		});

		it("does not create a second row when the same account returns", async () => {
			const claims = { sub: "auth-4", email: "d@example.com" };
			await guard.canActivate(
				contextFor({ authorization: `Bearer ${await signToken(claims)}` })
					.context,
			);
			await guard.canActivate(
				contextFor({ authorization: `Bearer ${await signToken(claims)}` })
					.context,
			);

			expect(await db.query.users.findMany()).toHaveLength(1);
		});
	});

	it("adopts a row that existed before the account had a login", async () => {
		// Invited team members exist in our tables before they ever sign in;
		// matching on email is what stops them getting a second, empty account.
		const [existing] = await db
			.insert(users)
			.values({ email: "invited@example.com", fullName: "Invited" })
			.returning();

		const token = await signToken({
			sub: "auth-5",
			email: "Invited@example.com",
		});
		await guard.canActivate(
			contextFor({ authorization: `Bearer ${token}` }).context,
		);

		const rows = await db.query.users.findMany();
		expect(rows).toHaveLength(1);
		expect(rows[0]?.id).toBe(existing?.id);
		expect(rows[0]?.authUserId).toBe("auth-5");
	});

	describe("role resolution", () => {
		async function signInHolding(
			names: Array<"volunteer" | "organisation" | "superadmin">,
		) {
			const [user] = await db
				.insert(users)
				.values({ email: `roles-${names.join("-")}@example.com` })
				.returning();
			const seeded = await db.query.roles.findMany();
			for (const name of names) {
				const role = seeded.find((r) => r.name === name);
				if (!role) throw new Error(`role ${name} not seeded`);
				await db
					.insert(userRoles)
					.values({ userId: user?.id as string, roleId: role.id });
			}

			const token = await signToken({
				sub: `sub-${names.join("-")}`,
				email: user?.email as string,
			});
			const { context, request } = contextFor({
				authorization: `Bearer ${token}`,
			});
			await guard.canActivate(context);
			return request.user as { role: string | null; roles: string[] };
		}

		it("attaches the single role a user holds", async () => {
			expect(await signInHolding(["volunteer"])).toMatchObject({
				role: "volunteer",
				roles: ["volunteer"],
			});
		});

		it("puts superadmin first when a user holds several", async () => {
			// The join table returns rows in arbitrary order — an unstable primary
			// role sends the app's routing gate into a redirect loop.
			expect(await signInHolding(["volunteer", "superadmin"])).toMatchObject({
				role: "superadmin",
				roles: ["superadmin", "volunteer"],
			});
		});

		it("ranks organisation above volunteer", async () => {
			expect(await signInHolding(["volunteer", "organisation"])).toMatchObject({
				role: "organisation",
				roles: ["organisation", "volunteer"],
			});
		});
	});

	it("refuses a suspended account, and says why", async () => {
		await db.insert(users).values({
			email: "suspended@example.com",
			authUserId: "auth-suspended",
			status: "SUSPENDED",
		});
		const token = await signToken({
			sub: "auth-suspended",
			email: "suspended@example.com",
		});
		const { context } = contextFor({ authorization: `Bearer ${token}` });

		await expect(guard.canActivate(context)).rejects.toThrowError(/suspended/i);
	});

	describe("route metadata", () => {
		it("lets a public route through with no token", async () => {
			const { context } = contextFor({}, { public: true });
			await expect(guard.canActivate(context)).resolves.toBe(true);
		});

		it("lets an optional-auth route through with no token", async () => {
			const { context, request } = contextFor({}, { optionalAuth: true });
			await expect(guard.canActivate(context)).resolves.toBe(true);
			expect(request.user).toBeUndefined();
		});

		it("treats a bad token on an optional-auth route as anonymous", async () => {
			// A stale token in the app must degrade the public feed to anonymous,
			// not break it.
			const { context, request } = contextFor(
				{ authorization: "Bearer garbage" },
				{ optionalAuth: true },
			);
			await expect(guard.canActivate(context)).resolves.toBe(true);
			expect(request.user).toBeUndefined();
		});

		it("still resolves the user on optional-auth when the token is good", async () => {
			const token = await signToken({
				sub: "auth-opt",
				email: "opt@example.com",
			});
			const { context, request } = contextFor(
				{ authorization: `Bearer ${token}` },
				{ optionalAuth: true },
			);

			await expect(guard.canActivate(context)).resolves.toBe(true);
			expect(request.user).toMatchObject({ email: "opt@example.com" });
		});
	});

	it("answers 503, not 401, when the database is unreachable", async () => {
		// A 401 here would force-sign-out every user in the app over a blip.
		const broken = new JwtGuard(new Reflector(), {
			query: {
				users: {
					findFirst: () => Promise.reject(new Error("connection refused")),
				},
			},
		} as never);
		const token = await signToken({ sub: "auth-9", email: "e@example.com" });
		const { context } = contextFor({ authorization: `Bearer ${token}` });

		await expect(broken.canActivate(context)).rejects.toBeInstanceOf(
			ServiceUnavailableException,
		);
	});
});
