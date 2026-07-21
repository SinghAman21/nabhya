import { useRouter } from "expo-router";
import { View } from "react-native";
import { EventFeed } from "@/components/event-feed";
import { ScreenHeader } from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/store/auth-store";

/**
 * Public directory of volunteering events. Anyone can browse this without an
 * account; applying prompts a sign-in.
 */
export default function PublicEvents() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const email = useAuthStore((s) => s.email);

	return (
		<View
			style={{
				flex: 1,
				backgroundColor: colors.background.warm,
				paddingHorizontal: spacing[6],
				paddingTop: spacing[8],
			}}
		>
			<EventFeed
				header={
					<ScreenHeader
						title="Volunteer"
						subtitle="Events from verified NGOs across India."
						action={
							email ? (
								<Button
									size="sm"
									variant="outline"
									onPress={() => router.replace("/")}
								>
									My account
								</Button>
							) : (
								<Button size="sm" onPress={() => router.push("/(auth)/login")}>
									Sign in
								</Button>
							)
						}
					/>
				}
			/>
		</View>
	);
}
