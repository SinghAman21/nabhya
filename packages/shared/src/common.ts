import { z } from "zod";

/**
 * Cursorless offset pagination. Every list endpoint accepts these and returns
 * a `Paginated<T>` envelope so the client can render the same footer everywhere.
 */
export const paginationQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface PaginationMeta {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
	hasMore: boolean;
}

export interface Paginated<T> {
	items: T[];
	meta: PaginationMeta;
}

export const uuidParamSchema = z.object({
	id: z.uuid("Invalid identifier"),
});

/**
 * Trim-then-treat-blank-as-undefined, for optional free-text fields.
 *
 * `.optional()` must come last: applied before `.transform()` the inferred
 * output keeps the key required (typed `string | undefined`), which forces
 * every caller to pass it explicitly.
 */
export const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max, `Must be under ${max} characters`)
		.transform((v) => (v === "" ? undefined : v))
		.optional();

export const sortOrderSchema = z.enum(["asc", "desc"]).default("desc");
