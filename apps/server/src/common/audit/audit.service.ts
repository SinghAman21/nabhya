import type { db as dbType } from "@nabhya/db";
import { auditLogs } from "@nabhya/db/schema";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { DB_TOKEN } from "../database";

export interface AuditEntry {
	performedBy?: string | null;
	action: string;
	entityName?: string;
	entityId?: string;
	oldValue?: unknown;
	newValue?: unknown;
	ipAddress?: string | null;
}

/**
 * Append-only activity trail surfaced in the superadmin console.
 *
 * Writes are deliberately fire-and-forget: an audit failure must never fail the
 * business operation that triggered it. Callers therefore do not await `record`
 * inside their transactions.
 */
@Injectable()
export class AuditService {
	private readonly logger = new Logger(AuditService.name);

	constructor(@Inject(DB_TOKEN) private readonly db: typeof dbType) {}

	async record(entry: AuditEntry): Promise<void> {
		try {
			await this.db.insert(auditLogs).values({
				performedBy: entry.performedBy ?? null,
				action: entry.action,
				entityName: entry.entityName ?? null,
				entityId: entry.entityId ?? null,
				oldValue: entry.oldValue ?? null,
				newValue: entry.newValue ?? null,
				ipAddress: entry.ipAddress ?? null,
			});
		} catch (error) {
			this.logger.warn(
				`Failed to write audit log for ${entry.action}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}
}
