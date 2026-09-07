import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { withAppShell } from "@/components/app-shell";
import {
	Banner,
	Screen,
	ScreenHeader,
	SectionTitle,
	Surface,
} from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { Caption } from "@/components/ui/typography";
import {
	IdCapture,
	type IdCaptureValue,
} from "@/components/verification/id-capture";
import {
	SelfieCapture,
	type SelfieCaptureValue,
} from "@/components/verification/selfie-capture";
import { useUploadUserDocument } from "@/hooks/use-documents";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { apiErrorMessage } from "@/lib/api";
import { verticalScrollbar } from "@/lib/scroll";

/**
 * Volunteer identity verification: capture a government ID and a liveness
 * selfie, upload both to storage, then submit them for a superadmin to review.
 * The account only becomes VERIFIED once both are approved (enforced server
 * side), so this screen requires both before it lets you submit.
 *
 * Two steps, each on its own card, and the submit pinned at the bottom so it is
 * always reachable — the selfie step is tall, and burying the button under it
 * made people think the page ended at the camera.
 *
 * The two cards sit side by side on desktop. Stacked, the camera pushed the ID
 * card a screen away, so the page read as one long task with a hidden second
 * half; in a row both steps and their progress are visible at once, which is
 * the whole point of having the space.
 *
 * Both outcomes are stated on the page, not in an `Alert`. A blocking OS dialog
 * over a form is the wrong shape for either: the failure has to stay visible
 * while you retake a photo, and the success has to survive being read — an
 * alert you dismiss leaves a screen that looks exactly like the one that had
 * not been submitted yet.
 */
function VerifyIdentity() {
	const { colors, spacing } = useTheme();
	const { isDesktop } = useMedia();
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const upload = useUploadUserDocument();

	const [idValue, setIdValue] = useState<IdCaptureValue | null>(null);
	const [selfieValue, setSelfieValue] = useState<SelfieCaptureValue | null>(
		null,
	);
	const [submitting, setSubmitting] = useState(false);
	const [submitted, setSubmitted] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const done = [idValue, selfieValue].filter(Boolean).length;
	const canSubmit = done === 2 && !submitting && !submitted;

	const submit = async () => {
		if (!idValue || !selfieValue) return;
		setSubmitting(true);
		setError(null);
		try {
			await upload.mutateAsync({
				documentType: idValue.documentType,
				documentKey: idValue.key,
			});
			await upload.mutateAsync({
				documentType: "SELFIE",
				documentKey: selfieValue.primaryKey,
				metadata: {
					liveness: {
						challenge: selfieValue.challenge,
						secondaryFrameKey: selfieValue.secondaryFrameKey,
					},
				},
			});
			setSubmitted(true);
		} catch (e) {
			setError(
				apiErrorMessage(
					e,
					"We couldn't submit your documents. Check your connection and try again.",
				),
			);
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Screen>
			<ScreenHeader
				back
				title="Get verified"
				subtitle="A government ID and a quick selfie"
			/>

			<ScrollView
				{...verticalScrollbar}
				contentContainerStyle={{ paddingBottom: spacing[6] }}
				keyboardShouldPersistTaps="handled"
			>
				<View style={{ marginBottom: spacing[5] }}>
					{submitted ? (
						<Banner
							tone="success"
							title="Submitted for review"
							description="Your ID and selfie are in. A reviewer usually gets to them within a day or two, and the result shows on your profile."
						/>
					) : (
						<Banner
							tone="info"
							title="Why verify?"
							description="NGOs accept verified volunteers first. Your documents are seen only by Nabhya's reviewers, never by NGOs."
						/>
					)}
				</View>

				<View
					style={{
						flexDirection: isDesktop ? "row" : "column",
						gap: isDesktop ? spacing[5] : 0,
						alignItems: "flex-start",
					}}
				>
					<View
						style={{
							flex: isDesktop ? 1 : undefined,
							width: isDesktop ? undefined : "100%",
						}}
					>
						<SectionTitle>Step 1 · Your ID</SectionTitle>
						<Surface
							style={isDesktop ? undefined : { marginBottom: spacing[5] }}
						>
							<IdCapture
								onChange={setIdValue}
								disabled={submitting || submitted}
							/>
						</Surface>
					</View>

					<View
						style={{
							flex: isDesktop ? 1 : undefined,
							width: isDesktop ? undefined : "100%",
						}}
					>
						<SectionTitle>Step 2 · Selfie</SectionTitle>
						<Surface>
							<SelfieCapture
								onChange={setSelfieValue}
								disabled={submitting || submitted}
							/>
						</Surface>
					</View>
				</View>
			</ScrollView>

			<View
				style={{
					paddingTop: spacing[3],
					paddingBottom: insets.bottom + spacing[3],
					borderTopWidth: 1,
					borderTopColor: colors.border.hairline,
					gap: spacing[2],
				}}
			>
				{/* The failure sits directly above the control that caused it, so it
				    is still on screen while the photo is retaken. */}
				{error ? (
					<Caption
						accessibilityLiveRegion="polite"
						color={colors.error.ink as string}
						style={{ textAlign: "center" }}
					>
						{error}
					</Caption>
				) : null}

				{submitted ? (
					<Button onPress={() => router.back()}>Done</Button>
				) : (
					<Button onPress={submit} disabled={!canSubmit} loading={submitting}>
						Submit for review
					</Button>
				)}

				<Caption color="quaternary" style={{ textAlign: "center" }}>
					{submitted
						? "Nothing else to do here — we'll notify you when it's reviewed."
						: done === 2
							? "Both captured. Ready to submit."
							: `${done} of 2 captured. Add ${idValue ? "your selfie" : selfieValue ? "your ID" : "both"} to continue.`}
				</Caption>
			</View>
		</Screen>
	);
}

export default withAppShell(VerifyIdentity);
