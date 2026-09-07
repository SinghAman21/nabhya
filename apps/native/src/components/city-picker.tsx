import {
	ChevronDown,
	LocateFixed,
	MapPin,
	Search,
	X,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, TextInput, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { Sheet, SheetOption } from "@/components/ui/sheet";
import { Caption, H4, Label } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { CITY_SUGGESTIONS, nearestCity, normaliseCityName } from "@/lib/cities";
import { focusable } from "@/lib/focus";
import { placeParts, requestPosition, reverseGeocode } from "@/lib/location";

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
 * GPS. The picker also offers an explicit foreground-location action for users
 * who want nearby results without silently requesting permission.
 *
 * The trigger is a chip, sized to sit in the cause row; the choice opens in the
 * shared `Sheet`. An absolutely-positioned dropdown was clipped by the sticky
 * header and by every card below it.
 *
 * Known data problem: `needs.city` is free text, so "Mumbai",
 * "mumbai" and "Bombay" are three cities to the query. The city list and the
 * alias/case normalisation now live in `lib/cities.ts`, shared with the two
 * onboarding wizards — this picker filters a feed, they write the rows the
 * feed filters, and the two disagreeing about a spelling is exactly how a
 * city ends up with nothing in it. The real fix is still server-side: a
 * canonical city table, or a normalising write path.
 */

export const ALL_INDIA = "";

/** The picker's own shortlist: the metros most rows are actually in. */
const METROS = CITY_SUGGESTIONS.slice(0, 12);

export function CityPicker({
	value,
	onChange,
	onDetectedCity,
	homeCity,
	variant = "chip",
}: {
	/** `ALL_INDIA` (empty string) means unscoped. */
	value: string;
	onChange: (city: string) => void;
	onDetectedCity?: (city: string) => void;
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
	const [search, setSearch] = useState("");
	const [detecting, setDetecting] = useState(false);
	const [locationError, setLocationError] = useState<string | null>(null);

	const options = useMemo(
		() => [
			...(homeCity && !METROS.includes(homeCity) ? [homeCity] : []),
			...METROS,
		],
		[homeCity],
	);
	const filteredOptions = useMemo(() => {
		const query = search.trim().toLowerCase();
		return query
			? options.filter((city) => city.toLowerCase().includes(query))
			: options;
	}, [options, search]);

	const pick = (city: string) => {
		onChange(city);
		setSearch("");
		setLocationError(null);
		setOpen(false);
	};

	const detectLocation = async () => {
		setDetecting(true);
		setLocationError(null);
		try {
			// Never gated on a permission *query* — on the web that answers
			// "prompt" without asking, so this used to fail instantly having
			// never shown the browser's dialog. See `lib/location.ts`.
			const position = await requestPosition();
			if (position.status === "denied") {
				setLocationError(
					"Location access is off. Choose a city below instead.",
				);
				return;
			}
			if (position.status === "failed") {
				setLocationError(
					"Could not detect your location. Choose a city below.",
				);
				return;
			}

			const place = await reverseGeocode(position.latitude, position.longitude);
			const named = place ? placeParts(place).city : null;
			// The geocoder's spelling is not ours: it returns "Bombay" and
			// "bengaluru" depending on the device, and either one filters the feed
			// down to nothing. With no name at all, fall back to the nearest city
			// we know — the web has no reverse geocoding to begin with.
			const city = named
				? normaliseCityName(named)
				: (nearestCity(position.latitude, position.longitude)?.city ?? null);

			if (!city) {
				setLocationError("We found you, but could not name this city.");
				return;
			}

			pick(city);
			onDetectedCity?.(city);
		} finally {
			setDetecting(false);
		}
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
				title="Choose your location"
				subtitle="Find volunteer opportunities you can actually reach."
			>
				<View style={{ paddingBottom: spacing[2], gap: spacing[5] }}>
					<Pressable
						onPress={detectLocation}
						disabled={detecting}
						accessibilityRole="button"
						accessibilityLabel="Use my current location"
						accessibilityState={{ busy: detecting, disabled: detecting }}
						style={({ pressed }) => ({
							flexDirection: "row",
							alignItems: "center",
							gap: spacing[3],
							padding: spacing[4],
							borderRadius: 16,
							backgroundColor: pressed
								? colors.primary.tint
								: colors.background.subtle,
						})}
					>
						<View
							style={{
								width: 40,
								height: 40,
								borderRadius: 20,
								alignItems: "center",
								justifyContent: "center",
								backgroundColor: colors.primary.tint,
							}}
						>
							{detecting ? (
								<ActivityIndicator color={colors.primary.ink as string} />
							) : (
								<LocateFixed
									size={20}
									color={colors.primary.ink as string}
									strokeWidth={2}
								/>
							)}
						</View>
						<View style={{ flex: 1, gap: 2 }}>
							<Label weight="semibold">Use my current location</Label>
							<Caption color="tertiary">
								{detecting
									? "Finding your city..."
									: "Best for nearby opportunities"}
							</Caption>
						</View>
					</Pressable>

					{locationError && (
						<Caption color="error" style={{ marginTop: -spacing[3] }}>
							{locationError}
						</Caption>
					)}

					<View style={{ gap: spacing[2] }}>
						<Caption color="tertiary">Search for a city</Caption>
						<View
							style={{
								flexDirection: "row",
								alignItems: "center",
								gap: spacing[2.5],
								height: 46,
								paddingHorizontal: spacing[3.5],
								borderRadius: 12,
								backgroundColor: colors.background.subtle,
							}}
						>
							<Search
								size={18}
								color={colors.text.quaternary as string}
								strokeWidth={1.9}
							/>
							<TextInput
								value={search}
								onChangeText={setSearch}
								placeholder="Search cities"
								placeholderTextColor={colors.text.quaternary as string}
								returnKeyType="search"
								accessibilityLabel="Search cities"
								style={{
									flex: 1,
									fontFamily: "MonaSans",
									fontSize: 15,
									color: colors.text.primary as string,
									paddingVertical: 0,
								}}
							/>
							{search.length > 0 && (
								<Pressable
									onPress={() => setSearch("")}
									accessibilityRole="button"
									accessibilityLabel="Clear city search"
									hitSlop={8}
								>
									<X size={16} color={colors.text.tertiary as string} />
								</Pressable>
							)}
						</View>
					</View>

					<View style={{ gap: spacing[2] }}>
						<Caption color="tertiary">
							{search.trim() ? "Matching cities" : "Popular cities"}
						</Caption>
						{search.trim() && filteredOptions.length === 0 ? (
							<Caption color="quaternary">No matching city found.</Caption>
						) : (
							filteredOptions.map((city) => (
								<SheetOption
									key={city}
									label={city}
									hint={city === homeCity ? "Your city" : undefined}
									selected={value === city}
									onPress={() => pick(city)}
								/>
							))
						)}
					</View>

					<SheetOption
						label="All India"
						hint="Show opportunities everywhere"
						selected={value === ALL_INDIA}
						onPress={() => pick(ALL_INDIA)}
					/>
				</View>
			</Sheet>
		</>
	);
}
