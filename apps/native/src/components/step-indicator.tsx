import { Check, ChevronLeft } from "lucide-react-native";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pressable } from "@/components/ui/pressable";
import { Caption } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { focusable } from "@/lib/focus";

interface StepIndicatorProps {
	steps: string[];
	currentStep: number;
	/** When given, a 40pt back chevron sits above the steps. */
	onBack?: () => void;
	/**
	 * Drops the safe-area inset, the gutters and the back slot, so the rail can
	 * sit inside a card on a page that already has a header.
	 *
	 * Without this the only caller that is not a full-screen wizard had to undo
	 * the padding with negative margins - `marginHorizontal: -spacing[6]` - which
	 * is a component telling you it wants a variant.
	 */
	embedded?: boolean;
}

/**
 * The progress rail across the top of a wizard. Sits under the status bar on
 * its own inset, so wizards do not have to guess at one. Completed and current
 * steps are ink; the rest are outlined. Orange is kept for the Continue button.
 */
export function StepIndicator({
	steps,
	currentStep,
	onBack,
	embedded,
}: StepIndicatorProps) {
	const { colors, spacing } = useTheme();
	const insets = useSafeAreaInsets();

	return (
		<View
			accessible
			accessibilityRole="progressbar"
			accessibilityLabel={`Step ${currentStep + 1} of ${steps.length}: ${steps[currentStep] ?? ""}`}
			accessibilityValue={{
				min: 1,
				max: steps.length,
				now: currentStep + 1,
			}}
			style={
				embedded
					? {}
					: {
							paddingHorizontal: spacing[5],
							paddingTop: insets.top + spacing[3],
							paddingBottom: spacing[5],
						}
			}
		>
			<View
				style={
					embedded ? { height: 0 } : { minHeight: 40, marginBottom: spacing[3] }
				}
			>
				{onBack && !embedded && (
					<Pressable
						onPress={onBack}
						hitSlop={8}
						accessibilityRole="button"
						accessibilityLabel="Previous step"
						{...focusable}
						style={({ pressed }) => ({
							width: 40,
							height: 40,
							borderRadius: 999,
							alignItems: "center",
							justifyContent: "center",
							alignSelf: "flex-start",
							backgroundColor: pressed
								? colors.background.tertiary
								: colors.background.subtle,
						})}
					>
						<ChevronLeft
							size={24}
							strokeWidth={2.4}
							style={{ marginLeft: -2 }}
							color={colors.text.primary as string}
						/>
					</Pressable>
				)}
			</View>

			<View style={{ flexDirection: "row", alignItems: "flex-start" }}>
				{steps.map((label, i) => {
					const isCompleted = i < currentStep;
					const isCurrent = i === currentStep;
					const isLast = i === steps.length - 1;
					const filled = isCompleted || isCurrent;

					return (
						<View
							key={label}
							style={{
								flex: 1,
								flexDirection: "row",
								alignItems: "flex-start",
							}}
						>
							<View style={{ alignItems: "center", gap: spacing[1.5] }}>
								<View
									style={{
										width: 28,
										height: 28,
										borderRadius: 14,
										backgroundColor: filled
											? (colors.text.primary as string)
											: "transparent",
										borderWidth: filled ? 0 : 1.5,
										borderColor: colors.border.dark,
										alignItems: "center",
										justifyContent: "center",
									}}
								>
									{isCompleted ? (
										<Check
											size={14}
											strokeWidth={2.6}
											color={colors.text.inverse as string}
										/>
									) : (
										<Caption
											weight="bold"
											color={
												isCurrent
													? (colors.text.inverse as string)
													: (colors.text.quaternary as string)
											}
										>
											{i + 1}
										</Caption>
									)}
								</View>
								<Caption
									color={isCurrent ? "primary" : "quaternary"}
									weight={isCurrent ? "semibold" : "normal"}
									numberOfLines={1}
									style={{ textAlign: "center" }}
								>
									{label}
								</Caption>
							</View>

							{!isLast && (
								<View
									style={{
										flex: 1,
										height: 2,
										marginTop: 13,
										marginHorizontal: spacing[1],
										borderRadius: 1,
										backgroundColor: isCompleted
											? (colors.text.primary as string)
											: colors.border.medium,
									}}
								/>
							)}
						</View>
					);
				})}
			</View>
		</View>
	);
}
