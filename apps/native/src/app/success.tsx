import { useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import { View } from "react-native";
import { Screen } from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { Body, Caption, H2 } from "@/components/ui/typography";
import { useMe } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { useAuthStore } from "@/store/auth-store";

/**
 * The landing after an NGO finishes onboarding. One message, one button. The
 * gate at `/` reads the role and takes it from here.
 */
export default function Success() {
	const { colors, spacing } = useTheme();
	const { isDesktop } = useMedia();
	const router = useRouter();
	const email = useAuthStore((s) => s.email);
	const me = useMe(!!email);

	const isOrganisation = me.data?.roles?.includes("organisation") ?? false;
	const firstName = me.data?.name?.trim().split(/\s+/)[0];

	return (
		<Screen>
			<View
				style={{
					flex: 1,
					justifyContent: "center",
					alignItems: "center",
					paddingBottom: spacing[10],
					...(isDesktop
						? { width: "100%", maxWidth: 420, alignSelf: "center" }
						: {}),
				}}
			>
				<View
					style={{
						width: 72,
						height: 72,
						borderRadius: 36,
						backgroundColor: colors.success.bg,
						alignItems: "center",
						justifyContent: "center",
						marginBottom: spacing[5],
					}}
				>
					<Check size={32} strokeWidth={2.6} color={colors.success.ink} />
				</View>

				<H2 accessibilityRole="header" style={{ textAlign: "center" }}>
					{firstName ? `You're all set, ${firstName}` : "You're all set"}
				</H2>
				<Body
					color="tertiary"
					style={{
						textAlign: "center",
						marginTop: spacing[2],
						marginBottom: spacing[8],
					}}
				>
					{isOrganisation
						? "Your NGO is registered. A reviewer will check your documents — you can start setting up events and needs in the meantime."
						: "Your account is ready. Let's find something worth your time."}
				</Body>

				<Button
					onPress={() => router.replace("/")}
					size="lg"
					style={{ alignSelf: "stretch" }}
				>
					Continue
				</Button>
				{email && (
					<Caption
						color="quaternary"
						numberOfLines={1}
						style={{ marginTop: spacing[4] }}
					>
						Signed in as {email}
					</Caption>
				)}
			</View>
		</Screen>
	);
}
