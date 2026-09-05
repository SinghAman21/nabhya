import {
	GOVERNMENT_ID_DOCUMENT_TYPES,
	USER_DOCUMENT_LABELS,
	type UserDocumentType,
} from "@nabhya/shared";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Camera, ImageUp, RotateCcw } from "lucide-react-native";
import type { ReactNode } from "react";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { useImageUpload } from "@/hooks/use-upload";
import { Alert } from "@/lib/alert";

export interface IdCaptureValue {
	documentType: UserDocumentType;
	key: string;
}

/**
 * Government-ID step: pick which ID, then photograph it or choose one from the
 * library. The image is normalised and uploaded straight to storage; the parent
 * receives only the document type and the resulting object key.
 */
export function IdCapture({
	onChange,
	disabled,
}: {
	onChange: (value: IdCaptureValue | null) => void;
	disabled?: boolean;
}) {
	const { colors, spacing, borderRadius, withOpacity } = useTheme();
	const { uploadImage, isUploading, error } = useImageUpload("USER_DOCUMENT");
	const [documentType, setDocumentType] =
		useState<UserDocumentType>("AADHAR_CARD");
	const [preview, setPreview] = useState<string | null>(null);

	const busy = isUploading || disabled;

	const chooseType = (type: UserDocumentType) => {
		if (type === documentType || busy) return;
		setDocumentType(type);
		// A previously captured image belonged to the old type, so drop it.
		if (preview) {
			setPreview(null);
			onChange(null);
		}
	};

	const handleAsset = async (asset?: { uri: string; width?: number }) => {
		if (!asset) return;
		const uploaded = await uploadImage(asset.uri, {
			fileName: `${documentType.toLowerCase()}.jpg`,
			sourceWidth: asset.width,
		});
		if (uploaded) {
			setPreview(asset.uri);
			onChange({ documentType, key: uploaded.key });
		}
	};

	const takePhoto = async () => {
		const permission = await ImagePicker.requestCameraPermissionsAsync();
		if (!permission.granted) {
			Alert.alert(
				"Camera access needed",
				"Allow camera access to photograph your ID, or choose one from your library instead.",
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
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ["images"],
			quality: 0.7,
		});
		if (!result.canceled) await handleAsset(result.assets[0]);
	};

	return (
		<View style={{ gap: spacing[3] }}>
			<Body weight="bold">1 · Government ID</Body>
			<Caption color="tertiary">
				Choose which ID you're uploading, then capture a clear, well-lit photo
				with all corners visible.
			</Caption>

			<View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
				{GOVERNMENT_ID_DOCUMENT_TYPES.map((type) => {
					const selected = type === documentType;
					return (
						<Pressable
							key={type}
							onPress={() => chooseType(type)}
							hitSlop={4}
							style={{
								paddingHorizontal: spacing[3],
								paddingVertical: spacing[2],
								borderRadius: borderRadius.sm,
								borderWidth: 1,
								borderColor: selected
									? colors.primary.main
									: colors.border.medium,
								backgroundColor: selected
									? withOpacity(colors.primary.main as string, 0.1)
									: colors.background.primary,
							}}
						>
							<Caption
								weight="medium"
								color={
									selected
										? (colors.primary.main as string)
										: (colors.text.secondary as string)
								}
							>
								{USER_DOCUMENT_LABELS[type] ?? type}
							</Caption>
						</Pressable>
					);
				})}
			</View>

			{preview ? (
				<View style={{ gap: spacing[2] }}>
					<Image
						source={{ uri: preview }}
						style={{
							width: "100%",
							height: 200,
							borderRadius: borderRadius.lg,
							backgroundColor: colors.background.tertiary,
						}}
						contentFit="cover"
					/>
					<Pressable
						onPress={takePhoto}
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
							{busy ? "Uploading…" : "Retake"}
						</Caption>
					</Pressable>
				</View>
			) : (
				<View style={{ flexDirection: "row", gap: spacing[3] }}>
					<CaptureButton
						icon={<Camera size={18} color={colors.primary.main as string} />}
						label="Take photo"
						onPress={takePhoto}
						busy={busy}
					/>
					<CaptureButton
						icon={<ImageUp size={18} color={colors.primary.main as string} />}
						label="Choose file"
						onPress={chooseFromLibrary}
						busy={busy}
					/>
				</View>
			)}

			{isUploading && !preview && (
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[2],
					}}
				>
					<ActivityIndicator
						size="small"
						color={colors.text.secondary as string}
					/>
					<Caption color="tertiary">Uploading…</Caption>
				</View>
			)}

			{error && <Caption color={colors.error.main as string}>{error}</Caption>}
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
			style={({ pressed }) => ({
				flex: 1,
				alignItems: "center",
				gap: spacing[2],
				paddingVertical: spacing[5],
				borderRadius: borderRadius.lg,
				borderWidth: 2,
				borderStyle: "dashed",
				borderColor: pressed ? colors.primary.main : colors.border.medium,
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
