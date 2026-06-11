import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { color } from "@astrojs/cli-kit";
import {
	cancel,
	confirm,
	intro,
	isCancel,
	outro,
	select,
	spinner,
	text,
} from "@clack/prompts";
import open from "open";

import { inspectDatabase, pushSchema } from "./lib/db";
import {
	ENV_PATH,
	envExists,
	maskUrl,
	readEnv,
	validateDirectUrl,
	validatePooledUrl,
	writeEnv,
} from "./lib/env";
import { banner, bannerAbort, nabhi } from "./lib/mascot";
import {
	consoleUrl,
	NEON_REGIONS,
	showConnectionStringGuide,
	showOverview,
	showRegionTip,
} from "./lib/neon-guide";

const DRY_RUN = process.argv.includes("--dry-run");
const CI_MODE =
	process.argv.includes("--ci") ||
	process.argv.includes("--non-interactive") ||
	process.env.CI === "true";
const SKIP_NABHI =
	process.argv.includes("--skip-nabhi") || CI_MODE || !process.stdout.isTTY;

// nabhya requires Node 22+ (matches package.json engines field)
const REQUIRED_NODE_MAJOR = 22;

function checkNodeVersion() {
	const major = Number.parseInt(process.versions.node.split(".")[0], 10);
	if (major >= REQUIRED_NODE_MAJOR) return;
	process.stderr.write(
		`\n${color.red("✗")} Node ${REQUIRED_NODE_MAJOR}+ required (you have ${process.versions.node}).\n` +
			`  Install via nvm: ${color.cyan(`nvm install ${REQUIRED_NODE_MAJOR} && nvm use ${REQUIRED_NODE_MAJOR}`)}\n\n`,
	);
	process.exit(1);
}

function bail(reason = "Setup cancelled."): never {
	cancel(reason);
	bannerAbort();
	process.exit(0);
}

function ensure<T>(value: T | symbol): T {
	if (isCancel(value)) bail();
	return value as T;
}

async function maybeSay(messages: string | string[]) {
	if (SKIP_NABHI) return;
	await nabhi(messages);
}

async function decideOnExistingEnv(): Promise<"keep" | "overwrite"> {
	if (!envExists()) return "overwrite";
	const existing = readEnv();
	const summary = [
		existing.DATABASE_URL &&
			`  DATABASE_URL = ${color.dim(maskUrl(existing.DATABASE_URL))}`,
		existing.DIRECT_URL &&
			`  DIRECT_URL   = ${color.dim(maskUrl(existing.DIRECT_URL))}`,
		existing.CORS_ORIGIN &&
			`  CORS_ORIGIN  = ${color.dim(existing.CORS_ORIGIN)}`,
	]
		.filter(Boolean)
		.join("\n");

	await maybeSay([
		"I found an existing .env.local.",
		"I can keep it and just run migrations, or overwrite it from scratch.",
	]);

	if (summary) process.stdout.write(`\n${summary}\n\n`);

	const action = ensure(
		await select({
			message: "What should I do?",
			options: [
				{
					value: "keep",
					label: "Keep current .env.local",
					hint: "skip to schema push",
				},
				{
					value: "overwrite",
					label: "Overwrite it",
					hint: "re-run full setup",
				},
				{ value: "cancel", label: "Cancel" },
			],
		}),
	) as "keep" | "overwrite" | "cancel";

	if (action === "cancel") bail();
	return action;
}

async function collectNeonCredentials() {
	showOverview();

	const region = ensure(
		await select({
			message: "Which region are you creating the Neon project in?",
			options: NEON_REGIONS.map((r) => ({
				value: r.value,
				label: r.label,
				hint: r.hint,
			})),
			initialValue: "aws-ap-southeast-1",
		}),
	) as string;

	showRegionTip(region);

	const shouldOpen = ensure(
		await confirm({
			message: `Open ${consoleUrl()} in your browser now?`,
			initialValue: true,
		}),
	) as boolean;

	if (shouldOpen) openInBrowser(consoleUrl());
	else
		process.stdout.write(
			`\n  ${color.dim("→ visit:")} ${color.cyan(consoleUrl())}\n`,
		);

	showConnectionStringGuide();

	const databaseUrl = ensure(
		await text({
			message: "Paste your POOLED connection string (DATABASE_URL):",
			placeholder:
				"postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require",
			validate: validatePooledUrl,
		}),
	) as string;

	const directUrl = ensure(
		await text({
			message: "Paste your DIRECT (unpooled) connection string (DIRECT_URL):",
			placeholder:
				"postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require",
			validate: validateDirectUrl,
		}),
	) as string;

	const corsOrigin = ensure(
		await text({
			message: "CORS origin for the server (CORS_ORIGIN):",
			placeholder: "http://localhost:8081",
			initialValue: "http://localhost:8081",
		}),
	) as string;

	return {
		DATABASE_URL: databaseUrl,
		DIRECT_URL: directUrl,
		CORS_ORIGIN: corsOrigin,
	};
}

function openInBrowser(url: string) {
	open(url).catch(() => {
		// ignore — not all environments allow this
	});
}

async function ensureDatabaseReady(directUrl: string | undefined) {
	if (DRY_RUN || !directUrl) return;
	const s = spinner();
	s.start("Checking database state");
	const state = await inspectDatabase(directUrl);

	if (state.kind === "unreachable") {
		s.stop("Could not reach database");
		process.stderr.write(
			`\n  ${color.red("✗")} ${state.error}\n` +
				"  Check your DATABASE_URL / DIRECT_URL.\n\n",
		);
		process.exit(1);
	}

	if (state.kind === "empty") {
		s.stop("Database is empty — fresh setup");
		return;
	}

	if (state.kind === "nabhya") {
		s.stop(
			`Database already has nabhya schema (${state.tableCount} tables) — will be idempotent`,
		);
		return;
	}

	// foreign tables
	s.stop("Database already has non-nabhya tables");
	const sample = state.tables
		.slice(0, 6)
		.map((t) => color.dim(t))
		.join(", ");
	const more =
		state.tables.length > 6
			? color.dim(` +${state.tables.length - 6} more`)
			: "";
	process.stderr.write(
		`\n  ${color.yellow("⚠")} Found ${state.tables.length} tables that don't look like nabhya:\n` +
			`    ${sample}${more}\n` +
			"  Pushing the schema could conflict with existing tables.\n\n",
	);
	if (CI_MODE) {
		process.stderr.write(
			`  ${color.red("✗")} Refusing to continue in --ci mode. Use a fresh Neon project.\n\n`,
		);
		process.exit(1);
	}
	const proceed = ensure(
		await confirm({
			message:
				"Continue anyway? (only safe if you know these tables won't clash)",
			initialValue: false,
		}),
	) as boolean;
	if (!proceed) bail("Aborted to protect your existing database.");
}

async function applyDatabase() {
	await maybeSay(["Wiring up the database now. This takes a few seconds."]);
	await pushSchema(DRY_RUN);
}

async function offerDevServer() {
	const start = ensure(
		await confirm({
			message: "Start the dev server now (pnpm dev)?",
			initialValue: true,
		}),
	) as boolean;
	if (!start) return;
	process.stdout.write("\n");
	spawn("pnpm", ["dev"], { stdio: "inherit", shell: true });
}

function getVersion(): string {
	try {
		const pkg = JSON.parse(
			readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
		);
		return pkg.version ?? "0.0.0";
	} catch {
		return "0.0.0";
	}
}

async function loadEnvForChildProcesses() {
	// db:push reads from process.env, so load .env.local into it
	const env = readEnv();
	for (const [k, v] of Object.entries(env)) {
		if (v && !process.env[k]) process.env[k] = v;
	}
}

async function main() {
	checkNodeVersion();
	banner();
	await maybeSay([
		`Welcome to nabhya v${getVersion()}.`,
		"I'll wire up your Neon database and push the schema.",
		"Should take about two minutes.",
	]);

	intro(color.bold("nabhya setup"));

	const action = await decideOnExistingEnv();

	if (action === "overwrite") {
		const { DATABASE_URL, DIRECT_URL, CORS_ORIGIN } =
			await collectNeonCredentials();
		writeEnv({
			DATABASE_URL,
			DIRECT_URL,
			CORS_ORIGIN,
			NODE_ENV: "development",
		});
		process.stdout.write(
			`\n  ${color.green("✓")} ${color.dim("wrote")} ${ENV_PATH}\n\n`,
		);
	} else {
		process.stdout.write(
			`\n  ${color.green("✓")} ${color.dim("keeping existing")} ${ENV_PATH}\n\n`,
		);
	}

	await loadEnvForChildProcesses();

	await ensureDatabaseReady(process.env.DIRECT_URL);
	await applyDatabase();

	outro(color.green("Setup complete."));

	await maybeSay([
		"All wired up.",
		"You can run pnpm dev whenever you're ready.",
	]);

	if (!DRY_RUN && !SKIP_NABHI && !CI_MODE) await offerDevServer();
}

main().catch((err) => {
	process.stderr.write(`\n${color.red("✗")} ${err.message ?? err}\n`);
	bannerAbort();
	process.exit(1);
});
