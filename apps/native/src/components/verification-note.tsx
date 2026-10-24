import { useRouter } from "expo-router";
import { Platform, View } from "react-native";
import { Banner } from "@/components/screen-shell";
import { useIdentityStatus } from "@/hooks/use-documents";
import { useTheme } from "@/hooks/use-theme";
import { useAuthStore } from "@/store/auth-store";

/**
 * Whether the signed-in volunteer may apply or pledge yet.
 *
 * The server refuses both until the identity is VERIFIED
 * (`assertIdentityVerified`); this mirrors it so the submit button is disabled
 * with the reason beside it, instead of the volunteer filling in a message and
 * learning on submit. `blocked` is false while loading so the button does not
 * flash disabled for a verified volunteer - the server still has the last say.
 */
export function useIdentityGate() {
	const email = useAuthStore((s) => s.email);
	const role = useAuthStore((s) => s.role);
	const isVolunteer = !!email && role === "volunteer";
	const identity = useIdentityStatus(isVolunteer);

	return {
		identity,
		isVolunteer,
		blocked: isVolunteer && !identity.loading && identity.state !== "verified",
	};
}

/**
 * One line, shown inside the apply and pledge sheets to a volunteer who is not
 * verified yet: applying and pledging need a verified identity.
 *
 * Said before the submit button so it is something they can act on, with the
 * button beneath it disabled by the same `useIdentityGate`.
 *
 * `onNavigate` closes the host sheet first: the sheet is a modal, and anything
 * opened under it would be hidden behind it. With `onVerify` the screen that
 * owns the host sheet then opens its `VerifyIdentitySheet` - sequentially,
 * never nested, and a beat later on native so the first modal has finished
 * dismissing (iOS will not present over a modal that is still leaving).
 * Without it the note falls back to the `/verify-identity` route.
 */
export function VerificationNote({
	onNavigate,
	onVerify,
}: {
	onNavigate: () => void;
	onVerify?: () => void;
}) {
	const { spacing } = useTheme();
	const router = useRouter();
	const { identity, blocked } = useIdentityGate();

	if (!blocked) return null;

	// Someone who has already sent their ID has nothing to do; telling them to
	// "verify now" read as if the submission had been lost.
	const copy =
		identity.state === "review"
			? {
					tone: "info" as const,
					title: "Your ID is being checked",
					description:
						"You can apply and pledge as soon as it's approved - usually within a day.",
				}
			: identity.state === "partial"
				? {
						tone: "warning" as const,
						title: "Your identity submission is incomplete",
						description:
							"Finish the missing photo and submit both documents. Applying and pledging open once they're approved.",
					}
				: identity.state === "rejected"
					? {
							tone: "warning" as const,
							title: "Your ID needs another look",
							description:
								"Applying and pledging need a verified ID. Tap to retake your photos.",
						}
					: {
							tone: "info" as const,
							title: "Verify your ID to take part",
							description:
								"NGOs meet volunteers in person, so applying and pledging need an Aadhaar photo and a selfie. Tap to start.",
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
								if (!onVerify) {
									router.push("/verify-identity");
									return;
								}
								setTimeout(onVerify, Platform.OS === "web" ? 0 : 350);
							},
						})}
			/>
		</View>
	);
}
