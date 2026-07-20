import { useRouter } from "expo-router";
import { Bell } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { Caption } from "@/components/ui/typography";
import { useUnreadCount } from "@/hooks/use-engagement";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/store/auth-store";

/**
 * Inbox entry point with an unread badge. Dropped into screen headers so the
 * notifications route is actually reachable from the app.
 */
export function NotificationBell() {
	const { colors } = useTheme();
	const router = useRouter();
	const email = useAuthStore((s) => s.email);

	const { data } = useUnreadCount(!!email);
	const unread = data?.unreadCount ?? 0;

	if (!email) return null;

	return (
		<Pressable
			onPress={() => router.push("/notifications")}
			hitSlop={10}
			style={{
				width: 44,
				height: 44,
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<Bell size={22} color={colors.text.secondary as string} />

			{unread > 0 && (
				<View
					style={{
						position: "absolute",
						top: 6,
						right: 4,
						minWidth: 18,
						height: 18,
						borderRadius: 9,
						paddingHorizontal: 4,
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: colors.primary.main,
					}}
				>
					<Caption
						weight="bold"
						color={colors.primary.contrast as string}
						style={{ fontSize: 10, lineHeight: 13 }}
					>
						{unread > 9 ? "9+" : unread}
					</Caption>
				</View>
			)}
		</Pressable>
	);
}
