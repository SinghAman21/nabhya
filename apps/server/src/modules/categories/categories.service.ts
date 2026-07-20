import type { db as dbType } from "@nabhya/db";
import { categories } from "@nabhya/db/schema";
import { Inject, Injectable } from "@nestjs/common";
import { asc, eq } from "drizzle-orm";
import { DB_TOKEN } from "../../common/database";

@Injectable()
export class CategoriesService {
	constructor(@Inject(DB_TOKEN) private readonly db: typeof dbType) {}

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
}
