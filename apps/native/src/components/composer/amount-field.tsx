import type { LucideIcon } from "lucide-react-native";
import { Minus, Plus } from "lucide-react-native";
import { type StyleProp, View, type ViewStyle } from "react-native";
import { Field } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Caption } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { focusable } from "@/lib/focus";

/**
 * A count, and optionally what it counts, as **one** control.
 *
 * One label, one filled bar reading `− 200 blankets +` - the feed card prints
 * the pair as one string ("40 / 200 blankets"), so the form asks it as one
 * fact. Enter it three ways: nudge ±1, quick-add the distance, or type it.
 *
 * `0` means unspecified (the schema takes `quantity?` with `min(1)`), so the
 * bar rests at 0, `−` stops there, and callers omit it on submit.
 */
export function AmountField({
	label,
	hint,
	error,
	count,
	onCount,
	unit,
	onUnit,
	countPlaceholder,
	unitPlaceholder,
	quickAdd,
	max = 1_000_000,
	disabled,
	compact,
	accessibilityName,
}: {
	label: string;
	hint?: string;
	error?: string;
	/** Digits only - `"0"` means unspecified, never sent to the API. */
	count: string;
	onCount: (next: string) => void;
	/** Omit both to render a bare count, e.g. a headcount. */
	unit?: string;
	onUnit?: (next: string) => void;
	countPlaceholder?: string;
	unitPlaceholder?: string;
	quickAdd?: readonly number[];
	max?: number;
	disabled?: boolean;
	/**
	 * A headcount, not a stockpile: cap the bar's width instead of stretching
	 * it across the drawer.
	 */
	compact?: boolean;
	/** Used in the buttons' labels, e.g. "quantity". */
	accessibilityName: string;
}) {
	const { spacing } = useTheme();

	return (
		<Field label={label} hint={hint} error={error}>
			<View style={{ gap: spacing[2] }}>
				<StepperBar
					count={count}
					onCount={onCount}
					countPlaceholder={countPlaceholder}
					max={max}
					disabled={disabled}
					compact={compact}
					accessibilityName={accessibilityName}
					trailing={
						onUnit ? (
							<Input
								placeholder={unitPlaceholder ?? "units"}
								value={unit ?? ""}
								onChangeText={onUnit}
								editable={!disabled}
								accessibilityLabel={`Unit for ${accessibilityName}`}
								style={{
									...BARE,
									flex: 1,
									minWidth: 0,
									paddingVertical: spacing[3.5],
								}}
							/>
						) : undefined
					}
				/>
				<StepChips
					steps={quickAdd}
					count={count}
					onCount={onCount}
					max={max}
					disabled={disabled}
					accessibilityName={accessibilityName}
				/>
			</View>
		</Field>
	);
}

/**
 * The `− count +` bar on its own, so a screen can lay it beside a sibling
 * field in one row instead of taking the full Field treatment. Pair with
 * `StepChips` and per-half labels/errors at the call site.
 */
export function StepperBar({
	count,
	onCount,
	countPlaceholder,
	max = 1_000_000,
	disabled,
	compact,
	accessibilityName,
	trailing,
	style,
}: {
	/** Digits only - `"0"` means unspecified, never sent to the API. */
	count: string;
	onCount: (next: string) => void;
	countPlaceholder?: string;
	max?: number;
	disabled?: boolean;
	/** Cap the width instead of stretching across the parent. */
	compact?: boolean;
	/** Used in the buttons' labels, e.g. "quantity". */
	accessibilityName: string;
	/** Rendered between the number and `+`, e.g. a unit input. */
	trailing?: React.ReactNode;
	style?: StyleProp<ViewStyle>;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	const current = count ? Number(count) : 0;

	const set = (next: number) => {
		onCount(String(Math.max(0, Math.min(next, max))));
	};

	return (
		<View
			style={[
				{
					flexDirection: "row",
					alignItems: "center",
					alignSelf: compact ? "flex-start" : "stretch",
					width: compact ? undefined : "100%",
					maxWidth: compact ? 248 : undefined,
					minWidth: compact ? 216 : undefined,
					borderRadius: borderRadius.md,
					backgroundColor: colors.background.tertiary,
					paddingHorizontal: spacing[1],
				},
				style,
			]}
		>
			<Nudge
				icon={Minus}
				label={`Decrease ${accessibilityName}`}
				disabled={disabled || current <= 0}
				onPress={() => set(current - 1)}
			/>

			<Input
				placeholder={countPlaceholder ?? "0"}
				value={count}
				onChangeText={(next) =>
					onCount(next.replace(/\D/g, "").slice(0, 7) || "0")
				}
				keyboardType="number-pad"
				editable={!disabled}
				accessibilityLabel={accessibilityName}
				style={{
					...BARE,
					minWidth: 52,
					maxWidth: 72,
					paddingVertical: spacing[3.5],
					textAlign: "center",
					fontFamily: "MonaSans-Medium",
				}}
			/>

			{trailing ?? <View style={{ flex: 1 }} />}

			<Nudge
				icon={Plus}
				label={`Increase ${accessibilityName}`}
				disabled={disabled || current >= max}
				onPress={() => set(current + 1)}
			/>
		</View>
	);
}

/** Quick-add chips (`+10 +50 +100`, Reset) under a stepper. */
export function StepChips({
	steps,
	count,
	onCount,
	max = 1_000_000,
	disabled,
	accessibilityName,
}: {
	steps?: readonly number[];
	/** Digits only - `"0"` means unspecified. */
	count: string;
	onCount: (next: string) => void;
	max?: number;
	disabled?: boolean;
	accessibilityName: string;
}) {
	const { spacing } = useTheme();
	if (!steps || steps.length === 0) return null;
	const current = count ? Number(count) : 0;
	const set = (next: number) => {
		onCount(String(Math.max(0, Math.min(next, max))));
	};

	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: spacing[2],
				flexWrap: "wrap",
			}}
		>
			{steps.map((step) => (
				<QuickAdd
					key={step}
					label={`+${step}`}
					accessibilityLabel={`Add ${step} to ${accessibilityName}`}
					disabled={disabled || current >= max}
					onPress={() => set(current + step)}
				/>
			))}
			{current > 0 && (
				<QuickAdd
					label="Reset"
					accessibilityLabel={`Reset ${accessibilityName} to zero`}
					muted
					disabled={disabled}
					onPress={() => onCount("0")}
				/>
			)}
		</View>
	);
}

/** Borderless: the row around them carries the fill. */
const BARE = {
	borderWidth: 0,
	backgroundColor: "transparent",
	paddingHorizontal: 0,
} as const;

/** One ± button: a disc, like every other icon-only control in the composer. */
function Nudge({
	icon: Icon,
	label,
	disabled,
	onPress,
}: {
	icon: LucideIcon;
	label: string;
	disabled?: boolean;
	onPress: () => void;
}) {
	const { colors } = useTheme();

	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ disabled: !!disabled }}
			hitSlop={6}
			{...focusable}
			style={({ pressed, hovered }) => ({
				width: 34,
				height: 34,
				borderRadius: 999,
				alignItems: "center",
				justifyContent: "center",
				opacity: disabled ? 0.3 : 1,
				backgroundColor:
					pressed || hovered
						? (colors.background.card as string)
						: "transparent",
			})}
		>
			<Icon
				size={16}
				strokeWidth={2.2}
				color={colors.text.secondary as string}
			/>
		</Pressable>
	);
}

function QuickAdd({
	label,
	accessibilityLabel,
	muted,
	disabled,
	onPress,
}: {
	label: string;
	accessibilityLabel: string;
	muted?: boolean;
	disabled?: boolean;
	onPress: () => void;
}) {
	const { colors, spacing } = useTheme();

	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
			accessibilityState={{ disabled: !!disabled }}
			// 28pt chip, 44pt target.
			hitSlop={8}
			{...focusable}
			style={({ pressed, hovered }) => ({
				minHeight: 28,
				justifyContent: "center",
				paddingHorizontal: spacing[2.5],
				borderRadius: 999,
				opacity: disabled ? 0.4 : 1,
				backgroundColor:
					pressed || hovered
						? (colors.background.tertiary as string)
						: (colors.background.subtle as string),
			})}
		>
			<Caption
				weight="semibold"
				color={muted ? "quaternary" : colors.primary.ink}
			>
				{label}
			</Caption>
		</Pressable>
	);
}
