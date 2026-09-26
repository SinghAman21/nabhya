import { USER_DOCUMENT_LABELS, type UserDocumentType } from "@nabhya/shared";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Camera, ImageUp, RotateCcw } from "lucide-react-native";
import type { ReactNode } from "react";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { Caption, H5 } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { useImageUpload } from "@/hooks/use-upload";
import { focusable } from "@/lib/focus";

export interface IdCaptureValue {
	documentType: UserDocumentType;
	key: string;
}

/**
 * One government ID, and only one: the Aadhaar card.
 *
 * The step used to open with a chip row of every accepted ID - Aadhaar, PAN,
 * licence, voter ID, passport - which read as a checklist of documents to
 * produce rather than a choice between them, and made the first thing on the
 * screen a decision nobody needed to make. Aadhaar is the near-universal one
 * and the only ID a reviewer can check a name and a photo against, so the
 * screen asks for it by name. `documentType` stays on the value because the
 * server accepts the whole enum and a reviewer sees which type they are
 * looking at; widening this back into a picker is a UI change, not a schema
 * one.
 *
 * The image is normalised and uploaded straight to storage; the parent receives
 * only the document type and the resulting object key.
 */
const ID_TYPE: UserDocumentType = "AADHAR_CARD";

export function IdCapture({
	onChange,
	disabled,
}: {
	onChange: (value: IdCaptureValue | null) => void;
	disabled?: boolean;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	const { uploadImage, isUploading, error } = useImageUpload("USER_DOCUMENT");
	const [preview, setPreview] = useState<string | null>(null);
	const [permissionError, setPermissionError] = useState<string | null>(null);

	const busy = isUploading || disabled;

	const handleAsset = async (asset?: { uri: string; width?: number }) => {
		if (!asset) return;
		const uploaded = await uploadImage(asset.uri, {
			fileName: `${ID_TYPE.toLowerCase()}.jpg`,
			sourceWidth: asset.width,
		});
		if (uploaded) {
			setPreview(asset.uri);
			onChange({ documentType: ID_TYPE, key: uploaded.key });
		}
	};

	const takePhoto = async () => {
		setPermissionError(null);
		const permission = await ImagePicker.requestCameraPermissionsAsync();
		if (!permission.granted) {
			// Inline, beside the buttons that caused it: an OS dialog has to be
			// dismissed before you can reach "Choose file", which is the way out.
			setPermissionError(
				"Camera access is off. Allow it in settings, or choose a photo from your library instead.",
			);
			return;
		}
		const result = await ImagePicker.launchCameraAsync({
			mediaTypes: ["images"],
			quality: 0.7,
		});
		if (!result.canceled) await handleAsset(result.assets[0]);
	};

	const chooseFromLibrary = async () => {
		setPermissionError(null);
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ["images"],
			quality: 0.7,
		});
		if (!result.canceled) await handleAsset(result.assets[0]);
	};

	return (
		<View style={{ gap: spacing[3] }}>
			<View>
				<H5>{USER_DOCUMENT_LABELS[ID_TYPE] ?? "Government ID"}</H5>
				<Caption color="tertiary" style={{ marginTop: spacing[0.5] }}>
					Take a clear, well-lit photo with all four corners in frame.
				</Caption>
			</View>

			{preview ? (
				<View style={{ gap: spacing[2] }}>
					<Image
						source={{ uri: preview }}
						accessibilityLabel="Photo of your Aadhaar card"
						style={{
							width: "100%",
							aspectRatio: 8 / 5,
							borderRadius: borderRadius.lg,
							backgroundColor: colors.background.tertiary,
						}}
						contentFit="cover"
					/>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							justifyContent: "space-between",
						}}
					>
						<Caption weight="medium" color={colors.success.ink}>
							ID captured
						</Caption>
						<Pressable
							onPress={takePhoto}
							disabled={busy}
							hitSlop={8}
							accessibilityRole="button"
							accessibilityLabel="Retake ID photo"
							accessibilityState={{ disabled: !!busy }}
							{...focusable}
							style={{
								flexDirection: "row",
								alignItems: "center",
								gap: spacing[1.5],
								minHeight: 32,
							}}
						>
							<RotateCcw size={14} color={colors.text.secondary as string} />
							<Caption weight="medium" color="secondary">
								{busy ? "Uploading…" : "Retake"}
							</Caption>
						</Pressable>
					</View>
				</View>
			) : (
				<View style={{ flexDirection: "row", gap: spacing[3] }}>
					<CaptureButton
						icon={<Camera size={20} color={colors.primary.ink} />}
						label="Take photo"
						onPress={takePhoto}
						busy={busy}
					/>
					<CaptureButton
						icon={<ImageUp size={20} color={colors.primary.ink} />}
						label="Choose file"
						onPress={chooseFromLibrary}
						busy={busy}
					/>
				</View>
			)}

			{isUploading && !preview && (
				<View
					accessibilityRole="progressbar"
					accessibilityLabel="Uploading your ID"
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[2],
					}}
				>
					<ActivityIndicator
						size="small"
						color={colors.text.quaternary as string}
					/>
					<Caption color="tertiary">Uploading…</Caption>
				</View>
			)}

			{permissionError ? (
				<Caption accessibilityLiveRegion="polite" color={colors.error.ink}>
					{permissionError}
				</Caption>
			) : null}
			{error && <Caption color={colors.error.ink}>{error}</Caption>}
		</View>
	);
}

function CaptureButton({
	icon,
	label,
	onPress,
	busy,
}: {
	icon: ReactNode;
	label: string;
	onPress: () => void;
	busy?: boolean;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	return (
		<Pressable
			onPress={onPress}
			disabled={busy}
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ disabled: !!busy }}
			{...focusable}
			style={({ pressed }) => ({
				flex: 1,
				alignItems: "center",
				gap: spacing[2],
				paddingVertical: spacing[5],
				borderRadius: borderRadius.lg,
				borderWidth: 1,
				borderStyle: "dashed",
				borderColor: pressed ? colors.border.dark : colors.border.medium,
				backgroundColor: pressed
					? colors.background.subtle
					: colors.background.secondary,
				opacity: busy ? 0.6 : 1,
			})}
		>
			{icon}
			<Caption weight="medium" color="secondary">
				{label}
			</Caption>
		</Pressable>
	);
}
