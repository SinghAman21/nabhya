import {
	CalendarClock,
	Landmark,
	MapPin,
	MapPinned,
} from "lucide-react-native";
import { AmountField } from "@/components/composer/amount-field";
import { PlaceField } from "@/components/composer/place-field";
import {
	PropertyChip,
	PropertyNote,
	PropertyRow,
	RevealedFields,
} from "@/components/composer/property-row";
import { DateTimeField } from "@/components/date-time-field";
import { Field } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/hooks/use-theme";

/**
 * An event: when, and how many people.
 *
 * `createEventSchema` has nine fields and an event most people publish needs
 * four of them, so three are visible — start, end, headcount — and the rest are
 * chips. `EventFacts` on the card draws a date chip, a location chip, a
 * "6 of 25 spots left" row and a twelve-segment bar, which is why those three
 * and not others.
 *
 * Three decisions here are about how much work the form asks for:
 *
 * - **Ends follows Starts.** Setting a start moves the end to three hours
 *   later, the length of nearly every volunteering slot here — and, more to
 *   the point, *a valid value*: `createEventSchema` refuses an end before its
 *   start, so two empty date boxes could fail validation on a field the author
 *   had no opinion about. It follows only while untouched (`endTouched`), so
 *   it never overwrites a real answer.
 * - **Venue and address are separate chips, and the address is prefilled.**
 *   They are different facts — `Shivaji Park` is where to meet, the street
 *   address is how to get there — and the NGO's own address is the right first
 *   guess for an event at its own premises, which most are. Prefilled, not
 *   silent: unlike the city, an address is often *not* the NGO's, so it is
 *   shown for confirmation rather than assumed.
 * - **Urgency is not on offer.** `toFeedItem` derives it from the start date —
 *   an event is urgent inside three days — so a chip would be a control that
 *   disagrees with the card. It is a `PropertyNote` instead.
 */

export interface EventFieldsValue {
	startAt: Date | undefined;
	endAt: Date | undefined;
	deadline: Date | undefined;
	venue: string;
	address: string;
	/** Digits only — see `AmountField`. */
	volunteers: string;
	/**
	 * Whether the end has been set deliberately. Once true, changing the start
	 * stops dragging the end along with it.
	 */
	endTouched: boolean;
	/**
	 * Flags rather than `venue.length > 0`, which is what the date chips use.
	 * A date is absent or a real date, so its own value can drive its chip —
	 * but an open *text* field starts empty and legitimately stays empty while
	 * somebody thinks, and deriving the chip from the string would collapse the
	 * field under the cursor on the first backspace.
	 */
	venueOpen: boolean;
	addressOpen: boolean;
	placeOpen: boolean;
}

/** Three hours: the default length of a volunteering slot here. */
const DEFAULT_LENGTH_MS = 3 * 60 * 60 * 1000;

/** Events here want tens of people, not hundreds of items. */
const VOLUNTEER_STEPS = [5, 10, 25] as const;

export function EventFields({
	value,
	onChange,
	city,
	state,
	onCity,
	onState,
	homeCity,
	homeAddress,
	stateOnFile,
	errors,
	disabled,
}: {
	value: EventFieldsValue;
	onChange: (patch: Partial<EventFieldsValue>) => void;
	city: string;
	state: string;
	onCity: (next: string) => void;
	onState: (next: string) => void;
	homeCity: string | null;
	/** The NGO's registered address, prefilled into the address field. */
	homeAddress: string | null;
	stateOnFile: boolean;
	errors: Record<string, string>;
	disabled?: boolean;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	const inputStyle = {
		borderWidth: 0,
		borderRadius: borderRadius.md,
		backgroundColor: colors.background.tertiary,
		paddingVertical: spacing[3.5],
	};

	return (
		<>
			<DateTimeField
				label="Starts"
				value={value.startAt}
				onChange={(next) =>
					onChange({
						startAt: next,
						// Drag the end along while it is still the default one.
						...(next && !value.endTouched
							? { endAt: new Date(next.getTime() + DEFAULT_LENGTH_MS) }
							: {}),
					})
				}
				error={errors.startAt}
			/>

			<DateTimeField
				label="Ends"
				value={value.endAt}
				onChange={(next) => onChange({ endAt: next, endTouched: true })}
				error={errors.endAt}
				// An end is relative to the start, never to now, so "Tomorrow" and
				// "In a week" are the wrong offers here — and by the time anybody
				// reads this field it already holds a sensible value.
				shortcuts={false}
			/>

			<AmountField
				label="How many volunteers?"
				hint="The card counts down the spots left."
				error={errors.volunteersNeeded}
				count={value.volunteers}
				onCount={(next) => onChange({ volunteers: next })}
				countPlaceholder="e.g. 25"
				quickAdd={VOLUNTEER_STEPS}
				max={10_000}
				compact
				accessibilityName="volunteers needed"
			/>

			<PropertyRow>
				<PropertyChip
					icon={Landmark}
					label={value.venueOpen ? value.venue.trim() || "Venue" : "Venue"}
					state={value.venueOpen ? "on" : "add"}
					onPress={() => onChange({ venueOpen: true })}
					onClear={() => onChange({ venueOpen: false, venue: "" })}
					disabled={disabled}
				/>
				<PropertyChip
					icon={MapPinned}
					label="Address"
					state={value.addressOpen ? "on" : "add"}
					onPress={() =>
						onChange({
							addressOpen: true,
							// Prefill on the first open only, so re-opening after an
							// edit does not throw the edit away.
							address: value.address || (homeAddress ?? ""),
						})
					}
					onClear={() => onChange({ addressOpen: false, address: "" })}
					disabled={disabled}
				/>
				<PropertyChip
					icon={CalendarClock}
					label={
						value.deadline
							? `Applications close ${value.deadline.getDate()}/${value.deadline.getMonth() + 1}`
							: "Application deadline"
					}
					state={value.deadline ? "on" : "add"}
					onPress={() =>
						onChange({
							// A day before the start, which the schema requires the
							// deadline to be on or before.
							deadline:
								value.deadline ??
								new Date(
									(value.startAt?.getTime() ?? Date.now() + 8 * 86_400_000) -
										86_400_000,
								),
						})
					}
					onClear={() => onChange({ deadline: undefined })}
					disabled={disabled}
				/>
				<PropertyChip
					icon={MapPin}
					label={
						value.placeOpen ? city.trim() || "Another city" : "Another city"
					}
					state={value.placeOpen ? "on" : "add"}
					onPress={() => onChange({ placeOpen: true })}
					onClear={() => {
						onChange({ placeOpen: false });
						onCity(homeCity ?? "");
					}}
					disabled={disabled}
				/>
			</PropertyRow>

			<PropertyNote>
				{value.placeOpen || !homeCity
					? "An event becomes urgent on its own in the three days before it starts."
					: `In ${homeCity} — your NGO's city. Urgent is automatic in the last three days.`}
			</PropertyNote>

			<RevealedFields>
				{value.venueOpen && (
					<Field
						label="Venue"
						error={errors.venue}
						hint="Where to meet, inside the city."
					>
						<Input
							placeholder="Shivaji Park"
							value={value.venue}
							onChangeText={(next) => onChange({ venue: next })}
							editable={!disabled}
							autoFocus
							style={inputStyle}
						/>
					</Field>
				)}
				{value.addressOpen && (
					<Field
						label="Address"
						error={errors.address}
						hint={
							homeAddress
								? "Prefilled from your registration — change it if the event is elsewhere."
								: "The street address volunteers should travel to."
						}
					>
						<Input
							placeholder="Street, area, landmark"
							value={value.address}
							onChangeText={(next) => onChange({ address: next })}
							editable={!disabled}
							multiline
							style={{ ...inputStyle, minHeight: 72, textAlignVertical: "top" }}
						/>
					</Field>
				)}
				{value.deadline && (
					<DateTimeField
						label="Applications close"
						value={value.deadline}
						onChange={(next) => onChange({ deadline: next })}
						error={errors.applicationDeadline}
						shortcuts={false}
					/>
				)}
				{value.placeOpen && (
					<PlaceField
						label="Which city?"
						city={city}
						state={state}
						onCity={onCity}
						onState={onState}
						stateOnFile={stateOnFile}
						cityError={errors.city}
						stateError={errors.state}
						disabled={disabled}
					/>
				)}
			</RevealedFields>
		</>
	);
}

/**
 * A start that is a sensible offer rather than an empty box: the next whole
 * hour, a week out. `createEventSchema` cannot accept a missing start, so the
 * only question is whether the author edits a real date or fills in a blank
 * one — and a blank one is also the shape that produces Zod's useless
 * "invalid input" from a `coerce.date()`.
 */
export function defaultEventStart() {
	const date = new Date(Date.now() + 7 * 86_400_000);
	date.setMinutes(0, 0, 0);
	date.setHours(date.getHours() + 1);
	return date;
}
