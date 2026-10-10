import { type AnyColumn, asc, desc, type SQL } from "drizzle-orm";

/**
 * `ORDER BY` for a list the client can sort.
 *
 * The NGO's own lists (events, needs, donations) page at 20, so a sort has to
 * happen here - re-ordering the rows already in the browser sorts a page, not
 * the list. Each list maps its `sort` keys to a column (or a correlated count)
 * and names its default column; this turns that into the clause.
 *
 * Two tiebreakers follow the chosen key, and both matter. Without them a sort
 * on a low-cardinality column (status, urgency, "anonymous") leaves Postgres
 * free to return equal rows in any order, and `OFFSET` paging over an unstable
 * order repeats some rows and skips others. The list's default column comes
 * first, so ties read in the order the screen shows by default; the primary
 * key comes last, because two rows inserted in one transaction share a
 * timestamp too.
 *
 * Same shape as `orderFor` in `AdminService`, which keeps its own copy.
 *
 * `columns[sort]` is undefined only for a call that bypassed the validation
 * pipe (the enum rejects unknown keys) - that falls back to the default.
 */
export function orderBySort<K extends string>(
	sort: K | undefined,
	dir: "asc" | "desc" | undefined,
	columns: Record<K, AnyColumn | SQL>,
	fallback: { column: AnyColumn; dir: "asc" | "desc" },
	id: AnyColumn,
): SQL[] {
	const direction = dir === "asc" ? asc : desc;
	const byDefault = fallback.dir === "asc" ? asc : desc;
	const column = sort ? columns[sort] : undefined;

	if (!column) return [byDefault(fallback.column), desc(id)];
	if (column === fallback.column) return [direction(column), desc(id)];
	return [direction(column), byDefault(fallback.column), desc(id)];
}
