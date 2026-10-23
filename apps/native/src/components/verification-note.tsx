import { useRouter } from "expo-router";
import { View } from "react-native";
import { Banner } from "@/components/screen-shell";
import { useIdentityStatus } from "@/hooks/use-documents";
import { useTheme } from "@/hooks/use-theme";
import { useAuthStore } from "@/store/auth-store";

/**
 * One line, shown inside the apply and pledge sheets to a volunteer who is not
 * verified yet: NGOs accept verified volunteers first.
 *
 * That constraint used to live only on the Profile banner, so a volunteer
 * learned it after applying - if at all - from an application that sat
 * pending. Said before the submit button, it is something they can act on.
 * Shown, never blocking: an unverified volunteer may still apply.
 *
 * `onNavigate` closes the host sheet first: the sheet is a modal, and pushing
 * a route under it would leave the verification screen hidden behind it.
 */
export function VerificationNote({ onNavigate }: { onNavigate: () => void }) {
	const { spacing } = useTheme();
	const router = useRouter();
	const email = useAuthStore((s) => s.email);
	const role = useAuthStore((s) => s.role);
	const isVolunteer = !!email && role === "volunteer";
	const identity = useIdentityStatus(isVolunteer);

	if (!isVolunteer || identity.loading || identity.state === "verified") {
		return null;
	}

	// Someone who has already sent their ID has nothing to do; telling them to
	// "verify now" read as if the submission had been lost.
	const copy =
		identity.state === "review"
			? {
					tone: "info" as const,
					title: "Your ID is being checked",
					description:
						"You can apply meanwhile - NGOs see the verified badge once it's approved.",
				}
			: identity.state === "partial"
				? {
						tone: "warning" as const,
						title: "Your identity submission is incomplete",
						description:
							"Finish the missing photo and submit both documents for review.",
					}
				: identity.state === "rejected"
					? {
							tone: "warning" as const,
							title: "Your ID needs another look",
							description:
								"NGOs accept verified volunteers first. Tap to retake your photos.",
						}
					: {
							tone: "info" as const,
							title: "NGOs accept verified volunteers first",
							description:
								"Verify your ID - an Aadhaar photo and a selfie. Tap to start.",
						};

	return (
		<View style={{ marginBottom: spacing[4] }}>
			<Banner
				{...copy}
				{...(identity.state === "review"
					? {}
					: {
							onPress: () => {
								onNavigate();
								router.push("/verify-identity");
							},
						})}
			/>
		</View>
	);
}
