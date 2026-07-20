import type { db as dbType } from "@nabhya/db";
import { notifications, roles, userRoles, users } from "@nabhya/db/schema";
import type {
	BroadcastInput,
	MarkReadInput,
	NotificationQuery,
	NotificationType,
} from "@nabhya/shared";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { DB_TOKEN } from "../../common/database";
import { paginate, toOffset } from "../../common/utils";

export interface NotifyInput {
	userId: string;
	type: NotificationType;
	title: string;
	body?: string;
	entityName?: string;
	entityId?: string;
}

@Injectable()
export class NotificationsService {
	private readonly logger = new Logger(NotificationsService.name);

	constructor(@Inject(DB_TOKEN) private readonly db: typeof dbType) {}

	/**
	 * Fire-and-forget, exactly like the audit trail: a failed notification must
	 * never roll back the action that triggered it. Callers use `void notify(...)`.
	 */
	async notify(input: NotifyInput | NotifyInput[]): Promise<void> {
		const rows = Array.isArray(input) ? input : [input];
		if (rows.length === 0) return;

		try {
			await this.db.insert(notifications).values(
				rows.map((row) => ({
					userId: row.userId,
					type: row.type,
					title: row.title,
					body: row.body ?? null,
					entityName: row.entityName ?? null,
					entityId: row.entityId ?? null,
				})),
			);
		} catch (error) {
			this.logger.warn(
				`Failed to write notification(s): ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	async list(userId: string, query: NotificationQuery) {
		const conditions = [eq(notifications.userId, userId)];
		if (query.unreadOnly) conditions.push(isNull(notifications.readAt));

		const where = and(...conditions);
		const { limit, offset } = toOffset(query);

		const [items, [totals], [unread]] = await Promise.all([
			this.db
				.select()
				.from(notifications)
				.where(where)
				.orderBy(desc(notifications.createdAt))
				.limit(limit)
				.offset(offset),
			this.db.select({ value: count() }).from(notifications).where(where),
			this.db
				.select({ value: count() })
				.from(notifications)
				.where(
					and(eq(notifications.userId, userId), isNull(notifications.readAt)),
				),
		]);

		return {
			...paginate(items, totals?.value ?? 0, query),
			unreadCount: unread?.value ?? 0,
		};
	}

	async unreadCount(userId: string) {
		const [row] = await this.db
			.select({ value: count() })
			.from(notifications)
			.where(
				and(eq(notifications.userId, userId), isNull(notifications.readAt)),
			);
		return { unreadCount: row?.value ?? 0 };
	}

	/** Marks the given ids read, or everything when no ids are supplied. */
	async markRead(userId: string, input: MarkReadInput) {
		const conditions = [
			eq(notifications.userId, userId),
			isNull(notifications.readAt),
		];
		if (input.ids?.length) {
			conditions.push(inArray(notifications.id, input.ids));
		}

		await this.db
			.update(notifications)
			.set({ readAt: new Date() })
			.where(and(...conditions));

		return this.unreadCount(userId);
	}

	/**
	 * Superadmin blast. Fans out into one row per recipient so read state works
	 * per person; inserted in chunks to keep the statement size sane.
	 */
	async broadcast(adminId: string, input: BroadcastInput) {
		const recipients = await this.resolveAudience(input.audience);

		const CHUNK = 500;
		for (let i = 0; i < recipients.length; i += CHUNK) {
			await this.notify(
				recipients.slice(i, i + CHUNK).map((userId) => ({
					userId,
					type: "BROADCAST" as const,
					title: input.title,
					body: input.body,
					entityName: "BROADCAST",
					entityId: adminId,
				})),
			);
		}

		return { delivered: recipients.length };
	}

	private async resolveAudience(audience: BroadcastInput["audience"]) {
		if (audience === "ALL") {
			const rows = await this.db
				.select({ id: users.id })
				.from(users)
				.where(eq(users.status, "ACTIVE"));
			return rows.map((row) => row.id);
		}

		const roleName = audience === "VOLUNTEERS" ? "volunteer" : "organisation";
		const rows = await this.db
			.select({ id: users.id })
			.from(users)
			.where(
				and(
					eq(users.status, "ACTIVE"),
					sql`exists (
						select 1 from ${userRoles}
						join ${roles} on ${roles.id} = ${userRoles.roleId}
						where ${userRoles.userId} = ${users.id} and ${roles.name} = ${roleName}
					)`,
				),
			);
		return rows.map((row) => row.id);
	}
}
