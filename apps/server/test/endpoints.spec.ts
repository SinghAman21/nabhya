import { users } from "@nabhya/db/schema";
import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { IS_OPTIONAL_AUTH_KEY } from "../src/common/decorators/optional-auth.decorator";
import { IS_PUBLIC_KEY } from "../src/common/decorators/public.decorator";
import { ROLES_KEY } from "../src/common/decorators/roles.decorator";
import { seedRoles } from "./factories";
import { createTestDb, type TestDb } from "./harness";

/**
 * Every route the app exposes, exercised over real HTTP.
 *
 * The service specs already cover what each endpoint *does*. What nothing
 * covered was the wiring around them: that the route exists at the path the
 * app calls, that the global guards actually run on it, and that an anonymous
 * request gets 401 rather than data. Those break silently — a renamed path or
 * a lost decorator still type-checks and still passes every unit test.
 *
 * The route table is read from Nest's own decorators rather than written out
 * by hand, so a new endpoint is covered the moment it is added.
 */

/* -------------------------------------------------------------------------- */
/* A real database, injected before the app module is ever imported            */
/* -------------------------------------------------------------------------- */

const holder = vi.hoisted(() => ({ db: null as unknown }));

// DatabaseModule provides `useValue: db` at import time, so the app has to be
// imported after `holder.db` is filled in — see beforeAll.
vi.mock("@nabhya/db", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@nabhya/db")>();
	return {
		...actual,
		get db() {
			return holder.db;
		},
	};
});

// 92 endpoints times several cases each would trip the 120/min bucket and turn
// this file into a 429 generator. The limits themselves are covered by the
// throttler's own config, not here.
vi.mock("../src/common/guards/throttler.config", () => ({
	throttlerConfig: {
		throttlers: [
			{ name: "default", ttl: 1000, limit: 100_000 },
			{ name: "strict", ttl: 1000, limit: 100_000 },
		],
	},
}));

const signingKeys = await (async () => {
	const { generateKeyPair } = await import("jose");
	return await generateKeyPair("ES256");
})();

vi.mock("jose", async (importOriginal) => {
	const actual = await importOriginal<typeof import("jose")>();
	return {
		...actual,
		createRemoteJWKSet: () => async () => signingKeys.publicKey,
	};
});

/* -------------------------------------------------------------------------- */
/* Route table, straight from the decorators                                  */
/* -------------------------------------------------------------------------- */

type Route = {
	verb: string;
	path: string;
	auth: "public" | "optional" | "required";
	roles: string[];
	controller: string;
};

const VERBS: Record<number, string> = {
	[RequestMethod.GET]: "GET",
	[RequestMethod.POST]: "POST",
	[RequestMethod.PUT]: "PUT",
	[RequestMethod.PATCH]: "PATCH",
	[RequestMethod.DELETE]: "DELETE",
};

function readRoutes(controllers: Array<new (...args: never[]) => object>) {
	const routes: Route[] = [];

	for (const controller of controllers) {
		const base = Reflect.getMetadata(PATH_METADATA, controller) ?? "";
		const classPublic = Reflect.getMetadata(IS_PUBLIC_KEY, controller) === true;
		const classRoles: string[] =
			Reflect.getMetadata(ROLES_KEY, controller) ?? [];

		for (const name of Object.getOwnPropertyNames(controller.prototype)) {
			if (name === "constructor") continue;
			const handler = controller.prototype[name];
			if (typeof handler !== "function") continue;

			const method = Reflect.getMetadata(METHOD_METADATA, handler);
			if (method === undefined) continue;

			const sub = Reflect.getMetadata(PATH_METADATA, handler) ?? "";
			const segments = [base, sub]
				.map((s) => String(s).replace(/^\/|\/$/g, ""))
				.filter(Boolean);

			const isPublic =
				classPublic || Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true;
			const isOptional =
				Reflect.getMetadata(IS_OPTIONAL_AUTH_KEY, handler) === true;
			const roles: string[] =
				Reflect.getMetadata(ROLES_KEY, handler) ?? classRoles;

			routes.push({
				verb: VERBS[method as number] ?? String(method),
				path: `/api/${segments.join("/")}`.replace(/\/+$/, "") || "/api",
				auth: isPublic ? "public" : isOptional ? "optional" : "required",
				roles,
				controller: controller.name,
			});
		}
	}

	return routes.sort((a, b) =>
		`${a.path} ${a.verb}`.localeCompare(`${b.path} ${b.verb}`),
	);
}

/** Fills :params with syntactically valid values so routing, not parsing, is what is tested. */
const UUID = "00000000-0000-0000-0000-000000000000";
function concretePath(path: string) {
	return path.replace(/:([A-Za-z]+)/g, (_, name: string) =>
		name.toLowerCase().includes("code") ? "TESTCODE" : UUID,
	);
}

/* -------------------------------------------------------------------------- */

describe("HTTP surface", () => {
	let db: TestDb;
	let close: () => Promise<void>;
	let app: { close: () => Promise<void> };
	let baseUrl: string;
	let routes: Route[];
	let volunteerToken: string;

	beforeAll(async () => {
		({ db, close } = await createTestDb());
		holder.db = db;
		await seedRoles(db);

		const { NestFactory } = await import("@nestjs/core");
		const { AppModule } = await import("../src/app/app.module");
		const { GlobalExceptionFilter } = await import("../src/common/filters");
		const { ResponseTransformInterceptor } = await import(
			"../src/common/interceptors"
		);

		const created = await NestFactory.create(AppModule, {
			logger: false,
			rawBody: true,
		});
		created.setGlobalPrefix("api");
		created.useGlobalFilters(new GlobalExceptionFilter());
		created.useGlobalInterceptors(new ResponseTransformInterceptor());
		await created.listen(0);
		baseUrl = await created.getUrl();
		app = created;

		const controllers = await Promise.all(
			[
				["../src/app/app.controller", "AppController"],
				["../src/modules/admin/admin.controller", "AdminController"],
				[
					"../src/modules/categories/categories.controller",
					"CategoriesController",
				],
				[
					"../src/modules/certificates/certificates.controller",
					"CertificatesController",
				],
				[
					"../src/modules/donations/donations.controller",
					"DonationsController",
				],
				[
					"../src/modules/engagement/engagement.controller",
					"EngagementController",
				],
				["../src/modules/events/events.controller", "EventsController"],
				["../src/modules/events/org-events.controller", "OrgEventsController"],
				["../src/modules/needs/needs.controller", "NeedsController"],
				["../src/modules/needs/org-needs.controller", "OrgNeedsController"],
				[
					"../src/modules/notifications/notifications.controller",
					"NotificationsController",
				],
				[
					"../src/modules/onboarding/onboarding.controller",
					"OnboardingController",
				],
				[
					"../src/modules/organizations/organizations.controller",
					"OrganizationsController",
				],
				[
					"../src/modules/publishing/publishing.controller",
					"PublishingController",
				],
				["../src/modules/uploads/uploads.controller", "UploadsController"],
				["../src/modules/users/users.controller", "UsersController"],
			].map(async ([path, name]) => {
				const mod = await import(/* @vite-ignore */ path as string);
				const controller = mod[name as string];
				if (!controller) throw new Error(`${name} not exported by ${path}`);
				return controller;
			}),
		);

		routes = readRoutes(controllers);

		// A signed-in volunteer, used to prove the guards accept a real token.
		const { SignJWT } = await import("jose");
		const [volunteer] = await db
			.insert(users)
			.values({ email: "sweep-volunteer@example.com", authUserId: "sweep-1" })
			.returning();
		volunteerToken = await new SignJWT({
			sub: "sweep-1",
			email: volunteer?.email as string,
		})
			.setProtectedHeader({ alg: "ES256" })
			.setIssuedAt()
			.setExpirationTime("1h")
			.sign(signingKeys.privateKey);
	});

	afterAll(async () => {
		await app?.close();
		await close();
	});

	async function call(route: Route, token?: string) {
		const response = await fetch(`${baseUrl}${concretePath(route.path)}`, {
			method: route.verb,
			headers: {
				"content-type": "application/json",
				...(token ? { authorization: `Bearer ${token}` } : {}),
			},
			...(route.verb === "GET" || route.verb === "DELETE"
				? {}
				: { body: "{}" }),
		});
		return response.status;
	}

	it("exposes the expected number of endpoints", () => {
		// A bare count, so adding or deleting a route is a deliberate act that
		// shows up in the diff rather than passing unnoticed.
		expect(routes.length).toBe(113);
	});

	it("mounts every route under the /api prefix", () => {
		expect(routes.filter((r) => !r.path.startsWith("/api"))).toEqual([]);
	});

	it("routes every declared endpoint (no 404 on the path itself)", async () => {
		const missing: string[] = [];
		for (const route of routes) {
			const status = await call(route, volunteerToken);
			// 404 from a handler that ran is fine — the UUID above matches nothing.
			// What matters is that Express resolved the path at all, which any
			// status other than "Cannot <VERB> <path>" proves; Nest answers an
			// unrouted path with 404 and no envelope, so we check the body shape.
			if (status === 404) {
				const raw = await fetch(`${baseUrl}${concretePath(route.path)}`, {
					method: route.verb,
					headers: {
						"content-type": "application/json",
						authorization: `Bearer ${volunteerToken}`,
					},
					...(route.verb === "GET" || route.verb === "DELETE"
						? {}
						: { body: "{}" }),
				}).then((r) => r.text());
				if (raw.includes("Cannot ")) {
					missing.push(`${route.verb} ${route.path}`);
				}
			}
		}
		expect(missing).toEqual([]);
	});

	describe("anonymous access", () => {
		it("rejects every authenticated route with 401", async () => {
			const leaked: string[] = [];
			for (const route of routes.filter((r) => r.auth === "required")) {
				const status = await call(route);
				if (status !== 401) {
					leaked.push(`${route.verb} ${route.path} -> ${status}`);
				}
			}
			expect(leaked).toEqual([]);
		});

		it("serves every public route without a token", async () => {
			const blocked: string[] = [];
			for (const route of routes.filter((r) => r.auth === "public")) {
				const status = await call(route);
				if (status === 401) blocked.push(`${route.verb} ${route.path}`);
			}
			expect(blocked).toEqual([]);
		});

		it("serves every optional-auth route without a token", async () => {
			const blocked: string[] = [];
			for (const route of routes.filter((r) => r.auth === "optional")) {
				const status = await call(route);
				if (status === 401) blocked.push(`${route.verb} ${route.path}`);
			}
			expect(blocked).toEqual([]);
		});
	});

	describe("authenticated access", () => {
		it("lets a valid token past the auth guard on every route", async () => {
			// Not asserting success — most of these 404 or 403 on a UUID that
			// matches nothing. Asserting only that authentication itself passed.
			const rejected: string[] = [];
			for (const route of routes.filter((r) => r.auth === "required")) {
				const status = await call(route, volunteerToken);
				if (status === 401) {
					rejected.push(`${route.verb} ${route.path}`);
				}
			}
			expect(rejected).toEqual([]);
		});

		it("keeps a volunteer out of every superadmin route", async () => {
			const superadminRoutes = routes.filter((r) =>
				r.roles.includes("superadmin"),
			);
			expect(superadminRoutes.length).toBeGreaterThan(0);

			const allowed: string[] = [];
			for (const route of superadminRoutes) {
				const status = await call(route, volunteerToken);
				if (status !== 403) {
					allowed.push(`${route.verb} ${route.path} -> ${status}`);
				}
			}
			expect(allowed).toEqual([]);
		});
	});

	it("names every public route explicitly", () => {
		// Public routes are the app's whole unauthenticated attack surface. This
		// list is the review gate: making a route public means changing this test
		// on purpose, not by forgetting a decorator.
		const publicRoutes = routes
			.filter((r) => r.auth === "public")
			.map((r) => `${r.verb} ${r.path}`);

		expect(publicRoutes.sort()).toEqual(
			[
				"GET /api",
				"GET /api/categories",
				"GET /api/certificates/:code/verify",
				"GET /api/events",
				"GET /api/health",
				"GET /api/needs",
				"GET /api/organizations",
				"GET /api/organizations/:id",
				"GET /api/organizations/:id/announcements",
				"GET /api/organizations/:id/impact",
				"GET /api/organizations/:id/reports",
				"GET /api/organizations/:id/reviews",
				"GET /api/organizations/:id/team",
				"GET /api/organizations/nearby",
				"POST /api/donations/webhook",
			].sort(),
		);
	});

	it("names every optional-auth route explicitly", () => {
		const optional = routes
			.filter((r) => r.auth === "optional")
			.map((r) => `${r.verb} ${r.path}`);

		expect(optional.sort()).toEqual(
			[
				"GET /api/events/:id",
				"GET /api/needs/:id",
				// Guest donations: a signed-in donor gets the receipt attached to
				// their account, an anonymous one still gets to give.
				"POST /api/donations/checkout",
			].sort(),
		);
	});
});
