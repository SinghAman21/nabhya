import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { withAppShell } from "@/components/app-shell";
import {
	Banner,
	LoadingState,
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
import {
	useIdentityStatus,
	useUploadUserDocument,
} from "@/hooks/use-documents";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { apiErrorMessage } from "@/lib/api";
import { verticalScrollbar } from "@/lib/scroll";

/**
 * Two capture cards sit side by side on desktop, so this page gets more than
 * the 720 reading column - but not the top bar's 1180, where each camera card
 * stretched to 560 and the pinned Submit became a bar the width of the window.
 */
const READING_WIDE = {
	width: "100%",
	maxWidth: 960,
	alignSelf: "center",
} as const;

/**
 * Volunteer identity verification: capture a government ID and a liveness
 * selfie, upload both to storage, then submit them for a superadmin to review.
 * The account only becomes VERIFIED once both are approved (enforced server
 * side), so this screen requires both before it lets you submit.
 *
 * Two steps, each on its own card, and the submit pinned at the bottom so it is
 * always reachable - the selfie step is tall, and burying the button under it
 * made people think the page ended at the camera.
 *
 * The two cards sit side by side on desktop. Stacked, the camera pushed the ID
 * card a screen away, so the page read as one long task with a hidden second
 * half; in a row both steps and their progress are visible at once, which is
 * the whole point of having the space.
 *
 * Both outcomes are stated on the page, not in an `Alert`. A blocking OS dialog
 * over a form is the wrong shape for either: the failure has to stay visible
 * while you retake a photo, and the success has to survive being read - an
 * alert you dismiss leaves a screen that looks exactly like the one that had
 * not been submitted yet.
 */
function VerifyIdentity() {
	const { colors, spacing } = useTheme();
	const { isDesktop } = useMedia();
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const upload = useUploadUserDocument();
	const identity = useIdentityStatus();
	// A pending submission hides the capture form until asked for: offering it
	// unprompted read as "your upload was lost, do it again".
	const [replacing, setReplacing] = useState(false);

	const [idValue, setIdValue] = useState<IdCaptureValue | null>(null);
	const [selfieValue, setSelfieValue] = useState<SelfieCaptureValue | null>(
		null,
	);
	const [submitting, setSubmitting] = useState(false);
	const [submitted, setSubmitted] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const replaceAll = identity.state === "rejected" || replacing;
	const needsId = replaceAll || !identity.hasGovId;
	const needsSelfie = replaceAll || !identity.hasSelfie;
	const required = Number(needsId) + Number(needsSelfie);
	const done =
		Number(needsId && !!idValue) + Number(needsSelfie && !!selfieValue);
	const canSubmit =
		required > 0 && done === required && !submitting && !submitted;

	const submit = async () => {
		if ((needsId && !idValue) || (needsSelfie && !selfieValue)) return;
		// Keep both replacement captures visible if the first upload changes the
		// server state before the second upload fails.
		if (identity.state === "rejected") setReplacing(true);
		setSubmitting(true);
		setError(null);
		try {
			if (needsId && idValue) {
				await upload.mutateAsync({
					documentType: idValue.documentType,
					documentKey: idValue.key,
				});
			}
			if (needsSelfie && selfieValue) {
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
			}
			setSubmitted(true);
			identity.refetch();
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

	const leave = () => {
		if (router.canGoBack()) router.back();
		else router.replace("/(volunteer)/profile");
	};

	const footerBar = {
		paddingTop: spacing[3],
		paddingBottom: insets.bottom + spacing[3],
		borderTopWidth: 1,
		borderTopColor: colors.border.hairline,
		gap: spacing[2],
	} as const;

	const header = (
		<ScreenHeader
			back
			title="Get verified"
			subtitle="A government ID and a quick selfie"
		/>
	);

	if (identity.loading && !submitted) {
		return (
			<Screen style={READING_WIDE}>
				{header}
				<LoadingState />
			</Screen>
		);
	}

	// Nothing to capture: say where things stand and offer the way out. The
	// row in Profile opens this screen whatever the state, so a verified
	// volunteer used to land on "Why verify?" and two empty camera cards.
	if (
		!submitted &&
		(identity.state === "verified" ||
			(identity.state === "review" && !replacing))
	) {
		const verified = identity.state === "verified";
		return (
			<Screen style={READING_WIDE}>
				{header}
				<View style={{ flex: 1 }}>
					<Banner
						tone={verified ? "success" : "info"}
						title={verified ? "You're verified" : "Submitted - under review"}
						description={
							verified
								? "NGOs see the verified badge on your applications and offers. There's nothing else to do here."
								: "A reviewer is checking your ID and selfie, usually within a day or two. You'll get a notification in Activity with the result."
						}
					/>
				</View>
				<View style={footerBar}>
					<Button onPress={leave}>Done</Button>
					{verified ? null : (
						<Button variant="ghost" onPress={() => setReplacing(true)}>
							Replace my photos
						</Button>
					)}
				</View>
			</Screen>
		);
	}

	return (
		<Screen style={READING_WIDE}>
			{header}

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
					) : identity.state === "rejected" ? (
						<Banner
							tone="error"
							title="Your last submission needs another look"
							description={
								identity.remarks
									? `Reviewer's note: ${identity.remarks} Retake whichever photo it mentions and submit again.`
									: "Retake your ID and selfie - make sure the text is sharp and your face is well lit - and submit again."
							}
						/>
					) : identity.state === "partial" ? (
						<Banner
							tone="warning"
							title="One document received"
							description={
								identity.hasGovId
									? "We received your ID, but your selfie has not been submitted. Complete both steps below and submit again."
									: "We received your selfie, but your ID has not been submitted. Complete both steps below and submit again."
							}
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
						{needsId ? (
							<>
								<SectionTitle>Step 1 · Your ID</SectionTitle>
								<Surface
									style={isDesktop ? undefined : { marginBottom: spacing[5] }}
								>
									<IdCapture
										onChange={setIdValue}
										disabled={submitting || submitted}
									/>
								</Surface>
							</>
						) : (
							<Surface>
								<Banner
									tone="success"
									title="Government ID already received"
									description="Only your selfie remains to submit."
								/>
							</Surface>
						)}
					</View>

					<View
						style={{
							flex: isDesktop ? 1 : undefined,
							width: isDesktop ? undefined : "100%",
						}}
					>
						{needsSelfie ? (
							<>
								<SectionTitle>Step 2 · Selfie</SectionTitle>
								<Surface>
									<SelfieCapture
										onChange={setSelfieValue}
										disabled={submitting || submitted}
									/>
								</Surface>
							</>
						) : (
							<Surface>
								<Banner
									tone="success"
									title="Selfie already received"
									description="Only your government ID remains to submit."
								/>
							</Surface>
						)}
					</View>
				</View>
			</ScrollView>

			<View style={footerBar}>
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
					<Button onPress={leave}>Done</Button>
				) : (
					<Button onPress={submit} disabled={!canSubmit} loading={submitting}>
						{error ? "Retry submission" : "Submit for review"}
					</Button>
				)}

				<Caption color="quaternary" style={{ textAlign: "center" }}>
					{submitted
						? "Nothing else to do here - we'll notify you when it's reviewed."
						: done === required
							? "All required photos are ready."
							: `${done} of ${required} required captures ready. Add ${needsId && !idValue ? "your ID" : needsSelfie && !selfieValue ? "your selfie" : "the required photo"} to continue.`}
				</Caption>
			</View>
		</Screen>
	);
}

export default withAppShell(VerifyIdentity);
