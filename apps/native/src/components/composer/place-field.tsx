import { View } from "react-native";
import { Field } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/hooks/use-theme";

/**
 * The city, asked only when it is not the NGO's own.
 *
 * **The state is gone from the UI entirely.** `createNeedSchema` and
 * `createEventSchema` both require one, and the composer used to put it in a
 * box beside the city - a question with one answer, on every single post. An
 * NGO registers with a city *and* a state (`onboarding.ts` requires both), and
 * the composer is reachable only once that registration has been approved, so
 * the state is on file in every real case and travels silently from the
 * organisation's own record.
 *
 * `stateOnFile` is the one exception, and it is defensive rather than expected:
 * an organisation whose record somehow has no state cannot file a need without
 * one, so hiding the field unconditionally would be a form that fails
 * validation against a field nobody can see.
 *
 * The city is likewise never *asked* - the caller only mounts this once the
 * author has said the place is somewhere else, so by the time it renders the
 * question is already live. That is what makes the city effectively optional
 * without making it absent from the payload.
 *
 * Free text, which is a known data problem rather than a choice here:
 * `needs.city` and `events.city` are free-text columns, so "Mumbai", "mumbai"
 * and "Bombay" are three cities to every query that filters on them.
 * `city-picker.tsx` carries the same note. The fix is a canonical city table or
 * a normalising write path, and it belongs on the server for both.
 */
export function PlaceField({
	label,
	city,
	state,
	onCity,
	onState,
	stateOnFile,
	cityError,
	stateError,
	disabled,
}: {
	label: string;
	city: string;
	state: string;
	onCity: (next: string) => void;
	onState: (next: string) => void;
	/** False only when the organisation record has no state to send. */
	stateOnFile: boolean;
	cityError?: string;
	stateError?: string;
	disabled?: boolean;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	const style = {
		borderWidth: 0,
		borderRadius: borderRadius.md,
		backgroundColor: colors.background.tertiary,
		paddingVertical: spacing[3.5],
	};

	return (
		<View style={{ flexDirection: "row", gap: spacing[3] }}>
			<Field
				label={label}
				error={cityError ?? (stateOnFile ? stateError : undefined)}
				style={{ flex: 1, minWidth: 0 }}
			>
				<Input
					placeholder="Which city?"
					value={city}
					onChangeText={onCity}
					editable={!disabled}
					accessibilityLabel="City"
					autoFocus
					style={style}
				/>
			</Field>

			{!stateOnFile && (
				<Field
					label="State"
					error={stateError}
					style={{ flex: 1, minWidth: 0 }}
				>
					<Input
						placeholder="Maharashtra"
						value={state}
						onChangeText={onState}
						editable={!disabled}
						style={style}
					/>
				</Field>
			)}
		</View>
	);
}
