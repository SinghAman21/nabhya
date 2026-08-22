import { Check, MapPin } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Body, Caption, Label } from "@/components/ui/typography";
import { useTheme } from "@/hooks/useTheme";
import { focusable } from "@/lib/focus";

/**
 * City scope for the feed.
 *
 * Item donation and volunteering are physically local — nobody hands 20 blankets
 * to an NGO 900km away — so a nationwide feed is mostly noise for any single
 * user. But it is never scoped *silently*: the current city is always on screen
 * and "All India" is always one tap away, because a feed that quietly hides
 * things reads as broken.
 *
 * The default comes from the user's profile city (set at onboarding), not from
 * GPS. No permission prompt, no `expo-location` dependency, and the answer is
 * usually better — people know where they can actually turn up.
 *
 * Known data problem: `organization_needs.city` is free text, so "Mumbai",
 * "mumbai" and "Bombay" are three cities to the query. The list below is a
 * stopgap; the real fix is a canonical city table, or at least a normalising
 * write path.
 */

export const ALL_INDIA = "";

const METROS = [
	"Mumbai",
	"Pune",
	"Delhi",
	"Bengaluru",
	"Hyderabad",
	"Chennai",
	"Kolkata",
	"Ahmedabad",
	"Jaipur",
	"Nagpur",
];

type PressState = { pressed: boolean; hovered?: boolean };

export function CityPicker({
	value,
	onChange,
	homeCity,
}: {
	/** `ALL_INDIA` (empty string) means unscoped. */
	value: string;
	onChange: (city: string) => void;
	/** The user's profile city, pinned to the top of the list. */
	homeCity?: string | null;
}) {
	const { colors, spacing, borderRadius, elevation, isDark } = useTheme();
	const [open, setOpen] = useState(false);

	const options = [
		...(homeCity && !METROS.includes(homeCity) ? [homeCity] : []),
		...METROS,
	];

	const trigger = (
		<Pressable
			onPress={() => setOpen((o) => !o)}
			accessibilityRole="button"
			accessibilityLabel={`Location: ${value || "All India"}`}
			accessibilityState={{ expanded: open }}
			{...focusable}
			style={(state) => {
				const { pressed, hovered } = state as PressState;
				return {
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[2],
					height: 38,
					paddingHorizontal: spacing[3],
					borderRadius: 999,
					borderWidth: 1,
					borderColor: colors.border.medium,
					backgroundColor:
						open || pressed || hovered
							? colors.background.subtle
							: "transparent",
				};
			}}
		>
			<MapPin
				size={15}
				color={colors.text.tertiary as string}
				strokeWidth={1.9}
			/>
			<Caption weight="medium">{value || "All India"}</Caption>
		</Pressable>
	);

	if (!open) return trigger;

	return (
		<View>
			{trigger}

			<Pressable
				onPress={() => setOpen(false)}
				accessibilityLabel="Close location picker"
				style={{
					position: "absolute",
					top: -2000,
					left: -2000,
					right: -2000,
					bottom: -2000,
					zIndex: 40,
				}}
			/>

			<View
				style={{
					position: "absolute",
					top: 44,
					left: 0,
					width: 240,
					zIndex: 50,
					backgroundColor: colors.background.card,
					borderRadius: borderRadius.lg,
					borderWidth: isDark ? 1 : 0,
					borderColor: colors.border.hairline,
					overflow: "hidden",
					...(isDark ? {} : elevation.raised),
				}}
			>
				<View
					style={{
						paddingHorizontal: spacing[4],
						paddingVertical: spacing[3],
						borderBottomWidth: 1,
						borderBottomColor: colors.border.hairline,
					}}
				>
					<Label weight="semibold">Show posts from</Label>
				</View>

				<ScrollView style={{ maxHeight: 320 }}>
					<Option
						label="All India"
						selected={value === ALL_INDIA}
						onPress={() => {
							onChange(ALL_INDIA);
							setOpen(false);
						}}
					/>
					{options.map((city) => (
						<Option
							key={city}
							label={city}
							hint={city === homeCity ? "Your city" : undefined}
							selected={value === city}
							onPress={() => {
								onChange(city);
								setOpen(false);
							}}
						/>
					))}
				</ScrollView>
			</View>
		</View>
	);
}

function Option({
	label,
	hint,
	selected,
	onPress,
}: {
	label: string;
	hint?: string;
	selected: boolean;
	onPress: () => void;
}) {
	const { colors, spacing } = useTheme();

	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="menuitem"
			accessibilityState={{ selected }}
			{...focusable}
			style={(state) => {
				const { pressed, hovered } = state as PressState;
				return {
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[2],
					paddingHorizontal: spacing[4],
					paddingVertical: spacing[2.5],
					backgroundColor:
						pressed || hovered ? colors.background.subtle : "transparent",
				};
			}}
		>
			<View style={{ flex: 1 }}>
				<Body weight={selected ? "semibold" : "normal"}>{label}</Body>
				{hint && <Caption color="quaternary">{hint}</Caption>}
			</View>
			{selected && (
				<Check size={16} color={colors.primary.ink} strokeWidth={2.2} />
			)}
		</Pressable>
	);
}
