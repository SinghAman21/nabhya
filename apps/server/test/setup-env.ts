/**
 * Satisfies `packages/env` before any module under test is imported.
 *
 * Importing almost anything from `common/` reaches `@nabhya/db`, which
 * validates the server env at module load. Without this the whole suite fails
 * to import on a machine that has no `.env` — meaning the tests would
 * only ever run for whoever happened to have secrets lying around.
 *
 * None of these values are used: integration specs talk to PGlite, and the R2
 * and Razorpay providers fall back to their in-memory stubs. They exist purely
 * to get past validation.
 */
const TEST_ENV: Record<string, string> = {
	NODE_ENV: "test",
	DATABASE_URL: "postgres://test:test@localhost:5432/test",
	DIRECT_URL: "postgres://test:test@localhost:5432/test",
	CORS_ORIGIN: "http://localhost:8081",
	SUPABASE_AUTH_JWKS_URL: "https://auth.test.invalid/.well-known/jwks.json",
};

for (const [key, value] of Object.entries(TEST_ENV)) {
	// Never clobber a real value — CI may legitimately set NODE_ENV.
	process.env[key] ??= value;
}

// Marks the file as a module so `verify-di.ts` can `await import(...)` it.
export {};
