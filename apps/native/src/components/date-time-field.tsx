import { useEffect, useState } from "react";
import { View } from "react-native";
import { Field, useFieldInputStyle } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Caption } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { focusable } from "@/lib/focus";

/**
 * Dependency-free date + time entry.
 *
 * The project has no date-picker package and shouldn't grow one for this, so
 * this composes two plain inputs (DD/MM/YYYY and 24-hour HH:MM) plus relative
 * shortcuts. It emits a Date only once both halves parse. Renders as a
 * `Field`, so it spaces itself like every other field in the form.
 */
export function DateTimeField({
	label,
	value,
	onChange,
	error,
	shortcuts = true,
}: {
	label: string;
	value: Date | undefined;
	onChange: (value: Date | undefined) => void;
	error?: string;
	shortcuts?: boolean;
}) {
	const { colors, spacing } = useTheme();
	const inputStyle = useFieldInputStyle();
	const [dateText, setDateText] = useState(value ? toDateText(value) : "");
	const [timeText, setTimeText] = useState(value ? toTimeText(value) : "");

	// Keep the inputs in step when a shortcut or a parent reset changes `value`.
	useEffect(() => {
		if (!value) return;
		setDateText(toDateText(value));
		setTimeText(toTimeText(value));
	}, [value]);

	const emit = (nextDate: string, nextTime: string) => {
		onChange(parseDateTime(nextDate, nextTime));
	};

	const applyShortcut = (daysFromNow: number) => {
		const target = new Date();
		target.setDate(target.getDate() + daysFromNow);
		target.setHours(10, 0, 0, 0);
		onChange(target);
	};

	return (
		<Field label={label} error={error} hint="24-hour time, e.g. 09:30">
			<View style={{ flexDirection: "row", gap: spacing[3] }}>
				<View style={{ flex: 1.4 }}>
					<Input
						placeholder="DD/MM/YYYY"
						accessibilityLabel={`${label} date`}
						value={dateText}
						onChangeText={(text) => {
							const masked = maskDate(text);
							setDateText(masked);
							emit(masked, timeText);
						}}
						keyboardType="number-pad"
						maxLength={10}
						style={inputStyle}
					/>
				</View>
				<View style={{ flex: 1 }}>
					<Input
						placeholder="HH:MM"
						accessibilityLabel={`${label} time`}
						value={timeText}
						onChangeText={(text) => {
							const masked = maskTime(text);
							setTimeText(masked);
							emit(dateText, masked);
						}}
						keyboardType="number-pad"
						maxLength={5}
						style={inputStyle}
					/>
				</View>
			</View>

			{shortcuts && (
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
							onPress={() => applyShortcut(shortcut.days)}
							accessibilityRole="button"
							accessibilityLabel={`${shortcut.label}, 10:00`}
							hitSlop={6}
							{...focusable}
							style={({ pressed }) => ({
								minHeight: 32,
								justifyContent: "center",
								paddingHorizontal: spacing[3],
								borderRadius: 999,
								borderWidth: 1,
								borderColor: colors.border.medium,
								backgroundColor: pressed
									? colors.background.subtle
									: "transparent",
							})}
						>
							<Caption color="secondary" weight="medium">
								{shortcut.label}
							</Caption>
						</Pressable>
					))}
				</View>
			)}
		</Field>
	);
}

// ─── Parsing helpers ─────────────────────────────────────────────────────────

function toDateText(date: Date) {
	const day = String(date.getDate()).padStart(2, "0");
	const month = String(date.getMonth() + 1).padStart(2, "0");
	return `${day}/${month}/${date.getFullYear()}`;
}

function toTimeText(date: Date) {
	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");
	return `${hours}:${minutes}`;
}

/** Inserts slashes as the user types digits. */
function maskDate(text: string) {
	const digits = text.replace(/\D/g, "").slice(0, 8);
	const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)];
	return parts.filter(Boolean).join("/");
}

function maskTime(text: string) {
	const digits = text.replace(/\D/g, "").slice(0, 4);
	if (digits.length <= 2) return digits;
	return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}

/**
 * Returns undefined unless both halves are complete and describe a real date —
 * 31/02 and 25:00 are rejected rather than rolled over by the Date constructor.
 */
export function parseDateTime(
	dateText: string,
	timeText: string,
): Date | undefined {
	const dateMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateText);
	const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeText);
	if (!dateMatch || !timeMatch) return undefined;

	const day = Number(dateMatch[1]);
	const month = Number(dateMatch[2]);
	const year = Number(dateMatch[3]);
	const hours = Number(timeMatch[1]);
	const minutes = Number(timeMatch[2]);

	if (hours > 23 || minutes > 59) return undefined;

	const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
	const isReal =
		date.getFullYear() === year &&
		date.getMonth() === month - 1 &&
		date.getDate() === day;

	return isReal ? date : undefined;
}
