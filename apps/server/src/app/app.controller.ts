import type { db as dbType } from "@nabhya/db";
import {
	Controller,
	Get,
	Inject,
	Logger,
	ServiceUnavailableException,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { sql } from "drizzle-orm";
import { DB_TOKEN } from "../common/database";
import { Public } from "../common/decorators";
import { STORAGE_TOKEN, type StorageProvider } from "../common/storage";

@ApiTags("Health")
// Orchestrators poll these on a tight loop; a 429 would read as unhealthy.
@SkipThrottle()
@Controller()
export class AppController {
	private readonly logger = new Logger(AppController.name);
	private readonly startedAt = Date.now();

	constructor(
		@Inject(DB_TOKEN) private readonly db: typeof dbType,
		@Inject(STORAGE_TOKEN) private readonly storage: StorageProvider,
	) {}

	/**
	 * Liveness. Answers "is this process running" and nothing else, so a
	 * transient database blip never causes an orchestrator to kill a healthy
	 * container.
	 */
	@Public()
	@Get()
	@ApiOperation({ summary: "Liveness probe" })
	live() {
		return {
			status: "ok",
			uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
		};
	}

	/**
	 * Readiness. Answers "can this instance serve traffic", which means actually
	 * reaching the database - the previous handler returned a hardcoded "OK",
	 * so a load balancer would happily route requests to an instance whose
	 * database was unreachable and every one of them would 500.
	 */
	@Public()
	@Get("health")
	@ApiOperation({ summary: "Readiness probe - verifies dependencies" })
	@ApiResponse({ status: 503, description: "A dependency is unreachable." })
	async ready() {
		const startedAt = Date.now();

		try {
			await this.db.execute(sql`select 1`);
		} catch (error) {
			this.logger.error(
				`Readiness failed: database unreachable - ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			throw new ServiceUnavailableException({
				status: "unavailable",
				database: "down",
			});
		}

		return {
			status: "ok",
			database: "up",
			// Surfaced so a deploy can catch "running on the in-memory stub"
			// before anyone uploads a document that quietly disappears.
			storage: this.storage.name,
			latencyMs: Date.now() - startedAt,
		};
	}
}
