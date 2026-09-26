import { z } from "zod";
import { paginationQuerySchema } from "./common";

export const searchScopeSchema = z.enum([
	"all",
	"ngos",
	"need",
	"event",
	"story",
	"post",
]);

export type SearchScope = z.infer<typeof searchScopeSchema>;

/**
 * Shared search box query.
 *
 * `scope` mirrors the app's chips:
 * - `all`   - NGOs + every feed kind
 * - `ngos`  - NGOs only
 * - `need`  - needs only
 * - `event` - events only
 * - `story` - announcements/updates only
 * - `post`  - volunteer/NGO feed posts only
 */
export const searchQuerySchema = paginationQuerySchema.extend({
	search: z.string().trim().min(1, "Search is required").max(120),
	scope: searchScopeSchema.default("all"),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
