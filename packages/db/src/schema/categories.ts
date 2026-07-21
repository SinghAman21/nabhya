import { relations } from "drizzle-orm";
import {
	boolean,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";

// ─── Category Table ──────────────────────────────────────────────────────────
export const categories = pgTable("categories", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: varchar("name").notNull(),
	slug: varchar("slug").unique().notNull(),
	description: text("description"),
	icon: varchar("icon"), // lucide icon name, rendered client-side
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── OrganizationCategory Table (Many-to-Many) ───────────────────────────────
export const organizationCategories = pgTable(
	"organization_categories",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		categoryId: uuid("category_id")
			.notNull()
			.references(() => categories.id, { onDelete: "cascade" }),
		assignedAt: timestamp("assigned_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("organization_categories_org_category_unique").on(
			table.organizationId,
			table.categoryId,
		),
	],
);

// ─── UserCategory Table (volunteer interests) ────────────────────────────────
export const userCategories = pgTable(
	"user_categories",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		categoryId: uuid("category_id")
			.notNull()
			.references(() => categories.id, { onDelete: "cascade" }),
		assignedAt: timestamp("assigned_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("user_categories_user_category_unique").on(
			table.userId,
			table.categoryId,
		),
	],
);

// ─── Relations ───────────────────────────────────────────────────────────────
export const categoriesRelations = relations(categories, ({ many }) => ({
	organizationCategories: many(organizationCategories),
	userCategories: many(userCategories),
}));

export const userCategoriesRelations = relations(userCategories, ({ one }) => ({
	user: one(users, {
		fields: [userCategories.userId],
		references: [users.id],
	}),
	category: one(categories, {
		fields: [userCategories.categoryId],
		references: [categories.id],
	}),
}));

export const organizationCategoriesRelations = relations(
	organizationCategories,
	({ one }) => ({
		organization: one(organizations, {
			fields: [organizationCategories.organizationId],
			references: [organizations.id],
		}),
		category: one(categories, {
			fields: [organizationCategories.categoryId],
			references: [categories.id],
		}),
	}),
);
