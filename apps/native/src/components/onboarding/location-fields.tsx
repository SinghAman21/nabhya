import { LocateFixed } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Field, FieldError, useFieldInputStyle } from "@/components/form-field";
import { FieldPair } from "@/components/onboarding/wizard";
import { Input } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Caption, Label } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import {
	citySuggestions,
	nearestCity,
	normaliseCityName,
	stateForCity,
	stateSuggestions,
} from "@/lib/cities";
import { focusable } from "@/lib/focus";
import { placeParts, requestPosition, reverseGeocode } from "@/lib/location";

export interface LocationValue {
	city: string;
	state: string;
	latitude?: number;
	longitude?: number;
}

/** Everything a successful detection could work out about where you are. */
export interface DetectedPlace {
	/** Street-level line, when the platform could name one. */
	address?: string;
	pincode?: string;
}

/**
 * The city/state pair, in one place, for both wizards.
 *
 * Three problems the plain pair of text inputs had:
 *
 * 1. **It invented cities.** `city` is free text on every table that has one,
 *    and the feed, the needs list and "NGOs near me" all filter on an exact
 *    match - so "mumbai" typed in lower case is a city with nothing in it.
 *    Suggestions and `normaliseCityName` mean a typed city usually resolves to
 *    the one spelling everything else uses. See `lib/cities.ts`.
 * 2. **City and state could disagree.** Choosing a suggested city now fills the
 *    state, and typing a listed city fills it on blur if it is still empty.
 * 3. **Nobody's coordinates were ever recorded.** `organizations.latitude` and
 *    `users.latitude` exist and `GET /organizations/nearby` reads them, but the
 *    only screen that could set them was an edit form nobody opens after
 *    signing up - so proximity search had almost nothing to search. Location is
 *    offered here, once, with the reason stated and never silently requested.
 */
export function LocationFields({
	value,
	onChange,
	cityError,
	stateError,
	detectLede,
	onDetectedPlace,
}: {
	value: LocationValue;
	onChange: (fields: Partial<LocationValue>) => void;
	cityError?: string;
	stateError?: string;
	/** Why we want the coordinates, in this vertical's own words. */
	detectLede: string;
	/**
	 * The street line and pincode, when the platform produced them. The NGO
	 * wizard uses it to fill the address it also asks for - having just been
	 * told where someone is, asking them to type it is rude.
	 */
	onDetectedPlace?: (place: DetectedPlace) => void;
}) {
	const { colors, spacing } = useTheme();
	const inputStyle = useFieldInputStyle();
	const [detecting, setDetecting] = useState(false);
	const [detectError, setDetectError] = useState<string | null>(null);
	const [detectNote, setDetectNote] = useState<string | null>(null);

	const cityOptions = citySuggestions(value.city, 5);
	const stateOptions = value.state ? stateSuggestions(value.state, 4) : [];

	const pickCity = (city: string) => {
		const derived = stateForCity(city);
		onChange({ city, ...(derived ? { state: derived } : {}) });
	};

	/** Normalise on blur, and fill an empty state from the city. */
	const settleCity = () => {
		const normalised = normaliseCityName(value.city);
		const derived = stateForCity(normalised);
		onChange({
			city: normalised,
			...(derived && !value.state.trim() ? { state: derived } : {}),
		});
	};

	const detect = async () => {
		setDetecting(true);
		setDetectError(null);
		setDetectNote(null);
		try {
			const position = await requestPosition();
			if (position.status === "denied") {
				setDetectError("Location is off for Nabhya. Type your city instead.");
				return;
			}
			if (position.status === "failed") {
				setDetectError("Couldn't get your location. Type your city instead.");
				return;
			}

			const coords = {
				latitude: position.latitude,
				longitude: position.longitude,
			};
			const place = await reverseGeocode(coords.latitude, coords.longitude);
			const parts = place ? placeParts(place) : null;

			if (parts) {
				onDetectedPlace?.({
					...(parts.address ? { address: parts.address } : {}),
					...(parts.pincode ? { pincode: parts.pincode } : {}),
				});
			}

			if (parts?.city) {
				const normalised = normaliseCityName(parts.city);
				onChange({
					...coords,
					city: normalised,
					state: stateForCity(normalised) ?? parts.region ?? value.state,
				});
				setDetectNote(`Set to ${normalised}. Change it if that's not right.`);
				return;
			}

			// No name from the platform - reverse geocoding does not exist on the
			// web and can come back empty on Android - so work the city out from
			// the coordinates ourselves rather than saving them and asking the
			// user to type the city they just asked us to find.
			const near = nearestCity(coords.latitude, coords.longitude);
			if (near) {
				onChange({
					...coords,
					city: near.city,
					state: near.state || parts?.region || value.state,
				});
				setDetectNote(
					near.km <= 15
						? `Set to ${near.city}. Change it if that's not right.`
						: `Nearest city we know is ${near.city}, about ${near.km}km away. Change it if you're somewhere else.`,
				);
				return;
			}

			onChange(coords);
			setDetectNote(
				"Location saved, but we couldn't name a city near you - please type it.",
			);
		} finally {
			setDetecting(false);
		}
	};

	return (
		<View>
			<Pressable
				onPress={detect}
				disabled={detecting}
				accessibilityRole="button"
				accessibilityLabel="Use my current location"
				accessibilityState={{ busy: detecting, disabled: detecting }}
				{...focusable}
				style={({ pressed }) => ({
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[3],
					padding: spacing[4],
					marginBottom: spacing[5],
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
							strokeWidth={2}
							color={colors.primary.ink as string}
						/>
					)}
				</View>
				<View style={{ flex: 1, gap: 2 }}>
					<Label weight="semibold">
						{detecting ? "Finding your city…" : "Use my current location"}
					</Label>
					<Caption color="tertiary">{detectLede}</Caption>
				</View>
			</Pressable>

			<FieldError message={detectError} />
			{detectNote && !detectError ? (
				<Caption
					accessibilityLiveRegion="polite"
					color="tertiary"
					style={{ marginTop: -spacing[3], marginBottom: spacing[4] }}
				>
					{detectNote}
				</Caption>
			) : null}

			<FieldPair>
				<Field label="City" error={cityError}>
					<Input
						placeholder="e.g. Mumbai"
						value={value.city}
						onChangeText={(city) => onChange({ city })}
						onBlur={settleCity}
						autoCapitalize="words"
						autoCorrect={false}
						returnKeyType="next"
						accessibilityLabel="City"
						style={inputStyle}
					/>
					{cityOptions.length > 0 ? (
						<SuggestionRow
							label="Suggested cities"
							options={cityOptions}
							onPick={pickCity}
						/>
					) : null}
				</Field>

				<Field label="State" error={stateError}>
					<Input
						placeholder="e.g. Maharashtra"
						value={value.state}
						onChangeText={(state) => onChange({ state })}
						autoCapitalize="words"
						autoCorrect={false}
						returnKeyType="done"
						accessibilityLabel="State"
						style={inputStyle}
					/>
					{stateOptions.length > 0 ? (
						<SuggestionRow
							label="Suggested states"
							options={stateOptions}
							onPick={(state) => onChange({ state })}
						/>
					) : null}
				</Field>
			</FieldPair>
		</View>
	);
}

/**
 * Suggestions as a wrapping row of quiet pills.
 *
 * Not a dropdown: an absolutely-positioned list over a scrolling form is
 * clipped by the field below it on native and by the keyboard on both, and
 * `@rn-primitives` menus portal, which the sheet rule in `AGENTS.md` rules out
 * anywhere near a modal. Pills push the form down by one row and can never be
 * hidden by anything.
 */
function SuggestionRow({
	label,
	options,
	onPick,
}: {
	label: string;
	options: string[];
	onPick: (option: string) => void;
}) {
	const { colors, spacing } = useTheme();

	return (
		<View
			accessibilityLabel={label}
			style={{
				flexDirection: "row",
				flexWrap: "wrap",
				gap: spacing[2],
				marginTop: spacing[2],
			}}
		>
			{options.map((option) => (
				<Pressable
					key={option}
					onPress={() => onPick(option)}
					hitSlop={6}
					accessibilityRole="button"
					accessibilityLabel={`Use ${option}`}
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
						{option}
					</Caption>
				</Pressable>
			))}
		</View>
	);
}
