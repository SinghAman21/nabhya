import { View } from "react-native";
import { Body, H4, Label } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";

/**
 * A person or organisation as their initials on the brand tint. Ink on tint
 * (6.7:1) rather than white on orange, which failed AA — and quiet enough that
 * a list of twenty people does not read as twenty orange dots.
 */
export function InitialAvatar({
	name,
	size = 40,
	square,
}: {
	name: string | null | undefined;
	size?: number;
	/** Rounded square, for an organisation rather than a person. */
	square?: boolean;
}) {
	const { colors } = useTheme();
	const initials =
		name
			?.trim()
			.split(/\s+/)
			.slice(0, size >= 56 ? 2 : 1)
			.map((word) => word[0])
			.join("")
			.toUpperCase() || "?";

	const Text = size >= 56 ? H4 : size >= 40 ? Body : Label;

	return (
		<View
			accessible
			accessibilityLabel={name ?? undefined}
			style={{
				width: size,
				height: size,
				borderRadius: square ? size / 3.2 : size / 2,
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: colors.primary.tint,
			}}
		>
			<Text weight="bold" color={colors.primary.ink as string}>
				{initials}
			</Text>
		</View>
	);
}
