import {
	type LivenessChallenge,
	livenessChallengeSchema,
} from "@nabhya/shared";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import { RotateCcw } from "lucide-react-native";
import { useRef, useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { useImageUpload } from "@/hooks/use-upload";

export interface SelfieCaptureValue {
	primaryKey: string;
	secondaryFrameKey: string;
	challenge: LivenessChallenge;
}

const CHALLENGE_PROMPT: Record<LivenessChallenge, string> = {
	BLINK: "blink your eyes",
	TURN_LEFT: "turn your head slightly left",
	TURN_RIGHT: "turn your head slightly right",
	SMILE: "smile",
	NOD: "nod your head",
};

const CHALLENGES = livenessChallengeSchema.options;

/**
 * Selfie step with a lightweight liveness check. The volunteer captures a
 * straight-on frame and then a second frame performing a randomly chosen action
 * (blink, turn, smile). Both frames are uploaded to storage — the straight-on
 * one as the selfie, the action frame recorded in the document's liveness
 * metadata — so a reviewer can see motion rather than a single still, which
 * deters photo-of-a-photo spoofing. This is a deterrent and a reviewer aid, not
 * an automated biometric check.
 */
export function SelfieCapture({
	onChange,
	disabled,
}: {
	onChange: (value: SelfieCaptureValue | null) => void;
	disabled?: boolean;
}) {
	const { colors, spacing, borderRadius, withOpacity } = useTheme();
	const { uploadImage, isUploading, error } = useImageUpload("USER_DOCUMENT");
	const [permission, requestPermission] = useCameraPermissions();
	const cameraRef = useRef<CameraView>(null);

	// One fixed challenge per attempt. Math.random is fine at app runtime.
	const [challenge] = useState<LivenessChallenge>(
		() => CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)] ?? "BLINK",
	);
	const [step, setStep] = useState<"neutral" | "action" | "done">("neutral");
	const [isReady, setIsReady] = useState(false);
	const [neutralPreview, setNeutralPreview] = useState<string | null>(null);
	const [primaryKey, setPrimaryKey] = useState<string | null>(null);

	const busy = isUploading || disabled;

	const reset = () => {
		setStep("neutral");
		setNeutralPreview(null);
		setPrimaryKey(null);
		onChange(null);
	};

	const capture = async () => {
		if (!cameraRef.current || !isReady || busy) return;
		const photo = await cameraRef.current.takePictureAsync({ quality: 0.6 });
		if (!photo) return;

		if (step === "neutral") {
			const uploaded = await uploadImage(photo.uri, {
				fileName: "selfie.jpg",
				sourceWidth: photo.width,
				maxWidth: 1200,
			});
			if (uploaded) {
				setNeutralPreview(photo.uri);
				setPrimaryKey(uploaded.key);
				setStep("action");
			}
			return;
		}

		// step === "action": the challenge frame.
		if (!primaryKey) return;
		const uploaded = await uploadImage(photo.uri, {
			fileName: "selfie-liveness.jpg",
			sourceWidth: photo.width,
			maxWidth: 1200,
		});
		if (uploaded) {
			setStep("done");
			onChange({ primaryKey, secondaryFrameKey: uploaded.key, challenge });
		}
	};

	if (!permission) {
		return <Caption color="tertiary">Checking camera…</Caption>;
	}

	if (!permission.granted) {
		return (
			<View style={{ gap: spacing[3] }}>
				<Body weight="bold">2 · Verification selfie</Body>
				<Caption color="tertiary">
					We use your front camera for a quick selfie to confirm you're a real
					person. The photos are private and seen only by our reviewers.
				</Caption>
				<Button variant="outline" onPress={() => requestPermission()}>
					Enable camera
				</Button>
			</View>
		);
	}

	if (step === "done" && neutralPreview) {
		return (
			<View style={{ gap: spacing[3] }}>
				<Body weight="bold">2 · Verification selfie</Body>
				<Image
					source={{ uri: neutralPreview }}
					style={{
						width: 140,
						height: 180,
						borderRadius: borderRadius.lg,
						backgroundColor: colors.background.tertiary,
					}}
					contentFit="cover"
				/>
				<Caption color={colors.success.main as string} weight="medium">
					Selfie captured
				</Caption>
				<Pressable
					onPress={reset}
					disabled={busy}
					hitSlop={8}
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[2],
					}}
				>
					<RotateCcw size={14} color={colors.text.secondary as string} />
					<Caption weight="medium" color="secondary">
						Retake
					</Caption>
				</Pressable>
			</View>
		);
	}

	const instruction =
		step === "neutral"
			? "Center your face in the frame and look straight at the camera."
			: `Now ${CHALLENGE_PROMPT[challenge]}, then capture again.`;

	return (
		<View style={{ gap: spacing[3] }}>
			<Body weight="bold">2 · Verification selfie</Body>
			<Caption color="tertiary">{instruction}</Caption>

			<View
				style={{
					width: "100%",
					height: 360,
					borderRadius: borderRadius.lg,
					overflow: "hidden",
					backgroundColor: colors.neutral[900] as string,
				}}
			>
				<CameraView
					ref={cameraRef}
					style={{ flex: 1 }}
					facing="front"
					onCameraReady={() => setIsReady(true)}
				/>
			</View>

			<View
				style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}
			>
				<View
					style={{
						width: 8,
						height: 8,
						borderRadius: 4,
						backgroundColor:
							step === "neutral"
								? colors.primary.main
								: withOpacity(colors.primary.main as string, 0.3),
					}}
				/>
				<View
					style={{
						width: 8,
						height: 8,
						borderRadius: 4,
						backgroundColor:
							step === "action"
								? colors.primary.main
								: withOpacity(colors.primary.main as string, 0.3),
					}}
				/>
				<Caption color="quaternary">
					{step === "neutral" ? "Step 1 of 2" : "Step 2 of 2"}
				</Caption>
			</View>

			<Button onPress={capture} disabled={!isReady || busy} loading={busy}>
				{step === "neutral" ? "Capture" : "Capture challenge"}
			</Button>

			{error && <Caption color={colors.error.main as string}>{error}</Caption>}
		</View>
	);
}
