import "reflect-metadata";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { NestFactory } from "@nestjs/core";

/**
 * Guards against silently broken dependency injection.
 *
 * The dev runner (tsx) and the bundler both use esbuild, which does not
 * implement `emitDecoratorMetadata`. Without it `design:paramtypes` is
 * undefined, Nest sees a class with no declared dependencies, constructs it
 * with zero arguments, and every service lands as `undefined` — no boot error,
 * just a 500 on the first request that touches it.
 *
 * That is why every constructor parameter in this app carries an explicit
 * `@Inject(...)`. This script proves it: it resolves every @Controller and
 * @Injectable from the container and asserts that no constructor-assigned
 * property came back undefined.
 *
 * Run with: pnpm --filter server verify:di
 */

const SRC = join(import.meta.dirname, "..", "src");

function walk(dir: string): string[] {
	return readdirSync(dir).flatMap((entry) => {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) return walk(full);
		// Skip specs: they import vitest, which only exists inside the runner.
		if (full.endsWith(".spec.ts") || full.endsWith(".test.ts")) return [];
		// Skip the entrypoint: importing it runs bootstrap(), which binds port
		// 3000 — so this script could only ever run with the dev server stopped,
		// and left a real listening server behind when it did.
		if (full === join(SRC, "index.ts")) return [];
		return full.endsWith(".ts") ? [full] : [];
	});
}

// biome-ignore lint/suspicious/noExplicitAny: reflective container walk
type Ctor = new (...args: any[]) => object;

async function collectInjectables(): Promise<Ctor[]> {
	const found: Ctor[] = [];

	for (const file of walk(SRC)) {
		const module = await import(pathToFileURL(file).href);
		for (const exported of Object.values(module)) {
			if (typeof exported !== "function") continue;
			const target = exported as Ctor;
			// A class Nest can construct: decorated as controller or injectable,
			// and actually taking constructor arguments.
			const isNestClass =
				Reflect.hasMetadata("__controller__", target) ||
				Reflect.hasMetadata("__injectable__", target) ||
				Reflect.hasMetadata("self:paramtypes", target);
			if (isNestClass && target.length >= 0) found.push(target);
		}
	}

	return [...new Set(found)];
}

async function main() {
	// Both imports are dynamic and ordered deliberately: `@nabhya/db` validates
	// the server env the moment it loads, so the placeholders have to be in
	// place first. Static imports would be hoisted (and reordered by the import
	// sorter), which would put validation before the defaults and make this
	// script unrunnable without a developer's .env — the DI wiring it
	// checks has nothing to do with real credentials.
	await import("../test/setup-env");
	const { AppModule } = await import("../src/app/app.module");

	const app = await NestFactory.createApplicationContext(AppModule, {
		logger: ["error"],
	});

	const classes = await collectInjectables();
	const failures: string[] = [];
	const checkedNames: string[] = [];
	let checked = 0;

	for (const target of classes) {
		let instance: Record<string, unknown>;
		try {
			instance = app.get(target) as Record<string, unknown>;
		} catch {
			// Not registered in the graph (e.g. a DTO-ish helper) — nothing to check.
			continue;
		}
		if (!instance || typeof instance !== "object") continue;

		checked++;
		checkedNames.push(target.name);
		for (const [key, value] of Object.entries(instance)) {
			if (value === undefined) {
				failures.push(`${target.name}.${key} is undefined`);
			}
		}
	}

	await app.close();

	console.log(
		`Checked ${checked} injectable class(es): ${checkedNames.join(", ")}`,
	);

	if (failures.length > 0) {
		console.error("\nDependency injection is broken:\n");
		for (const failure of failures) console.error(`  ✗ ${failure}`);
		console.error(
			"\nEvery constructor parameter needs an explicit @Inject(Token), " +
				"because esbuild does not emit decorator metadata.\n",
		);
		process.exit(1);
	}

	console.log("All dependencies resolved ✓");
	process.exit(0);
}

main().catch((error) => {
	console.error("verify-di failed to run:", error);
	process.exit(1);
});
