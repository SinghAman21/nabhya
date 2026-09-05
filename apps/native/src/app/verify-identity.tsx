import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { Alert } from "@/lib/alert";
import { apiErrorMessage } from "@/lib/api";

/**
 * Volunteer identity verification: capture a government ID and a liveness
 * selfie, upload both to storage, then submit them for a superadmin to review.
 * The account only becomes VERIFIED once both are approved (enforced server
 * side), so this screen requires both before it lets you submit.
 *
 * Two steps, each on its own card, and the submit pinned at the bottom so it is
 * always reachable — the selfie step is tall, and burying the button under it
 * made people think the page ended at the camera.
 */
export default function VerifyIdentity() {
	const { colors, spacing } = useTheme();
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const upload = useUploadUserDocument();

	const [idValue, setIdValue] = useState<IdCaptureValue | null>(null);
	const [selfieValue, setSelfieValue] = useState<SelfieCaptureValue | null>(
		null,
	);
	const [submitting, setSubmitting] = useState(false);

	const done = [idValue, selfieValue].filter(Boolean).length;
	const canSubmit = done === 2 && !submitting;

	const submit = async () => {
		if (!idValue || !selfieValue) return;
		setSubmitting(true);
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
			Alert.alert(
				"Submitted for review",
				"Your ID and selfie are in. A reviewer usually gets to them within a day or two, and you'll see the result on your profile.",
				[{ text: "Done", onPress: () => router.back() }],
			);
		} catch (e) {
			Alert.alert("Could not submit", apiErrorMessage(e));
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
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ paddingBottom: spacing[6] }}
				keyboardShouldPersistTaps="handled"
			>
				<View style={{ marginBottom: spacing[5] }}>
					<Banner
						tone="info"
						title="Why verify?"
						description="NGOs accept verified volunteers first. Your documents are seen only by Nabhya's reviewers, never by NGOs."
					/>
				</View>

				<SectionTitle>Step 1 of 2</SectionTitle>
				<Surface style={{ marginBottom: spacing[5] }}>
					<IdCapture onChange={setIdValue} disabled={submitting} />
				</Surface>

				<SectionTitle>Step 2 of 2</SectionTitle>
				<Surface>
					<SelfieCapture onChange={setSelfieValue} disabled={submitting} />
				</Surface>
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
				<Button onPress={submit} disabled={!canSubmit} loading={submitting}>
					Submit for review
				</Button>
				<Caption color="quaternary" style={{ textAlign: "center" }}>
					{done === 2
						? "Both captured. Ready to submit."
						: `${done} of 2 captured. Add ${idValue ? "your selfie" : selfieValue ? "your ID" : "both"} to continue.`}
				</Caption>
			</View>
		</Screen>
	);
}
