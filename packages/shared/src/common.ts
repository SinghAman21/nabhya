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

/**
 * Outcome of a bulk action on a selection: which ids succeeded and why each
 * failure failed. Never a bare count - one row in forty can fail on its own
 * (already decided, places filled) and "39 done" leaves the fortieth
 * unexplained. Same contract as the admin queue's `BulkReviewResult`.
 */
export interface BulkResult {
	done: string[];
	failed: Array<{ id: string; reason: string }>;
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
/**
 * An optional free-text field.
 *
 * Empty becomes `null`, not `undefined`, so a partial update can tell "the
 * caller left this alone" (`undefined`, key absent) from "the caller cleared
 * it" (`null`). Collapsing both to `undefined` is why a bio could be set but
 * never removed: every update path skips `undefined` keys.
 */
export const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max, `Must be under ${max} characters`)
		.transform((v) => (v === "" ? null : v))
		.optional();

export const sortOrderSchema = z.enum(["asc", "desc"]).default("desc");

/**
 * A phone number, normalised before it is measured.
 *
 * `min(10).max(15)` on the raw string is a trap the onboarding wizards fell
 * into: their own placeholder, `+91 98765 43210`, is 16 characters, so the
 * example the field showed was rejected by the field. Separators are stripped
 * first, so what the schema counts is digits (plus an optional country code)
 * and the user can type the number however they read it out loud.
 */
export const phoneSchema = z.preprocess(
	(value) =>
		typeof value === "string" ? value.replace(/[\s()\-.]/g, "") : value,
	z
		.string()
		.min(10, "Enter a valid phone number")
		.max(15, "Enter a valid phone number")
		.regex(/^\+?\d{10,14}$/, "Enter a valid phone number"),
);

/**
 * An optional whole number in a range, tolerant of an empty field.
 *
 * A wizard's numeric inputs arrive as `""` while untouched. Zod's `coerce`
 * turns that into `0`, which then fails a `min(1900)` - so a founding year the
 * user deliberately left blank produced "Enter a valid year" on a field marked
 * optional. Blank collapses to `undefined` before any check runs.
 */
export const optionalCount = (
	min: number,
	max: number,
	messages: { min: string; max: string },
) =>
	z.preprocess(
		(value) =>
			value === "" || value === null || Number.isNaN(value as number)
				? undefined
				: value,
		z.coerce
			.number()
			.int("Must be a whole number")
			.min(min, messages.min)
			.max(max, messages.max)
			.optional(),
	);

/** Latitude/longitude captured from the device, both or neither. */
export const latitudeSchema = z.coerce.number().min(-90).max(90);
export const longitudeSchema = z.coerce.number().min(-180).max(180);

/* -------------------------------------------------------------------------- */
/* Step validation                                                            */
/* -------------------------------------------------------------------------- */

/** Field path (`"city"`, `"contact.phone"`) → the first message for it. */
export type FieldErrors = Record<string, string>;

/**
 * A Zod error as a map the UI can index by field name.
 *
 * Only the first issue per field is kept: a field shows one message under it,
 * and "Required" stacked over "Must be at least 2 characters" is noise.
 */
export function fieldErrorMap(error: z.ZodError): FieldErrors {
	const errors: FieldErrors = {};
	for (const issue of error.issues) {
		const key = issue.path.map(String).join(".");
		if (key && !(key in errors)) errors[key] = issue.message;
	}
	return errors;
}

/**
 * Validate one wizard step (or a whole payload) against its schema.
 *
 * The multi-step forms deliberately do not use `zodResolver`: their fields are
 * strings held in a persisted draft - an untouched "Founded in" is `""`, not a
 * number - and a resolver would have to be told the difference between the
 * input shape and the parsed output for every optional numeric field. Parsing
 * the step's payload directly gives the coerced values *and* a field-error map,
 * which is all a step needs.
 */
export function validateStep<Schema extends z.ZodType>(
	schema: Schema,
	value: unknown,
): { ok: true; data: z.output<Schema> } | { ok: false; errors: FieldErrors } {
	const result = schema.safeParse(value);
	return result.success
		? { ok: true, data: result.data }
		: { ok: false, errors: fieldErrorMap(result.error) };
}
