import { spawn } from "node:child_process";
import { db } from "@nabhya/db";
import { Global, Logger, Module, type OnModuleInit } from "@nestjs/common";

export const DB_TOKEN = "DRIZZLE_DB";

/**
 * Global module that provides the Drizzle database instance.
 * Decorated with @Global() so any module can inject it without
 * needing to import DatabaseModule explicitly.
 *
 * Inject with: @Inject(DB_TOKEN) private db: typeof db
 *
 * In development, auto-pushes the Drizzle schema on startup
 * (equivalent to TypeORM's synchronize: true).
 */
@Global()
@Module({
	providers: [
		{
			provide: DB_TOKEN,
			useValue: db,
		},
	],
	exports: [DB_TOKEN],
})
export class DatabaseModule implements OnModuleInit {
	private readonly logger = new Logger(DatabaseModule.name);

	async onModuleInit() {
		if (process.env.NODE_ENV === "production") return;
		// Tests run against an in-process PGlite database. Pushing here would
		// spawn drizzle-kit and rewrite whatever DIRECT_URL happens to point at -
		// a developer's real database - just for running `pnpm test`.
		if (process.env.NODE_ENV === "test") return;

		this.logger.log("Auto-syncing schema (drizzle-kit push)…");
		await this.runPush();
	}

	private runPush(): Promise<void> {
		return new Promise((resolve, reject) => {
			const child = spawn("pnpm", ["--filter", "@nabhya/db", "db:push"], {
				stdio: "pipe",
				shell: true,
				// Run from the monorepo root regardless of CWD
				cwd: process.cwd(),
			});

			// drizzle-kit writes its failures to stdout as often as stderr, so
			// capture both - a warning with an empty tail is undiagnosable.
			let output = "";
			const collect = (chunk: Buffer) => {
				output += chunk.toString();
			};
			child.stdout?.on("data", collect);
			child.stderr?.on("data", collect);

			child.on("close", (code) => {
				if (code === 0) {
					this.logger.log("Schema sync complete ✓");
					resolve();
				} else {
					this.logger.warn(
						`drizzle-kit push exited ${code} - ${output.trim()}`,
					);
					// Warn but don't crash the server on sync failure
					resolve();
				}
			});

			child.on("error", (err) => {
				this.logger.warn(`Schema sync failed: ${err.message}`);
				reject(err);
			});
		});
	}
}
