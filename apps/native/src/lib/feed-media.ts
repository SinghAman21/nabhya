import { MAX_FEED_MEDIA, MAX_FEED_MEDIA_BYTES } from "@nabhya/shared";
import type * as ImagePicker from "expo-image-picker";
import { feedApi } from "@/lib/api";

/**
 * Turning what the image picker hands back into what the feed API will accept.
 *
 * Two facts about the server make this more than a `map`:
 *
 * 1. **The stored media type is read off the object key's extension**, not off
 *    the content type or the picker's own `type` field (`FeedService.create`
 *    keys `VIDEO` on `.mp4` / `.mov`). A file named `media-1757…` with no
 *    extension is therefore stored as an `IMAGE` whatever it actually is, and
 *    renders as a broken image in every feed. So the extension is *derived from
 *    the content type* here and appended — never taken on trust from the
 *    picker, which returns `fileName: null` for a video on Android.
 * 2. **Only five content types are accepted** (`feedMediaContentTypeSchema`).
 *    Anything else has to be refused by name up front. Relabelling a HEIC as
 *    `image/jpeg` — which is what the old composer did — produces a signed URL
 *    for one type and a PUT of another, so the upload 403s with nothing on
 *    screen to explain why.
 *
 * Size is also checked here. `assertFeedMediaKeys` deletes and rejects an
 * over-25MB object *after* the bytes are already on the wire, which on a phone
 * connection is a minute of upload spent to earn a 400.
 */

/**
 * Spelled out rather than inferred from `feedMediaContentTypeSchema`: the
 * records below are keyed on it, and `z.infer` of a schema this file also has
 * to key a `Record` on makes the two definitions circular. Kept in step with
 * `packages/shared/src/feed.ts` — if a format is added there, add it here and
 * to `EXTENSION`, and the compiler will point at the rest.
 */
export type FeedMediaContentType =
	| "image/jpeg"
	| "image/png"
	| "image/webp"
	| "video/mp4"
	| "video/quicktime";

const EXTENSION: Record<FeedMediaContentType, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
	"video/mp4": "mp4",
	"video/quicktime": "mov",
};

const BY_EXTENSION: Record<string, FeedMediaContentType> = {
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	webp: "image/webp",
	mp4: "video/mp4",
	m4v: "video/mp4",
	mov: "video/quicktime",
	qt: "video/quicktime",
};

/** One attachment in the composer, with its own upload state. */
export interface ComposerMedia {
	/** Stable local id; the picker's `assetId` is null on web. */
	id: string;
	uri: string;
	kind: "IMAGE" | "VIDEO";
	contentType: FeedMediaContentType;
	/** Always carries the extension matching `contentType`. See above. */
	fileName: string;
	/** Bytes. 0 when the picker does not report a size (some web browsers). */
	size: number;
	/** Milliseconds, videos only. */
	durationMs: number | null;
	status: "ready" | "uploading" | "uploaded" | "failed";
	/** 0–1 while uploading. */
	progress: number;
	/** The object key, once the bytes are in storage. */
	objectKey?: string;
	error?: string;
}

export interface RejectedMedia {
	fileName: string;
	reason: string;
}

/** Human file size, for a message that names the file that was too big. */
export function formatBytes(bytes: number) {
	if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${bytes} B`;
}

export function formatDuration(ms: number) {
	const total = Math.round(ms / 1000);
	const minutes = Math.floor(total / 60);
	const seconds = total % 60;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function extensionOf(value: string | null | undefined) {
	if (!value) return null;
	// Strip a query string first: a web object URL or a content:// uri can carry one.
	const clean = value.split(/[?#]/)[0] ?? "";
	const match = /\.([a-z0-9]{2,5})$/i.exec(clean);
	return match?.[1]?.toLowerCase() ?? null;
}

function baseNameOf(value: string | null | undefined) {
	if (!value) return null;
	const last = value.split(/[?#]/)[0]?.split(/[\\/]/).pop();
	if (!last) return null;
	const withoutExtension = last.replace(/\.[a-z0-9]{2,5}$/i, "");
	// The server sanitises this again; keeping it short and boring keeps the
	// object key readable in the bucket.
	const safe = withoutExtension
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 40);
	return safe || null;
}

/**
 * Resolve the content type, most trustworthy source first: the real extension,
 * then the reported MIME type, then the picker's own image/video flag.
 *
 * Returns null for anything the API will not accept, so the caller can say
 * which file it was rather than failing at the PUT.
 */
function resolveContentType(
	asset: ImagePicker.ImagePickerAsset,
): FeedMediaContentType | null {
	const extension =
		extensionOf(asset.fileName) ?? extensionOf(asset.uri) ?? null;
	if (extension && BY_EXTENSION[extension]) return BY_EXTENSION[extension];

	const mime = asset.mimeType?.toLowerCase().split(";")[0]?.trim();
	if (mime && mime in EXTENSION) return mime as FeedMediaContentType;

	// No usable extension and an unrecognised MIME type. Guessing an image
	// format would be a coin flip, but a video has only two candidates and the
	// platform decides which: iOS hands back QuickTime, Android MP4.
	if (asset.type === "video") {
		return mime?.includes("quicktime") ? "video/quicktime" : "video/mp4";
	}
	return null;
}

/**
 * Vet what the picker returned and normalise it. Anything unusable comes back
 * in `rejected` with a reason worth showing, rather than being dropped
 * silently or relabelled into something the upload will refuse.
 */
export function toComposerMedia(
	assets: ImagePicker.ImagePickerAsset[],
	alreadyAttached: number,
): { accepted: ComposerMedia[]; rejected: RejectedMedia[] } {
	const accepted: ComposerMedia[] = [];
	const rejected: RejectedMedia[] = [];
	let room = MAX_FEED_MEDIA - alreadyAttached;

	for (const asset of assets) {
		const label = asset.fileName ?? "That file";

		if (room <= 0) {
			rejected.push({
				fileName: label,
				reason: `Only ${MAX_FEED_MEDIA} files fit on one post.`,
			});
			continue;
		}

		const contentType = resolveContentType(asset);
		if (!contentType) {
			rejected.push({
				fileName: label,
				reason: "Not a supported format. Use JPG, PNG, WebP, MP4 or MOV.",
			});
			continue;
		}

		const size = asset.fileSize ?? 0;
		if (size > MAX_FEED_MEDIA_BYTES) {
			rejected.push({
				fileName: label,
				reason: `${formatBytes(size)} — the limit is ${formatBytes(MAX_FEED_MEDIA_BYTES)}.`,
			});
			continue;
		}

		const extension = EXTENSION[contentType];
		const base = baseNameOf(asset.fileName) ?? "upload";

		accepted.push({
			id: asset.assetId ?? `${asset.uri}-${accepted.length}-${Date.now()}`,
			uri: asset.uri,
			kind: contentType.startsWith("video/") ? "VIDEO" : "IMAGE",
			contentType,
			fileName: `${base}.${extension}`,
			// `min 1` on the server's size field: a picker that reports nothing
			// still has to send a positive number.
			size: size || 1,
			durationMs: asset.duration ?? null,
			status: "ready",
			progress: 0,
		});
		room -= 1;
	}

	return { accepted, rejected };
}

/**
 * PUT the bytes with real progress.
 *
 * `fetch` cannot report upload progress on either platform, and a media post is
 * the one place in this app where a coordinator on a 3G connection is staring
 * at a spinner for thirty seconds. `XMLHttpRequest` reports it on React Native
 * and on the web alike, so the tile can fill instead of just spinning.
 *
 * Deliberately raw — **no Authorization header**. The URL is pre-signed and an
 * extra header would break the signature, which is why the app's axios
 * instance must never be used here.
 */
function putWithProgress(
	url: string,
	headers: Record<string, string>,
	body: Blob,
	onProgress: (fraction: number) => void,
) {
	return new Promise<void>((resolve, reject) => {
		const request = new XMLHttpRequest();
		request.open("PUT", url);
		for (const [name, value] of Object.entries(headers)) {
			request.setRequestHeader(name, value);
		}
		request.upload.onprogress = (event) => {
			if (event.lengthComputable && event.total > 0) {
				onProgress(Math.min(1, event.loaded / event.total));
			}
		};
		request.onload = () => {
			if (request.status >= 200 && request.status < 300) {
				onProgress(1);
				resolve();
				return;
			}
			reject(new Error(`Upload rejected by storage (${request.status})`));
		};
		request.onerror = () =>
			reject(new Error("Upload failed. Check your connection."));
		request.onabort = () => reject(new Error("Upload cancelled."));
		request.send(body);
	});
}

/**
 * Upload every attachment and return what `POST /api/feed` needs.
 *
 * One intent request covers the whole set, because the folder is minted per
 * request and `assertFeedMediaKeys` requires every key to sit under the same
 * one — asking per file would produce four folders and a rejected post.
 * Tickets come back in the order the files went out, which is also the order
 * `sortOrder` is assigned in, so the carousel shows them the way they were
 * picked.
 */
export async function uploadFeedMedia(
	media: ComposerMedia[],
	onChange: (id: string, patch: Partial<ComposerMedia>) => void,
): Promise<{ mediaFolder: string; mediaKeys: string[] }> {
	const { mediaFolder, tickets } = await feedApi.createMediaIntents({
		files: media.map((file) => ({
			fileName: file.fileName,
			contentType: file.contentType,
			size: file.size,
		})),
	});

	// Sequential, not `Promise.all`. Four videos at once on a phone connection
	// starves each other and the progress bars all crawl together; one at a
	// time finishes the first tile early and gives the reader something true to
	// watch. It also means a failure names the file that failed.
	const mediaKeys: string[] = [];
	for (const [index, file] of media.entries()) {
		const ticket = tickets[index];
		if (!ticket) throw new Error("Storage did not issue a ticket for a file.");

		onChange(file.id, { status: "uploading", progress: 0 });
		try {
			const body = await (await fetch(file.uri)).blob();
			await putWithProgress(
				ticket.url,
				ticket.headers ?? {},
				body,
				(fraction) => onChange(file.id, { progress: fraction }),
			);
			onChange(file.id, {
				status: "uploaded",
				progress: 1,
				objectKey: ticket.key,
			});
			mediaKeys.push(ticket.key);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Upload failed.";
			onChange(file.id, { status: "failed", progress: 0, error: message });
			throw new Error(`${file.fileName}: ${message}`);
		}
	}

	return { mediaFolder, mediaKeys };
}
