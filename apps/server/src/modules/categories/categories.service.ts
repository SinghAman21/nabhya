import type { db as dbType } from "@nabhya/db";
import { categories } from "@nabhya/db/schema";
import type { CreateCategoryInput, UpdateCategoryInput } from "@nabhya/shared";
import {
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { asc, eq } from "drizzle-orm";
import { AuditService } from "../../common/audit";
import { DB_TOKEN } from "../../common/database";

@Injectable()
export class CategoriesService {
	constructor(
		@Inject(DB_TOKEN) private readonly db: typeof dbType,
		@Inject(AuditService) private readonly audit: AuditService,
	) {}

	/** Cause list used by org profiles and volunteer interest selection. */
	listActive() {
		return this.db.query.categories.findMany({
			where: eq(categories.isActive, true),
			orderBy: asc(categories.name),
			columns: {
				id: true,
				name: true,
				slug: true,
				description: true,
				icon: true,
			},
		});
	}

	listAll() {
		return this.db.query.categories.findMany({ orderBy: asc(categories.name) });
	}

	async create(adminId: string, input: CreateCategoryInput) {
		try {
			const [created] = await this.db
				.insert(categories)
				.values({
					name: input.name,
					slug: input.slug,
					description: input.description ?? null,
					icon: input.icon ?? null,
				})
				.returning();
			if (!created) throw new Error("Category insert returned no row");
			void this.audit.record({
				performedBy: adminId,
				action: "CATEGORY_CREATED",
				entityName: "CATEGORY",
				entityId: created.id,
				newValue: created,
			});
			return created;
		} catch (error) {
			if (isUniqueViolation(error)) {
				throw new ConflictException(
					"A category with this slug already exists.",
				);
			}
			throw error;
		}
	}

	async update(adminId: string, id: string, input: UpdateCategoryInput) {
		const existing = await this.db.query.categories.findFirst({
			where: eq(categories.id, id),
		});
		if (!existing) throw new NotFoundException("Category not found");

		try {
			const [updated] = await this.db
				.update(categories)
				.set({ ...input, updatedAt: new Date() })
				.where(eq(categories.id, id))
				.returning();
			if (!updated) throw new NotFoundException("Category not found");
			void this.audit.record({
				performedBy: adminId,
				action: "CATEGORY_UPDATED",
				entityName: "CATEGORY",
				entityId: id,
				oldValue: existing,
				newValue: updated,
			});
			return updated;
		} catch (error) {
			if (isUniqueViolation(error)) {
				throw new ConflictException(
					"A category with this slug already exists.",
				);
			}
			throw error;
		}
	}

	async archive(adminId: string, id: string) {
		const [archived] = await this.db
			.update(categories)
			.set({ isActive: false, updatedAt: new Date() })
			.where(eq(categories.id, id))
			.returning();
		if (!archived) throw new NotFoundException("Category not found");
		void this.audit.record({
			performedBy: adminId,
			action: "CATEGORY_ARCHIVED",
			entityName: "CATEGORY",
			entityId: id,
			newValue: archived,
		});
		return archived;
	}
}

function isUniqueViolation(error: unknown): boolean {
	const seen = new Set<object>();
	let current = error;
	while (typeof current === "object" && current !== null) {
		if (seen.has(current)) return false;
		seen.add(current);
		if ("code" in current && (current as { code?: unknown }).code === "23505") {
			return true;
		}
		current = "cause" in current ? current.cause : undefined;
	}
	return false;
}
