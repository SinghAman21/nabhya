import type { NeedType } from "@nabhya/shared";
import { AlertTriangle, CalendarClock, MapPin } from "lucide-react-native";
import { View } from "react-native";
import { ChoiceChips } from "@/components/choice-chips";
import { StepChips, StepperBar } from "@/components/composer/amount-field";
import { PlaceField } from "@/components/composer/place-field";
import {
	PropertyChip,
	PropertyNote,
	PropertyRow,
	RevealedFields,
} from "@/components/composer/property-row";
import { SwitchRow } from "@/components/composer/switch-row";
import { DateTimeField } from "@/components/date-time-field";
import { Field, FieldError, useFieldInputStyle } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { Caption, Label } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";

/**
 * A need, in as few fields as a need can be described.
 *
 * Two things are visible: what kind of need it is, and how much of it. That is
 * the whole form. Everything else — when it closes, where it is if not where
 * the NGO is — is a chip in the property row, off until it is wanted.
 *
 * The two that stayed visible earn it from the feed card. `NeedFacts` builds
 * "40 / 200 blankets" and its progress track out of `quantity` + `unit`, and
 * **returns `null` when it has neither** — so a need filed without an amount
 * produces a card with a title, a paragraph and nothing a volunteer can act on
 * or measure. And `KindPill` prints "Needs items" or "Giving away" straight
 * off `type`, so the WANT/OFFER choice is the first thing anybody reads.
 *
 * The city is **not** asked for. It is required by `createNeedSchema`, and it
 * is answered by the NGO's own registration in nearly every case — so it is
 * filled silently and stated in a line under the row, with a chip for the
 * times it is somewhere else. See `PlaceField`.
 */

export interface NeedFieldsValue {
	needType: NeedType;
	/** Digits only, or empty for unspecified — see `AmountField`. */
	quantity: string;
	unit: string;
	expiresAt: Date | undefined;
	/** Whether the city has been taken off the NGO's own. */
	placeOpen: boolean;
}

/**
 * The two chips a need chooses between: the same words as `NEED_TYPE_LABELS`
 * in `@nabhya/shared`, because these are what a volunteer reads as the pill at
 * the top of the card.
 */
const NEED_TYPES: Array<{ value: NeedType; label: string; hint: string }> = [
	{
		value: "WANT",
		label: "We need",
		hint: "Volunteers and donors can pledge to supply it.",
	},
	{
		value: "OFFER",
		label: "We're giving",
		hint: "Surplus you're offering to whoever needs it.",
	},
];

/** Item needs cluster in tens and hundreds — 200 blankets, 500 meals. */
const QUANTITY_STEPS = [10, 50, 100] as const;

export function NeedFields({
	value,
	onChange,
	urgent,
	onUrgent,
	city,
	state,
	onCity,
	onState,
	homeCity,
	stateOnFile,
	errors,
	disabled,
}: {
	value: NeedFieldsValue;
	onChange: (patch: Partial<NeedFieldsValue>) => void;
	urgent: boolean;
	onUrgent: (next: boolean) => void;
	city: string;
	state: string;
	onCity: (next: string) => void;
	onState: (next: string) => void;
	homeCity: string | null;
	stateOnFile: boolean;
	errors: Record<string, string>;
	disabled?: boolean;
}) {
	const giving = value.needType === "OFFER";
	const { spacing } = useTheme();
	const itemInputStyle = useFieldInputStyle();

	return (
		<>
			<Field label="This need is" error={errors.type}>
				<ChoiceChips
					label="Need type"
					options={NEED_TYPES}
					value={value.needType}
					onChange={(next) => onChange({ needType: next })}
				/>
			</Field>

			{/*
			 * One row, two fields: the number and what it counts are different
			 * answers, asked side by side. The card prints them as one line
			 * ("40 / 200 blankets") with a bar that fills as people pledge.
			 */}
			<View
				style={{
					flexDirection: "row",
					gap: spacing[3],
				}}
			>
				<View style={{ flex: 1.1, minWidth: 0 }}>
					<Label style={{ marginBottom: spacing[1.5] }}>Quantity</Label>
					<StepperBar
						count={value.quantity}
						onCount={(next) => onChange({ quantity: next })}
						countPlaceholder="e.g. 200"
						disabled={disabled}
						accessibilityName="quantity"
						style={{ width: "100%" }}
					/>
					<FieldError message={errors.quantity} />
				</View>
				<View style={{ flex: 1, minWidth: 0 }}>
					<Label style={{ marginBottom: spacing[1.5] }}>
						Item <Caption color="tertiary">(optional)</Caption>
					</Label>
					<Input
						placeholder="e.g. blankets"
						value={value.unit}
						onChangeText={(next) => onChange({ unit: next })}
						editable={!disabled}
						accessibilityLabel="Item"
						maxLength={40}
						style={itemInputStyle}
					/>
					<FieldError message={errors.unit} />
				</View>
			</View>
			<Caption color="quaternary" style={{ marginTop: spacing[2] }}>
				{giving
					? "e.g. 200 blankets you can give — pledges count against the number. Leave it at 0 to skip."
					: "e.g. 200 blankets needed — pledges count against the number. Leave it at 0 to skip."}
			</Caption>
			<View style={{ marginTop: spacing[2], marginBottom: spacing[5] }}>
				<StepChips
					steps={QUANTITY_STEPS}
					count={value.quantity}
					onCount={(next) => onChange({ quantity: next })}
					disabled={disabled}
					accessibilityName="quantity"
				/>
			</View>

			<SwitchRow
				icon={AlertTriangle}
				tone="error"
				title="Mark as urgent"
				hint="High urgency — Urgent lens, ranked higher in every feed."
				value={urgent}
				onChange={onUrgent}
				disabled={disabled}
			/>

			<View style={{ height: spacing[3] }} />

			<PropertyRow>
				<PropertyChip
					icon={CalendarClock}
					label={
						value.expiresAt
							? `Closes ${value.expiresAt.getDate()}/${value.expiresAt.getMonth() + 1}`
							: "Closing date"
					}
					state={value.expiresAt ? "on" : "add"}
					onPress={() =>
						onChange({
							// Opens on a real date rather than an empty field: the
							// picker needs a value to render, and a week out is the
							// answer for nearly every need that has one at all.
							expiresAt:
								value.expiresAt ?? new Date(Date.now() + 7 * 86_400_000),
						})
					}
					onClear={() => onChange({ expiresAt: undefined })}
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

			{!value.placeOpen && homeCity && (
				<PropertyNote>
					{giving ? "Collected in" : "Needed in"} {homeCity} — your NGO's city.
				</PropertyNote>
			)}

			<RevealedFields>
				{value.expiresAt && (
					<DateTimeField
						label="Closes on"
						value={value.expiresAt}
						onChange={(next) => onChange({ expiresAt: next })}
						error={errors.expiresAt}
					/>
				)}
				{value.placeOpen && (
					<PlaceField
						label={
							giving ? "Where can it be collected?" : "Where is it needed?"
						}
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
