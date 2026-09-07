import DateTimePicker from "@react-native-community/datetimepicker";
import { CalendarDays, Clock3 } from "lucide-react-native";
import { createElement, useState } from "react";
import { Platform, View } from "react-native";
import { Field } from "@/components/form-field";
import { Pressable } from "@/components/ui/pressable";
import { Caption, Label } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { focusable } from "@/lib/focus";

/**
 * Date + time entry, one bar with two halves.
 *
 * Native opens the OS picker from the bar — the date half the calendar, the
 * time half the clock. The community picker renders nothing on web (a stub
 * that only warns), so web renders the browser's own date/time controls in
 * the same bar instead. No typed text anywhere: hand-typed dates were the
 * source of most invalid values here, and a portalled popover cannot clear
 * the composer drawer (see `apps/native/AGENTS.md`).
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
] as const;

export function DateTimeField({
	label,
	value,
	onChange,
	error,
	shortcuts = true,
	hint = "Tap to pick — volunteers see it in their timezone.",
}: {
	label: string;
	value: Date | undefined;
	onChange: (value: Date | undefined) => void;
	error?: string;
	shortcuts?: boolean;
	hint?: string;
}) {
	if (Platform.OS === "web") {
		return (
			<WebDateTimeField
				label={label}
				value={value}
				onChange={onChange}
				error={error}
				shortcuts={shortcuts}
				hint={hint}
			/>
		);
	}
	return (
		<NativeDateTimeField
			label={label}
			value={value}
			onChange={onChange}
			error={error}
			shortcuts={shortcuts}
			hint={hint}
		/>
	);
}

/* -------------------------------------------------------------------------- */
/* Native                                                                     */
/* -------------------------------------------------------------------------- */

function NativeDateTimeField({
	label,
	value,
	onChange,
	error,
	shortcuts,
	hint,
}: {
	label: string;
	value: Date | undefined;
	onChange: (value: Date | undefined) => void;
	error?: string;
	shortcuts: boolean;
	hint: string;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	const [open, setOpen] = useState<"date" | "time" | null>(null);

	const base = value ?? new Date();

	const apply = (mode: "date" | "time", picked: Date | undefined) => {
		if (Platform.OS !== "ios") setOpen(null);
		if (!picked) return;
		if (mode === "date") {
			const next = new Date(value ?? new Date());
			next.setFullYear(
				picked.getFullYear(),
				picked.getMonth(),
				picked.getDate(),
			);
			// A fresh field has no time yet — 10:00, matching the shortcuts.
			if (!value) next.setHours(10, 0, 0, 0);
			onChange(next);
			// After a day, offer the clock straight away.
			setOpen("time");
		} else {
			const next = new Date(value ?? new Date());
			next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
			onChange(next);
		}
	};

	const bar = {
		flexDirection: "row" as const,
		alignItems: "center" as const,
		gap: spacing[2],
		borderRadius: borderRadius.md,
		backgroundColor: colors.background.tertiary,
		paddingVertical: spacing[3.5],
		paddingHorizontal: spacing[3.5],
	};

	return (
		<Field label={label} hint={error ? undefined : hint} error={error}>
			<View style={{ flexDirection: "row", gap: spacing[2.5] }}>
				<Pressable
					onPress={() => setOpen("date")}
					accessibilityRole="button"
					accessibilityLabel={`${label}, date. ${value ? formatDate(value) : "No date chosen"}. Tap to pick.`}
					accessibilityState={{ expanded: open === "date" }}
					{...focusable}
					style={({ pressed, hovered }) => ({
						...bar,
						flex: 1.5,
						backgroundColor:
							pressed || hovered || open === "date"
								? colors.background.subtle
								: colors.background.tertiary,
					})}
				>
					<CalendarDays
						size={16}
						strokeWidth={2}
						color={
							(open === "date"
								? colors.primary.ink
								: colors.text.tertiary) as string
						}
					/>
					<Label
						numberOfLines={1}
						color={value ? undefined : "quaternary"}
						style={{ flex: 1 }}
					>
						{value ? formatDate(value) : "Pick a date"}
					</Label>
				</Pressable>

				<Pressable
					onPress={() => setOpen("time")}
					accessibilityRole="button"
					accessibilityLabel={`${label}, time. ${value ? formatTime(value) : "No time chosen"}. Tap to pick.`}
					accessibilityState={{ expanded: open === "time" }}
					{...focusable}
					style={({ pressed, hovered }) => ({
						...bar,
						flex: 1,
						backgroundColor:
							pressed || hovered || open === "time"
								? colors.background.subtle
								: colors.background.tertiary,
					})}
				>
					<Clock3
						size={16}
						strokeWidth={2}
						color={
							(open === "time"
								? colors.primary.ink
								: colors.text.tertiary) as string
						}
					/>
					<Label
						numberOfLines={1}
						color={value ? undefined : "quaternary"}
						style={{ flex: 1 }}
					>
						{value ? formatTime(value) : "HH:MM"}
					</Label>
				</Pressable>
			</View>

			{open && (
				<View style={{ marginTop: spacing[2] }}>
					<DateTimePicker
						value={base}
						mode={open}
						display={Platform.OS === "ios" ? "inline" : "default"}
						is24Hour
						onChange={(event, picked) => {
							if (event.type === "dismissed") {
								setOpen(null);
								return;
							}
							apply(open, picked);
						}}
					/>
					{Platform.OS === "ios" && (
						<Pressable
							onPress={() => setOpen(null)}
							accessibilityRole="button"
							accessibilityLabel="Done picking date and time"
							hitSlop={8}
							style={{ alignSelf: "flex-end", marginTop: spacing[1] }}
						>
							<Caption weight="semibold" color={colors.primary.ink}>
								Done
							</Caption>
						</Pressable>
					)}
				</View>
			)}

			<Shortcuts visible={shortcuts} label={label} onPick={onChange} />
		</Field>
	);
}

/* -------------------------------------------------------------------------- */
/* Web — the browser's own controls in the same bar                           */
/* -------------------------------------------------------------------------- */

function WebDateTimeField({
	label,
	value,
	onChange,
	error,
	shortcuts,
	hint,
}: {
	label: string;
	value: Date | undefined;
	onChange: (value: Date | undefined) => void;
	error?: string;
	shortcuts: boolean;
	hint: string;
}) {
	const { colors, spacing, borderRadius, isDark } = useTheme();

	const pickDate = (iso: string) => {
		if (!iso) return;
		const [y, m, d] = iso.split("-").map(Number);
		if (!y || !m || !d) return;
		const next = new Date(value ?? new Date());
		next.setFullYear(y, m - 1, d);
		if (!value) next.setHours(10, 0, 0, 0);
		onChange(next);
	};

	const pickTime = (hm: string) => {
		if (!hm) return;
		const [h, min] = hm.split(":").map(Number);
		if (h === undefined || min === undefined || Number.isNaN(h)) return;
		const next = new Date(value ?? new Date());
		next.setHours(h, min ?? 0, 0, 0);
		onChange(next);
	};

	// Transparent so the bar's own fill shows through; `colorScheme` themes
	// the browser's calendar/clock indicator for dark mode.
	const inputStyle = {
		flex: 1,
		minWidth: 0,
		backgroundColor: "transparent",
		borderWidth: 0,
		outlineStyle: "none" as const,
		fontFamily: "MonaSans",
		fontSize: 15,
		color: colors.text.primary as string,
		colorScheme: isDark ? "dark" : "light",
	};

	return (
		<Field label={label} hint={error ? undefined : hint} error={error}>
			<View style={{ flexDirection: "row", gap: spacing[2.5] }}>
				<View
					style={{
						flex: 1.5,
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[2],
						borderRadius: borderRadius.md,
						backgroundColor: colors.background.tertiary,
						paddingVertical: spacing[3.5],
						paddingHorizontal: spacing[3.5],
					}}
				>
					<CalendarDays
						size={16}
						strokeWidth={2}
						color={colors.text.tertiary as string}
					/>
					{createElement("input", {
						type: "date",
						value: value ? toISODate(value) : "",
						onChange: (e: { target: { value: string } }) =>
							pickDate(e.target.value),
						"aria-label": `${label}, date`,
						style: inputStyle,
					})}
				</View>

				<View
					style={{
						flex: 1,
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[2],
						borderRadius: borderRadius.md,
						backgroundColor: colors.background.tertiary,
						paddingVertical: spacing[3.5],
						paddingHorizontal: spacing[3.5],
					}}
				>
					<Clock3
						size={16}
						strokeWidth={2}
						color={colors.text.tertiary as string}
					/>
					{createElement("input", {
						type: "time",
						value: value ? formatTime(value) : "",
						onChange: (e: { target: { value: string } }) =>
							pickTime(e.target.value),
						"aria-label": `${label}, time`,
						style: inputStyle,
					})}
				</View>
			</View>

			<Shortcuts visible={shortcuts} label={label} onPick={onChange} />
		</Field>
	);
}

/* -------------------------------------------------------------------------- */
/* Shared                                                                     */
/* -------------------------------------------------------------------------- */

function Shortcuts({
	visible,
	label,
	onPick,
}: {
	visible: boolean;
	label: string;
	onPick: (value: Date) => void;
}) {
	const { colors, spacing } = useTheme();
	if (!visible) return null;
	return (
		<View
			style={{
				flexDirection: "row",
				flexWrap: "wrap",
				gap: spacing[2],
				marginTop: spacing[2],
			}}
		>
			{[
				{ label: "Tomorrow", days: 1 },
				{ label: "In a week", days: 7 },
				{ label: "In a month", days: 30 },
			].map((shortcut) => (
				<Pressable
					key={shortcut.label}
					onPress={() => {
						const target = new Date();
						target.setDate(target.getDate() + shortcut.days);
						target.setHours(10, 0, 0, 0);
						onPick(target);
					}}
					accessibilityRole="button"
					accessibilityLabel={`${label} ${shortcut.label}, 10:00`}
					hitSlop={6}
					{...focusable}
					style={({ pressed }) => ({
						minHeight: 32,
						justifyContent: "center",
						paddingHorizontal: spacing[3],
						borderRadius: 999,
						borderWidth: 1,
						borderColor: colors.border.medium,
						backgroundColor: pressed ? colors.background.subtle : "transparent",
					})}
				>
					<Caption color="secondary" weight="medium">
						{shortcut.label}
					</Caption>
				</Pressable>
			))}
		</View>
	);
}

export function formatDate(date: Date): string {
	return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatTime(date: Date): string {
	return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function toISODate(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
