import { relations } from "drizzle-orm";
import { jsonb, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";

// ─── AuditLog Table ──────────────────────────────────────────────────────────
export const auditLogs = pgTable("audit_logs", {
	id: uuid("id").primaryKey().defaultRandom(),
	performedBy: uuid("performed_by").references(() => users.id, {
		onDelete: "set null",
	}),
	action: varchar("action").notNull(), // e.g., REGISTER, LOGIN, LOGOUT, CREATE_ORGANIZATION
	entityName: varchar("entity_name"), // e.g., USER, ORGANIZATION, DOCUMENT, ROLE
	entityId: uuid("entity_id"),
	oldValue: jsonb("old_value"),
	newValue: jsonb("new_value"),
	ipAddress: varchar("ip_address"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Relations ───────────────────────────────────────────────────────────────
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
	actor: one(users, {
		fields: [auditLogs.performedBy],
		references: [users.id],
	}),
}));
