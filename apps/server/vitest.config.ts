import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["src/**/*.spec.ts", "test/**/*.spec.ts"],
		// Runs before each test file's own imports, which matters: `@nabhya/db`
		// validates the server env the moment it is loaded.
		setupFiles: ["./test/setup-env.ts"],
		// Integration specs each build their own in-process Postgres, so running
		// files in parallel would multiply memory for no wall-clock gain.
		fileParallelism: false,
		testTimeout: 30_000,
		hookTimeout: 60_000,
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts"],
			exclude: ["src/**/*.spec.ts", "src/**/index.ts", "src/index.ts"],
		},
	},
});
