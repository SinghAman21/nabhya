import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Screen, ScreenHeader } from "@/components/screen-shell";
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
 */
export default function VerifyIdentity() {
	const { spacing } = useTheme();
	const router = useRouter();
	const upload = useUploadUserDocument();

	const [idValue, setIdValue] = useState<IdCaptureValue | null>(null);
	const [selfieValue, setSelfieValue] = useState<SelfieCaptureValue | null>(
		null,
	);
	const [submitting, setSubmitting] = useState(false);

	const canSubmit = !!idValue && !!selfieValue && !submitting;

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
				"Your ID and selfie are in. We'll update your verification status once a reviewer checks them.",
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
				subtitle="Upload a government ID and take a quick selfie so NGOs know they can trust your application."
			/>

			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ paddingBottom: spacing[10], gap: spacing[8] }}
				keyboardShouldPersistTaps="handled"
				automaticallyAdjustKeyboardInsets
			>
				<IdCapture onChange={setIdValue} disabled={submitting} />
				<SelfieCapture onChange={setSelfieValue} disabled={submitting} />

				<View style={{ gap: spacing[2] }}>
					<Button onPress={submit} disabled={!canSubmit} loading={submitting}>
						Submit for verification
					</Button>
					{(!idValue || !selfieValue) && (
						<Caption color="quaternary" style={{ textAlign: "center" }}>
							Add both your government ID and a selfie to submit.
						</Caption>
					)}
				</View>
			</ScrollView>
		</Screen>
	);
}
