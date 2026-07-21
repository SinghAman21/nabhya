import type { Paginated, PaginationQuery } from "@nabhya/shared";

/** Converts a validated `{ page, limit }` into SQL offset/limit. */
export function toOffset({ page, limit }: PaginationQuery) {
	return { limit, offset: (page - 1) * limit };
}

/** Wraps a page of rows in the envelope every list endpoint returns. */
export function paginate<T>(
	items: T[],
	total: number,
	{ page, limit }: PaginationQuery,
): Paginated<T> {
	const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
	return {
		items,
		meta: {
			page,
			limit,
			total,
			totalPages,
			hasMore: page < totalPages,
		},
	};
}
