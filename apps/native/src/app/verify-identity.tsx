import { useRouter } from "expo-router";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { withAppShell } from "@/components/app-shell";
import { Screen, ScreenHeader } from "@/components/screen-shell";
import { useVerifyIdentityFlow } from "@/components/verification/verify-identity-sheet";
import { useTheme } from "@/hooks/use-theme";
import { verticalScrollbar } from "@/lib/scroll";

/**
 * The deep-link host for identity verification. The app itself opens the flow
 * as `VerifyIdentitySheet` (Profile, the identity gate on Apply / Pledge); this
 * route exists for the notification that points here and for a link someone
 * pasted, and renders exactly the same flow.
 *
 * 880 rather than the 720 reading column: the two capture panels sit side by
 * side on desktop. The footer is a hairline row under the scroll, with the
 * action sized to its label - it used to be a Done bar the width of the page.
 */
const COLUMN = { width: "100%", maxWidth: 880, alignSelf: "center" } as const;

function VerifyIdentity() {
	const { colors, spacing } = useTheme();
	const insets = useSafeAreaInsets();
	const router = useRouter();

	const leave = () => {
		if (router.canGoBack()) router.back();
		else router.replace("/(volunteer)/me");
	};

	const flow = useVerifyIdentityFlow({ onDone: leave });

	return (
		<Screen style={COLUMN}>
			<ScreenHeader
				back
				title="Verify your identity"
				subtitle="An Aadhaar photo and a quick selfie"
			/>

			<ScrollView
				{...verticalScrollbar}
				contentContainerStyle={{ paddingBottom: spacing[6] }}
				keyboardShouldPersistTaps="handled"
			>
				{flow.body}
			</ScrollView>

			{flow.footer ? (
				<View
					style={{
						paddingTop: spacing[3],
						paddingBottom: insets.bottom + spacing[3],
						borderTopWidth: 1,
						borderTopColor: colors.border.hairline,
					}}
				>
					{flow.footer}
				</View>
			) : null}
		</Screen>
	);
}

export default withAppShell(VerifyIdentity);
