import type { LucideIcon } from "lucide-react-native";
import {
	Check,
	ChevronDown,
	Globe,
	House,
	LocateFixed,
	MapPin,
	Plus,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SearchField } from "@/components/search-field";
import { Pressable } from "@/components/ui/pressable";
import { Sheet, SheetFlatList } from "@/components/ui/sheet";
import { Body, Caption, H4, Label } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import {
	CITY_SUGGESTIONS,
	nearestCity,
	normaliseCityName,
	stateForCity,
} from "@/lib/cities";
import { focusable, type PressState } from "@/lib/focus";
import { placeParts, requestPosition, reverseGeocode } from "@/lib/location";

/**
 * City scope for the feed.
 *
 * Item donation and volunteering are physically local - nobody hands 20 blankets
 * to an NGO 900km away - but the feed is never scoped *silently*: the current
 * city is always on screen and "All India" is always the first row of the
 * picker, because a feed that quietly hides things reads as broken.
 *
 * **Nothing here applies a city on the person's behalf.** The home city and
 * "Use my location" are one-tap rows under All India, not defaults; the feed
 * opens on All India until somebody picks (see `store/feed-store.ts`).
 *
 * The list is one scroller with a pinned search field above it: All India,
 * your city, your location, then Popular and every listed city A-Z, each row
 * carrying its state so two similar names are told apart at a glance. A typed
 * city we do not list is still offered ("Use Tezpur") - a volunteer in Tezpur
 * must not be told their town does not exist. On a phone it is the shared
 * `Sheet`; on desktop `Sheet` is a compact centred dialog, which is the right
 * shape for a list this long (an anchored popover would be clipped by the
 * header it hangs from, which is what the very first version of this was).
 *
 * Known data problem: `needs.city` is free text, so "Mumbai", "mumbai" and
 * "Bombay" are three cities to the query. The list and the alias/case
 * normalisation live in `lib/cities.ts`, shared with the onboarding wizards.
 */

export const ALL_INDIA = "";

/** The shortlist: the metros most rows are actually in. */
const POPULAR = CITY_SUGGESTIONS.slice(0, 8);
const ALPHABETICAL = [...CITY_SUGGESTIONS].sort((a, b) => a.localeCompare(b));

type Row =
	| { type: "header"; key: string; label: string }
	| {
			type: "city";
			key: string;
			city: string;
			label: string;
			icon?: LucideIcon;
			trailing?: string;
	  }
	| { type: "locate"; key: string }
	| { type: "note"; key: string; text: string; tone: "error" | "muted" };

export function CityPicker({
	value,
	onChange,
	homeCity,
	variant = "chip",
}: {
	/** `ALL_INDIA` (empty string) means unscoped. */
	value: string;
	onChange: (city: string) => void;
	/** The user's profile city: offered as a row, never applied. */
	homeCity?: string | null;
	/**
	 * `chip` sits in a header row. `title` is a larger top-left control, for a
	 * screen where the city *is* the title.
	 */
	variant?: "chip" | "title";
}) {
	const { colors, spacing } = useTheme();
	const { isDesktop } = useMedia();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [detecting, setDetecting] = useState(false);
	const [locationError, setLocationError] = useState<string | null>(null);

	const home = homeCity ? normaliseCityName(homeCity) : null;

	const rows = useMemo<Row[]>(() => {
		const term = query.trim().toLowerCase();
		const allIndia: Row = {
			type: "city",
			key: "all",
			city: ALL_INDIA,
			label: "All India",
			icon: Globe,
			trailing: "Every city",
		};

		if (term) {
			const prefix: string[] = [];
			const contains: string[] = [];
			for (const city of CITY_SUGGESTIONS) {
				const lower = city.toLowerCase();
				if (lower.startsWith(term)) prefix.push(city);
				else if (lower.includes(term)) contains.push(city);
			}
			// "bombay" finds Mumbai: the alias table is what normalising knows.
			const alias = normaliseCityName(query);
			const matches = [
				...new Set([
					...prefix,
					...(CITY_SUGGESTIONS.includes(alias) ? [alias] : []),
					...contains,
				]),
			];
			const exact = matches.some((city) => city.toLowerCase() === term);
			return [
				allIndia,
				{ type: "header", key: "h-match", label: "Matching cities" },
				...matches.map(
					(city): Row => ({
						type: "city",
						key: `m-${city}`,
						city,
						label: city,
						trailing: stateForCity(city) ?? undefined,
					}),
				),
				...(exact || !alias
					? []
					: [
							{
								type: "city",
								key: "typed",
								city: alias,
								label: `Use "${alias}"`,
								icon: Plus,
							} as Row,
						]),
			];
		}

		return [
			allIndia,
			...(home
				? [
						{
							type: "city",
							key: "home",
							city: home,
							label: home,
							icon: House,
							trailing: "Your city",
						} as Row,
					]
				: []),
			{ type: "locate", key: "locate" },
			...(locationError
				? [
						{
							type: "note",
							key: "loc-error",
							text: locationError,
							tone: "error",
						} as Row,
					]
				: []),
			{ type: "header", key: "h-popular", label: "Popular" },
			...POPULAR.map(
				(city): Row => ({
					type: "city",
					key: `p-${city}`,
					city,
					label: city,
					trailing: stateForCity(city) ?? undefined,
				}),
			),
			{ type: "header", key: "h-all", label: "All cities" },
			...ALPHABETICAL.map(
				(city): Row => ({
					type: "city",
					key: `a-${city}`,
					city,
					label: city,
					trailing: stateForCity(city) ?? undefined,
				}),
			),
		];
	}, [query, home, locationError]);

	const close = () => {
		setOpen(false);
		setQuery("");
		setLocationError(null);
	};

	const pick = (city: string) => {
		onChange(city);
		close();
	};

	const detectLocation = async () => {
		setDetecting(true);
		setLocationError(null);
		try {
			// Never gated on a permission *query* - on the web that answers
			// "prompt" without asking. See `lib/location.ts`.
			const position = await requestPosition();
			if (position.status === "denied") {
				setLocationError("Location access is off. Pick a city instead.");
				return;
			}
			if (position.status === "failed") {
				setLocationError("Could not find your location. Pick a city instead.");
				return;
			}

			const place = await reverseGeocode(position.latitude, position.longitude);
			const named = place ? placeParts(place).city : null;
			// The geocoder's spelling is not ours ("Bombay", "bengaluru"), and
			// the web has no reverse geocoding at all - fall back to the nearest
			// city we list.
			const city = named
				? normaliseCityName(named)
				: (nearestCity(position.latitude, position.longitude)?.city ?? null);

			if (!city) {
				setLocationError("We found you, but not a city we list nearby.");
				return;
			}
			pick(city);
		} finally {
			setDetecting(false);
		}
	};

	const label = value || "All India";

	const renderRow = ({ item }: { item: Row }) => {
		switch (item.type) {
			case "header":
				return (
					<Caption
						weight="semibold"
						color="tertiary"
						style={{
							paddingHorizontal: spacing[3],
							paddingTop: spacing[5],
							paddingBottom: spacing[1.5],
						}}
					>
						{item.label}
					</Caption>
				);
			case "note":
				return (
					<Caption
						color={
							item.tone === "error"
								? (colors.error.ink as string)
								: "quaternary"
						}
						style={{
							paddingHorizontal: spacing[3],
							paddingLeft: spacing[3] + 20 + spacing[3],
							paddingBottom: spacing[2],
						}}
					>
						{item.text}
					</Caption>
				);
			case "locate":
				return (
					<CityRow
						label={detecting ? "Finding your city..." : "Use my location"}
						icon={LocateFixed}
						accent
						busy={detecting}
						onPress={detectLocation}
					/>
				);
			default:
				return (
					<CityRow
						label={item.label}
						icon={item.icon}
						trailing={item.trailing}
						selected={value === item.city && item.key !== "typed"}
						onPress={() => pick(item.city)}
					/>
				);
		}
	};

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
					accessibilityLabel={`Location: ${label}. Change`}
					hitSlop={4}
					{...focusable}
					style={(state) => {
						const { pressed, hovered } = state as PressState;
						return {
							flexDirection: "row",
							alignItems: "center",
							gap: spacing[1.5],
							height: 36,
							paddingLeft: spacing[3],
							paddingRight: spacing[2.5],
							borderRadius: 999,
							borderWidth: 1,
							borderColor: colors.border.medium,
							backgroundColor:
								pressed || hovered ? colors.background.subtle : "transparent",
						};
					}}
				>
					<MapPin
						size={14}
						color={colors.text.secondary as string}
						strokeWidth={2}
					/>
					<Caption
						weight="semibold"
						numberOfLines={1}
						style={{ maxWidth: 120 }}
					>
						{label}
					</Caption>
					<ChevronDown
						size={14}
						color={colors.text.tertiary as string}
						strokeWidth={2}
					/>
				</Pressable>
			)}

			<Sheet
				visible={open}
				onClose={close}
				title="Show posts from"
				scrollable={false}
				detents={["88%"]}
			>
				<View
					style={{
						paddingHorizontal: spacing[5],
						paddingBottom: spacing[2],
					}}
				>
					<SearchField
						value={query}
						onChange={setQuery}
						placeholder="Search cities"
						autoFocus={isDesktop}
						autoCapitalize="none"
					/>
				</View>
				<SheetFlatList
					data={rows}
					keyExtractor={(row) => row.key}
					renderItem={renderRow}
					contentContainerStyle={{ paddingHorizontal: spacing[2] }}
					ListFooterComponent={
						query.trim() &&
						!rows.some((row) => row.type === "city" && row.key !== "all") ? (
							<Caption
								color="quaternary"
								style={{
									paddingHorizontal: spacing[3],
									paddingTop: spacing[2],
								}}
							>
								No city by that name.
							</Caption>
						) : undefined
					}
				/>
			</Sheet>
		</>
	);
}

/**
 * One row of the picker: a fixed 20pt icon slot (empty for plain cities, so
 * every label starts on the same line), the name, its state muted at the
 * end, and a tick when it is the current scope.
 */
function CityRow({
	label,
	icon: Icon,
	trailing,
	selected,
	accent,
	busy,
	onPress,
}: {
	label: string;
	icon?: LucideIcon;
	trailing?: string;
	selected?: boolean;
	/** Ink the icon and label in brand ink - for an action row. */
	accent?: boolean;
	busy?: boolean;
	onPress: () => void;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	const ink = accent
		? (colors.primary.ink as string)
		: selected
			? (colors.text.primary as string)
			: (colors.text.tertiary as string);

	return (
		<Pressable
			onPress={onPress}
			disabled={busy}
			accessibilityRole={accent ? "button" : "radio"}
			accessibilityLabel={trailing ? `${label}, ${trailing}` : label}
			accessibilityState={accent ? { busy: !!busy } : { checked: !!selected }}
			{...focusable}
			style={(state) => {
				const { pressed, hovered } = state as PressState;
				return {
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[3],
					minHeight: 48,
					paddingHorizontal: spacing[3],
					borderRadius: borderRadius.md,
					backgroundColor:
						pressed || hovered ? colors.background.subtle : "transparent",
				};
			}}
		>
			<View style={{ width: 20, alignItems: "center" }}>
				{busy ? (
					<ActivityIndicator size="small" color={ink} />
				) : Icon ? (
					<Icon size={18} color={ink} strokeWidth={1.9} />
				) : null}
			</View>
			{accent ? (
				<Label weight="semibold" color={ink} style={{ flex: 1 }}>
					{label}
				</Label>
			) : (
				<Body
					weight={selected ? "semibold" : "normal"}
					numberOfLines={1}
					style={{ flex: 1 }}
				>
					{label}
				</Body>
			)}
			{trailing && (
				<Caption color="quaternary" numberOfLines={1}>
					{trailing}
				</Caption>
			)}
			<View style={{ width: 18, alignItems: "center" }}>
				{selected && (
					<Check
						size={18}
						color={colors.primary.ink as string}
						strokeWidth={2.4}
					/>
				)}
			</View>
		</Pressable>
	);
}
