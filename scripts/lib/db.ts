import { spawn } from "node:child_process";
import { spinner } from "@clack/prompts";
import { neon } from "@neondatabase/serverless";

interface RunOptions {
	label: string;
	command: string;
	args: string[];
	dryRun?: boolean;
}

function runWithSpinner({
	label,
	command,
	args,
	dryRun,
}: RunOptions): Promise<void> {
	return new Promise((resolveRun, rejectRun) => {
		const s = spinner();
		s.start(label);
		if (dryRun) {
			setTimeout(() => {
				s.stop(`${label} (skipped — dry run)`);
				resolveRun();
			}, 350);
			return;
		}
		const child = spawn(command, args, {
			stdio: ["ignore", "pipe", "pipe"],
			env: process.env,
			shell: true,
		});
		let stderr = "";
		child.stdout?.on("data", () => {});
		child.stderr?.on("data", (chunk) => {
			stderr += chunk.toString();
		});
		child.on("error", (err) => {
			s.stop(`${label} — failed`);
			rejectRun(err);
		});
		child.on("close", (code) => {
			if (code === 0) {
				s.stop(`${label} — done`);
				resolveRun();
			} else {
				s.stop(`${label} — failed (exit ${code})`);
				if (stderr.trim()) process.stderr.write(stderr);
				rejectRun(new Error(`${command} ${args.join(" ")} exited ${code}`));
			}
		});
	});
}

export async function pushSchema(dryRun = false) {
	await runWithSpinner({
		label: "Pushing schema (drizzle-kit push)",
		// Run from monorepo root via pnpm filter
		command: "pnpm",
		args: ["--filter", "@my-better-t-app/db", "db:push"],
		dryRun,
	});
}

export type DbState =
	| { kind: "empty" }
	| { kind: "nabhya"; tableCount: number }
	| { kind: "foreign"; tables: string[] }
	| { kind: "unreachable"; error: string };

// Known sentinel tables that indicate a nabhya-managed schema.
// Extend this list as tables are added to packages/db/src/schema.
const NABHYA_SENTINEL_TABLES = new Set<string>([
	// placeholder — add real table names here as the schema grows
	// e.g. "users", "sessions", etc.
]);

export async function inspectDatabase(url: string): Promise<DbState> {
	try {
		const sql = neon(url);
		const rows = (await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
    `) as { table_name: string }[];
		const names = rows.map((r) => r.table_name);
		if (names.length === 0) return { kind: "empty" };
		// If any of the known nabhya tables are present, treat as nabhya schema
		if (names.some((n) => NABHYA_SENTINEL_TABLES.has(n))) {
			return { kind: "nabhya", tableCount: names.length };
		}
		return { kind: "foreign", tables: names };
	} catch (err) {
		return {
			kind: "unreachable",
			error: err instanceof Error ? err.message : String(err),
		};
	}
}
