import type {
	UploadContentType,
	UploadIntentInput,
	UploadPurpose,
	UploadTicketResponse,
} from "@nabhya/shared";
import { MAX_UPLOAD_BYTES } from "@nabhya/shared";
import * as DocumentPicker from "expo-document-picker";
import { useState } from "react";
import { uploadsApi } from "@/lib/api";

const ACCEPTED: UploadContentType[] = [
	"application/pdf",
	"image/jpeg",
	"image/png",
	"image/webp",
];

export interface PickedUpload {
	key: string;
	fileName: string;
	size: number;
	contentType: UploadContentType;
}

/**
 * Pick a file and upload it straight to object storage.
 *
 * The bytes never touch our API: we ask the server for a pre-signed ticket,
 * PUT the file to it directly, and hand the resulting object key back so the
 * caller can attach it to a record. The server re-verifies the object landed
 * before it trusts that key.
 */
export function useFileUpload(purpose: UploadPurpose) {
	const [isUploading, setUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const pickAndUpload = async (): Promise<PickedUpload | null> => {
		setError(null);

		const result = await DocumentPicker.getDocumentAsync({
			type: ACCEPTED,
			copyToCacheDirectory: true,
			multiple: false,
		});

		if (result.canceled) return null;

		const asset = result.assets?.[0];
		if (!asset) {
			setError("Could not read that file.");
			return null;
		}

		const contentType = normaliseContentType(asset.mimeType, asset.name);
		if (!contentType) {
			setError("Upload a PDF, JPG, PNG or WebP file.");
			return null;
		}

		const size = asset.size ?? 0;
		if (size > MAX_UPLOAD_BYTES) {
			setError("Files must be under 10 MB.");
			return null;
		}

		setUploading(true);
		try {
			const intent: UploadIntentInput = {
				purpose,
				fileName: asset.name,
				contentType,
				// A zero size means the picker couldn't determine it; send 1 so the
				// schema's min passes and let the server's post-upload HEAD decide.
				size: size || 1,
			};

			const ticket = await uploadsApi.createIntent(intent);
			await putFile(ticket, asset.uri, contentType);

			return { key: ticket.key, fileName: asset.name, size, contentType };
		} catch (e) {
			setError(
				e instanceof Error ? e.message : "Upload failed. Please try again.",
			);
			return null;
		} finally {
			setUploading(false);
		}
	};

	return {
		pickAndUpload,
		isUploading,
		error,
		clearError: () => setError(null),
	};
}

/**
 * Sends the file body to the signed URL.
 *
 * fetch with a blob is used rather than axios: the signed URL must receive the
 * raw bytes with exactly the headers that were signed, and no interceptors —
 * our axios instance would attach an Authorization header and break the
 * signature.
 */
async function putFile(
	ticket: UploadTicketResponse,
	uri: string,
	contentType: UploadContentType,
) {
	const fileResponse = await fetch(uri);
	const blob = await fileResponse.blob();

	const response = await fetch(ticket.url, {
		method: "PUT",
		headers: ticket.headers,
		body: blob,
	});

	if (!response.ok) {
		throw new Error(
			`Storage rejected the upload (${response.status}). Please try again.`,
		);
	}

	return contentType;
}

/** Falls back to the file extension when the picker reports no MIME type. */
function normaliseContentType(
	mimeType: string | undefined,
	fileName: string,
): UploadContentType | null {
	if (mimeType && (ACCEPTED as string[]).includes(mimeType)) {
		return mimeType as UploadContentType;
	}

	const extension = fileName.split(".").pop()?.toLowerCase();
	switch (extension) {
		case "pdf":
			return "application/pdf";
		case "jpg":
		case "jpeg":
			return "image/jpeg";
		case "png":
			return "image/png";
		case "webp":
			return "image/webp";
		default:
			return null;
	}
}
