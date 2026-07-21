import { View } from "react-native";
import { Body } from "@/components/ui/typography";
import { useTheme } from "@/hooks/useTheme";

interface StepIndicatorProps {
	steps: string[];
	currentStep: number;
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
	const { colors, spacing } = useTheme();

	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				paddingHorizontal: spacing[6],
				paddingTop: spacing[8],
				paddingBottom: spacing[6],
			}}
		>
			{steps.map((label, i) => {
				const isCompleted = i < currentStep;
				const isCurrent = i === currentStep;
				const isLast = i === steps.length - 1;

				return (
					<View
						key={label}
						style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
					>
						<View style={{ alignItems: "center", gap: spacing[1.5] }}>
							<View
								style={{
									width: 32,
									height: 32,
									borderRadius: 16,
									backgroundColor: isCompleted
										? colors.primary.main
										: isCurrent
											? colors.primary.main
											: "transparent",
									borderWidth: 2,
									borderColor: isCompleted
										? colors.primary.main
										: isCurrent
											? colors.primary.main
											: colors.border.medium,
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								<Body
									weight="bold"
									color={
										isCompleted || isCurrent
											? (colors.primary.contrast as string)
											: (colors.text.tertiary as string)
									}
									style={{ fontSize: 12, lineHeight: 16 }}
								>
									{isCompleted ? "✓" : i + 1}
								</Body>
							</View>
							<Body
								color={
									isCurrent ? "primary" : isCompleted ? "secondary" : "tertiary"
								}
								weight={isCurrent ? "bold" : "normal"}
								numberOfLines={1}
								style={{ fontSize: 10, lineHeight: 14, textAlign: "center" }}
							>
								{label}
							</Body>
						</View>

						{!isLast && (
							<View
								style={{
									flex: 1,
									height: 2,
									backgroundColor:
										i < currentStep ? colors.primary.main : colors.border.light,
									marginBottom: spacing[4],
									marginHorizontal: spacing[1],
								}}
							/>
						)}
					</View>
				);
			})}
		</View>
	);
}
