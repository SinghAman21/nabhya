import { InternalServerErrorException } from "@nestjs/common";

/**
 * Unwraps the single row an INSERT/UPDATE ... RETURNING or a locked SELECT is
 * guaranteed to produce.
 *
 * Drizzle types these as arrays, so with `noUncheckedIndexedAccess` every call
 * site would otherwise need a non-null assertion. Throwing here keeps the
 * invariant explicit instead of silently propagating `undefined`.
 */
export function takeFirstOrThrow<T>(rows: T[], context: string): T {
	const row = rows[0];
	if (row === undefined) {
		throw new InternalServerErrorException(
			`Expected a row while performing: ${context}`,
		);
	}
	return row;
}
