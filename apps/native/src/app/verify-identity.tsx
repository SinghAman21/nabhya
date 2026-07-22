import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { ScreenHeader } from "@/components/screen-shell";
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
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";

/**
 * Volunteer identity verification: capture a government ID and a liveness
 * selfie, upload both to storage, then submit them for a superadmin to review.
 * The account only becomes VERIFIED once both are approved (enforced server
 * side), so this screen requires both before it lets you submit.
 */
export default function VerifyIdentity() {
	const { colors, spacing } = useTheme();
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
		<View
			style={{
				flex: 1,
				backgroundColor: colors.background.warm,
				paddingHorizontal: spacing[6],
				paddingTop: spacing[8],
			}}
		>
			<Pressable
				onPress={() => router.back()}
				hitSlop={8}
				style={{ marginBottom: spacing[2] }}
			>
				<ArrowLeft size={24} color={colors.text.primary as string} />
			</Pressable>

			<ScreenHeader
				title="Get verified"
				subtitle="Upload a government ID and take a quick selfie so NGOs know they can trust your application."
			/>

			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ paddingBottom: spacing[10], gap: spacing[8] }}
				keyboardShouldPersistTaps="handled"
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
		</View>
	);
}
