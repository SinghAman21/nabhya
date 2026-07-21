/**
 * Dev-only: creates three test logins (superadmin / organisation / volunteer)
 * in Neon Auth and links them to local users with their roles pre-assigned.
 *
 *   pnpm --filter @nabhya/db db:seed-users
 *
 * Idempotent — safe to re-run. Accounts that already exist in Neon Auth are
 * signed in instead to recover their id. Superadmin has no HTTP route that
 * grants it (by design), which is why this script writes user_roles directly.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

// @nabhya/env/server validates process.env at import time and loads .env
// relative to cwd, so the server env must be in place before ./index loads.
const here = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(here, "../../../apps/server/.env.local") });

const { and, eq } = await import("drizzle-orm");
const { db } = await import("./index");
const { roles, userRoles, users } = await import("./schema/users");

const NEON_AUTH_URL = process.env.NEON_AUTH_URL ?? "";
if (!NEON_AUTH_URL) {
	console.error("NEON_AUTH_URL is not set — run pnpm db:setup first.");
	process.exit(1);
}

const PASSWORD = "Nabhya@123";

const ACCOUNTS = [
	{ email: "admin@nabhya.dev", name: "Test Admin", role: "superadmin" },
	{ email: "org@nabhya.dev", name: "Test NGO", role: "organisation" },
	{ email: "volunteer@nabhya.dev", name: "Test Volunteer", role: "volunteer" },
] as const;

interface NeonAuthUserResponse {
	user?: { id?: string };
	message?: string;
}

async function neonAuthPost(path: string, body: Record<string, string>) {
	const response = await fetch(`${NEON_AUTH_URL}${path}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			// Better Auth's CSRF check rejects origin-less requests.
			Origin: new URL(NEON_AUTH_URL).origin,
		},
		body: JSON.stringify(body),
	});
	const payload = (await response
		.json()
		.catch(() => ({}))) as NeonAuthUserResponse;
	return { ok: response.ok, status: response.status, payload };
}

/** Sign the account up; if it already exists, sign in to recover its id. */
async function ensureNeonAuthUser(account: (typeof ACCOUNTS)[number]) {
	const signUp = await neonAuthPost("/sign-up/email", {
		email: account.email,
		password: PASSWORD,
		name: account.name,
	});
	if (signUp.ok && signUp.payload.user?.id) {
		return { id: signUp.payload.user.id, created: true };
	}

	const signIn = await neonAuthPost("/sign-in/email", {
		email: account.email,
		password: PASSWORD,
	});
	if (signIn.ok && signIn.payload.user?.id) {
		return { id: signIn.payload.user.id, created: false };
	}

	throw new Error(
		`Neon Auth rejected ${account.email}: ` +
			`sign-up ${signUp.status} (${signUp.payload.message ?? "no message"}), ` +
			`sign-in ${signIn.status} (${signIn.payload.message ?? "no message"})`,
	);
}

async function main() {
	console.log("Seeding test logins...");

	for (const account of ACCOUNTS) {
		const authUser = await ensureNeonAuthUser(account);

		const [dbUser] = await db
			.insert(users)
			.values({
				neonUserId: authUser.id,
				email: account.email,
				fullName: account.name,
				emailVerified: true,
				status: "ACTIVE",
			})
			.onConflictDoUpdate({
				target: users.email,
				set: { neonUserId: authUser.id, fullName: account.name },
			})
			.returning();
		if (!dbUser) throw new Error(`Could not upsert user ${account.email}`);

		const role = await db.query.roles.findFirst({
			where: eq(roles.name, account.role),
		});
		if (!role) {
			throw new Error(`Role "${account.role}" is missing — run db:seed first.`);
		}

		const existing = await db.query.userRoles.findFirst({
			where: and(
				eq(userRoles.userId, dbUser.id),
				eq(userRoles.roleId, role.id),
			),
		});
		if (!existing) {
			await db.insert(userRoles).values({ userId: dbUser.id, roleId: role.id });
		}

		console.log(
			`  ${account.role.padEnd(12)} → ${account.email} ` +
				`(${authUser.created ? "created" : "already existed"})`,
		);
	}

	console.log(`\nPassword for all three: ${PASSWORD}`);
	console.log("Done!");
	process.exit(0);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
