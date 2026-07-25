import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { Pressable, type ViewStyle } from "react-native";
import { useMedia } from "@/hooks/useMedia";
import { useTheme } from "@/hooks/useTheme";

interface BackButtonProps {
	hitSlop?: number;
	size?: number;
	color?: string;
	style?: ViewStyle;
}

export function BackButton({
	hitSlop = 12,
	size = 22,
	color,
	style,
}: BackButtonProps) {
	const { isDesktop } = useMedia();
	const { colors, spacing } = useTheme();
	const router = useRouter();

	if (isDesktop) return null;

	return (
		<Pressable
			onPress={() => router.back()}
			hitSlop={hitSlop}
			style={{ marginBottom: spacing[4], ...style }}
		>
			<ArrowLeft
				size={size}
				color={color ?? (colors.text.secondary as string)}
			/>
		</Pressable>
	);
}
