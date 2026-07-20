import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import * as schema from "@nabhya/db/schema";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

const MIGRATIONS_DIR = join(
	import.meta.dirname,
	"..",
	"..",
	"..",
	"packages",
	"db",
	"src",
	"migrations",
);

/**
 * Spins up a real Postgres for a test file.
 *
 * PGlite runs Postgres compiled to WASM in-process — real SQL, real
 * constraints, real transactions, no Docker and no external service. That
 * matters here because the logic worth testing (unique indexes, SELECT … FOR
 * UPDATE, filtered aggregates, cascade deletes) is precisely the part a mocked
 * database would not exercise.
 */
export async function createTestDb(): Promise<{
	db: TestDb;
	close: () => Promise<void>;
}> {
	const client = new PGlite();
	const db = drizzle(client, { schema });

	await applyMigrations(db);

	return {
		db,
		close: async () => {
			await client.close();
		},
	};
}

/**
 * Applies the generated SQL migrations.
 *
 * Deliberately uses the committed migration files rather than drizzle-kit
 * push: tests then fail if the migrations drift from the schema, which is the
 * bug worth catching given push runs automatically in development.
 */
async function applyMigrations(db: TestDb) {
	const journalPath = join(MIGRATIONS_DIR, "meta", "_journal.json");
	const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
		entries: Array<{ tag: string }>;
	};

	for (const entry of journal.entries) {
		const file = join(MIGRATIONS_DIR, `${entry.tag}.sql`);
		const contents = readFileSync(file, "utf8");

		// Drizzle separates statements with this sentinel.
		for (const statement of contents.split("--> statement-breakpoint")) {
			const trimmed = statement.trim();
			if (trimmed) await db.execute(sql.raw(trimmed));
		}
	}
}

/** Wipes every table between tests without paying to rebuild the schema. */
export async function truncateAll(db: TestDb) {
	await db.execute(sql`
		do $$
		declare stmt text;
		begin
			select 'truncate table ' || string_agg(
				format('%I.%I', schemaname, tablename), ', '
			) || ' restart identity cascade'
			into stmt
			from pg_tables where schemaname = 'public';
			if stmt is not null then execute stmt; end if;
		end $$;
	`);
}
