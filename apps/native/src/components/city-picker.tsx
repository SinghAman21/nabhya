import { ChevronDown, MapPin } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { Sheet, SheetOption } from "@/components/ui/sheet";
import { Caption, H4 } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
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
 * The trigger is a chip, sized to sit in the cause row; the choice opens in the
 * shared `Sheet`. An absolutely-positioned dropdown was clipped by the sticky
 * header and by every card below it.
 *
 * Known data problem: `needs.city` is free text, so "Mumbai",
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

export function CityPicker({
	value,
	onChange,
	homeCity,
	variant = "chip",
}: {
	/** `ALL_INDIA` (empty string) means unscoped. */
	value: string;
	onChange: (city: string) => void;
	/** The user's profile city, pinned to the top of the list. */
	homeCity?: string | null;
	/**
	 * `chip` sits in a filter row. `title` is the home screen's top-left
	 * control: the city *is* the page title, the way a delivery app leads with
	 * the address, so the header needs no separate "Home" word.
	 */
	variant?: "chip" | "title";
}) {
	const { colors, spacing } = useTheme();
	const [open, setOpen] = useState(false);

	const options = [
		...(homeCity && !METROS.includes(homeCity) ? [homeCity] : []),
		...METROS,
	];

	const pick = (city: string) => {
		onChange(city);
		setOpen(false);
	};

	const label = value || "All India";

	return (
		<>
			{variant === "title" ? (
				<Pressable
					onPress={() => setOpen(true)}
					accessibilityRole="button"
					accessibilityLabel={`Location: ${label}. Change`}
					hitSlop={8}
					{...focusable}
					style={({ pressed }) => ({
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[1],
						minHeight: 40,
						opacity: pressed ? 0.6 : 1,
					})}
				>
					<MapPin
						size={18}
						color={colors.primary.ink as string}
						strokeWidth={2.2}
					/>
					<H4 numberOfLines={1} style={{ maxWidth: 200 }}>
						{label}
					</H4>
					<ChevronDown
						size={18}
						color={colors.text.tertiary as string}
						strokeWidth={2.2}
					/>
				</Pressable>
			) : (
				<Pressable
					onPress={() => setOpen(true)}
					accessibilityRole="button"
					accessibilityLabel={`Location: ${label}`}
					{...focusable}
					style={({ pressed }) => ({
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[1.5],
						minHeight: 32,
						paddingLeft: spacing[2.5],
						paddingRight: spacing[2],
						borderRadius: 999,
						// backgroundColor: pressed
						// 	? colors.background.tertiary
						// 	: colors.background.subtle,
					})}
				>
					<MapPin
						size={13}
						color={colors.primary.ink as string}
						strokeWidth={2.2}
					/>
					<Caption
						weight="semibold"
						numberOfLines={1}
						style={{ maxWidth: 110 }}
					>
						{label}
					</Caption>
					<ChevronDown
						size={13}
						color={colors.text.tertiary as string}
						strokeWidth={2.2}
					/>
				</Pressable>
			)}

			<Sheet
				visible={open}
				onClose={() => setOpen(false)}
				title="Show posts from"
				subtitle="Volunteering is local. Pick where you can actually turn up."
			>
				<View style={{ paddingBottom: spacing[2] }}>
					<SheetOption
						label="All India"
						selected={value === ALL_INDIA}
						onPress={() => pick(ALL_INDIA)}
					/>
					{options.map((city) => (
						<SheetOption
							key={city}
							label={city}
							hint={city === homeCity ? "Your city" : undefined}
							selected={value === city}
							onPress={() => pick(city)}
						/>
					))}
				</View>
			</Sheet>
		</>
	);
}
