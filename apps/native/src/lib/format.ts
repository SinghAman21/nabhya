const DATE_TIME = new Intl.DateTimeFormat("en-IN", {
	day: "numeric",
	month: "short",
	hour: "numeric",
	minute: "2-digit",
});

const DATE_ONLY = new Intl.DateTimeFormat("en-IN", {
	day: "numeric",
	month: "short",
	year: "numeric",
});

const TIME_ONLY = new Intl.DateTimeFormat("en-IN", {
	hour: "numeric",
	minute: "2-digit",
});

function toDate(value: string | Date | null | undefined): Date | null {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: string | Date | null | undefined): string {
	const date = toDate(value);
	return date ? DATE_ONLY.format(date) : "—";
}

export function formatDateTime(
	value: string | Date | null | undefined,
): string {
	const date = toDate(value);
	return date ? DATE_TIME.format(date) : "—";
}

/** "12 Mar, 9:00 am – 1:00 pm" when same day, otherwise both dates in full. */
export function formatDateRange(
	start: string | Date | null | undefined,
	end: string | Date | null | undefined,
): string {
	const from = toDate(start);
	const to = toDate(end);
	if (!from) return "—";
	if (!to) return DATE_TIME.format(from);

	const sameDay = from.toDateString() === to.toDateString();
	return sameDay
		? `${DATE_TIME.format(from)} – ${TIME_ONLY.format(to)}`
		: `${DATE_TIME.format(from)} → ${DATE_TIME.format(to)}`;
}

/** Compact "in 3 days" / "2 hours ago" label for feed cards. */
export function formatRelative(
	value: string | Date | null | undefined,
): string {
	const date = toDate(value);
	if (!date) return "—";

	const diffMs = date.getTime() - Date.now();
	const absMs = Math.abs(diffMs);
	const minute = 60_000;
	const hour = 60 * minute;
	const day = 24 * hour;

	const units: Array<[number, Intl.RelativeTimeFormatUnit]> = [
		[day, "day"],
		[hour, "hour"],
		[minute, "minute"],
	];

	const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

	for (const [ms, unit] of units) {
		if (absMs >= ms) {
			return formatter.format(Math.round(diffMs / ms), unit);
		}
	}
	return "just now";
}

/** "12 of 40 blankets" progress label. */
export function formatProgress(
	fulfilled: number,
	quantity: number | null,
	unit: string | null,
): string {
	const suffix = unit ? ` ${unit}` : "";
	if (quantity === null) return `${fulfilled}${suffix} committed`;
	return `${fulfilled} of ${quantity}${suffix}`;
}
