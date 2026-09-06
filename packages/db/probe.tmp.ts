import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: "../../apps/server/.env" });
async function probe(label: string, url: string | undefined) {
	if (!url) {
		console.log(label, "=> NO URL");
		return;
	}
	const u = new URL(url);
	console.log(
		`${label} -> host=${u.host} db=${u.pathname.split("/").filter(Boolean).pop()}`,
	);
	try {
		const c = new Client({ connectionString: url });
		await c.connect();
		const res = await c.query("SELECT current_database(), version()");
		const mig = await c.query(
			`SELECT to_regclass('public.__drizzle_migrations') AS t`,
		);
		const needs = await c.query(
			`SELECT to_regclass('public.needs') AS n, to_regclass('public.organization_needs') AS on`,
		);
		console.log(
			`  db=${res.rows[0].current_database()} pg=${res.rows[0].version.split(" ")[1]} drizzleMigrations=${mig.rows[0].t} needs=${needs.rows[0].n} organization_needs=${needs.rows[0].on}`,
		);
		await c.end();
	} catch (e: any) {
		console.log(`  ERROR: ${e.message}`);
	}
}
await probe("DATABASE_URL", process.env.DATABASE_URL);
await probe("DIRECT_URL", process.env.DIRECT_URL);
