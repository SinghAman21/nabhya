import type { UploadPurpose } from "@nabhya/shared";
import * as ImagePicker from "expo-image-picker";
import { View } from "react-native";
import { FieldError } from "@/components/form-field";
import { ImagePickerSlot } from "@/components/org-branding";
import { Caption } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { useImageUpload } from "@/hooks/use-upload";

/**
 * A square image slot that uploads what it is given and hands back the key.
 *
 * The wizards' one image each — the NGO's logo and the volunteer's photo —
 * previously did not exist at all, which is why every feed card, every
 * applicant row and every NGO header in the app draws initials: the only
 * screens that could set an image were the two edit forms, reached from a
 * profile nobody visits on day one. Asking once, here, is the difference
 * between a platform that looks populated and one that looks empty.
 *
 * Built on `ImagePickerSlot` (the edit screens' slot) plus `useImageUpload`, so
 * the file is normalised to JPEG, downscaled and PUT straight to storage; what
 * reaches the form is an object key. The local URI is kept beside it so the
 * preview appears immediately rather than after a signed-URL round trip.
 *
 * ## `deferred`, and why the NGO logo needs it
 *
 * `ORG_LOGO` is an **org-scoped** upload purpose: `UploadsService.resolveOwnerId`
 * derives the object key from the caller's organization and throws
 * "Complete organization onboarding before uploading these files" when there is
 * no organization yet — which, in the middle of the wizard that creates one, is
 * always. (`AVATAR` is user-scoped, so the volunteer's photo uploads on the
 * spot.) Making the purpose user-scoped instead would break reads: download
 * authorisation resolves the owner from the key, so an org logo filed under a
 * user id becomes unreadable to the org that owns it.
 *
 * So `deferred` picks and previews the file without uploading, and the caller
 * uploads it after the record exists — `(onboarding)/index.tsx` does that in the
 * submit's `onSuccess`, then PATCHes the key onto the new organization. The
 * upload is therefore the one part of the wizard that can fail *after* success,
 * and the completion screen says so when it does.
 */
export function PhotoField({
	purpose,
	label,
	hint,
	fileName,
	imageKey,
	previewUri,
	onChange,
	onBusyChange,
	width = 112,
	aspectRatio,
	disabled,
	deferred,
	deferredNote,
}: {
	purpose: UploadPurpose;
	label: string;
	hint: string;
	/** Stored file name; also the extension a reviewer sees. */
	fileName: string;
	imageKey: string;
	previewUri: string;
	/** Both empty strings when cleared. */
	onChange: (next: { key: string; previewUri: string }) => void;
	/**
	 * Raised while an upload is in flight, so the form can hold its submit.
	 *
	 * Without it, submitting mid-upload posts an empty key and the photo is
	 * lost silently — the upload finishes and writes to a draft that has
	 * already been sent.
	 */
	onBusyChange?: (busy: boolean) => void;
	/** Ignored when `aspectRatio` is set — a banner is full width. */
	width?: number;
	/** For a wide slot (an NGO banner). Square when omitted. */
	aspectRatio?: number;
	disabled?: boolean;
	/** Pick and preview only; the caller uploads once its record exists. */
	deferred?: boolean;
	/** Shown under a deferred slot that holds a file, so the wait is stated. */
	deferredNote?: string;
}) {
	const { spacing } = useTheme();
	const upload = useImageUpload(purpose);

	const pick = async () => {
		upload.clearError();
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ["images"],
			allowsMultipleSelection: false,
			// The native crop box at the slot's own ratio, so a portrait photo is
			// not silently centre-cropped into a square logo or a wide banner.
			// Ignored on web, where `contentFit: "cover"` does the work instead.
			allowsEditing: true,
			aspect: aspectRatio ? [aspectRatio, 1] : [1, 1],
			quality: 0.9,
		});
		if (result.canceled) return;

		const asset = result.assets?.[0];
		if (!asset) return;

		if (deferred) {
			onChange({ key: "", previewUri: asset.uri });
			return;
		}

		// Preview the local file straight away: the upload takes seconds on a
		// phone connection and a slot that stays empty reads as a failure.
		onChange({ key: imageKey, previewUri: asset.uri });

		onBusyChange?.(true);
		try {
			const uploaded = await upload.uploadImage(asset.uri, {
				fileName,
				sourceWidth: asset.width,
				maxWidth: aspectRatio ? 1600 : 600,
			});

			// A failed upload must not leave a preview implying a saved photo.
			onChange(
				uploaded
					? { key: uploaded.key, previewUri: asset.uri }
					: { key: "", previewUri: "" },
			);
		} finally {
			onBusyChange?.(false);
		}
	};

	return (
		<View>
			<ImagePickerSlot
				label={label}
				hint={hint}
				imageKey={imageKey || null}
				localUri={previewUri || null}
				{...(aspectRatio ? { aspectRatio } : { width })}
				rounded
				busy={upload.isUploading || disabled}
				onPress={pick}
				{...(imageKey || previewUri
					? { onClear: () => onChange({ key: "", previewUri: "" }) }
					: {})}
			/>
			<View style={{ marginTop: -spacing[3], marginBottom: spacing[3] }}>
				<FieldError message={upload.error} />
				{deferred && deferredNote && previewUri ? (
					<Caption color="quaternary">{deferredNote}</Caption>
				) : null}
			</View>
		</View>
	);
}
