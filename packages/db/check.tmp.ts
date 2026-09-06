import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: "../../apps/server/.env" });
async function main() {
	const c = new Client({ connectionString: process.env.DATABASE_URL! });
	await c.connect();
	const mig = await c.query(
		`SELECT to_regclass('public.__drizzle_migrations') AS t`,
	);
	console.log("__drizzle_migrations exists:", mig.rows[0].t !== null);
	if (mig.rows[0].t) {
		const rows = await c.query(
			`SELECT id, hash, created_at FROM "__drizzle_migrations" ORDER BY id`,
		);
		console.log("applied migration count:", rows.rows.length);
		console.log("ids:", rows.rows.map((r: any) => r.id).join(", "));
	}
	const tables = await c.query(
		`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1`,
	);
	console.log("tables:", tables.rows.map((r: any) => r.table_name).join(", "));
	await c.end();
}
main().catch((e) => {
	console.error(e);
	process.exit(1);
});
