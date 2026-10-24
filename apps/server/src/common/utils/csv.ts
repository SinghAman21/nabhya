/**
 * Serialises rows to RFC 4180 CSV.
 *
 * Every cell is quoted, and a cell that a spreadsheet would read as a formula
 * (`=`, `+`, `-`, `@`, tab, CR) is prefixed with an apostrophe. Donor names and
 * messages are typed by the public, and an export opened in Excel would
 * otherwise execute `=HYPERLINK(...)` from a donation message. Numbers are
 * written as numbers, so a negative amount is never mistaken for a formula.
 *
 * A UTF-8 byte-order mark leads the file: without it Excel decodes as the
 * system code page and every Hindi name in the export turns to mojibake.
 */
export function toCsv(
	header: string[],
	rows: Array<Array<string | number | boolean | null | undefined>>,
): string {
	const lines = [header, ...rows].map((row) => row.map(cell).join(","));
	return `\uFEFF${lines.join("\r\n")}\r\n`;
}

function cell(value: string | number | boolean | null | undefined): string {
	if (value === null || value === undefined) return '""';
	if (typeof value === "number" || typeof value === "boolean") {
		return `"${String(value)}"`;
	}
	const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
	return `"${guarded.replaceAll('"', '""')}"`;
}

/** Start of a calendar day in India, as an instant. */
export function istDayStart(day: string): Date {
	return new Date(`${day}T00:00:00+05:30`);
}

/** Start of the day after, so a `to` day is inclusive. */
export function istDayEnd(day: string): Date {
	const start = istDayStart(day);
	return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

/** An IST timestamp for a spreadsheet: `2026-10-23 17:05`. */
export function istTimestamp(value: Date | null): string {
	if (!value) return "";
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Kolkata",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).formatToParts(value);
	const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
	return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}
