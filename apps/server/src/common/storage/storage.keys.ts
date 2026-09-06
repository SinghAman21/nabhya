import { randomUUID } from "node:crypto";
import type { StoragePurpose } from "./storage.types";

export const NGO_VERIFICATION_BUCKET = "ngo_verification";
export const FEED_MEDIA_BUCKET = "feed_media";
export const FEED_MEDIA_PREFIX = "feed-media";

interface PurposeTarget {
	bucket: string;
	prefix: string;
}

const PURPOSE_TARGETS: Record<StoragePurpose, PurposeTarget> = {
	ORG_DOCUMENT: {
		bucket: NGO_VERIFICATION_BUCKET,
		prefix: "org-documents",
	},
	USER_DOCUMENT: {
		bucket: NGO_VERIFICATION_BUCKET,
		prefix: "user-documents",
	},
	ORG_LOGO: { bucket: FEED_MEDIA_BUCKET, prefix: "org-logos" },
	ORG_COVER: { bucket: FEED_MEDIA_BUCKET, prefix: "org-covers" },
	AVATAR: { bucket: FEED_MEDIA_BUCKET, prefix: "avatars" },
	EVENT_COVER: { bucket: FEED_MEDIA_BUCKET, prefix: "event-covers" },
	FINANCIAL_REPORT: {
		bucket: FEED_MEDIA_BUCKET,
		prefix: "financial-reports",
	},
	CERTIFICATE: { bucket: FEED_MEDIA_BUCKET, prefix: "certificates" },
};

/**
 * Strips anything that could escape the intended prefix or confuse tooling.
 * The random UUID in front means a sanitised collision can't overwrite an
 * existing object.
 */
function safeFileName(fileName: string): string {
	const cleaned = fileName
		.toLowerCase()
		// Anything outside the allowlist — including "/" — becomes a dash, so a
		// supplied name can never introduce a new path segment.
		.replace(/[^a-z0-9._-]+/g, "-")
		// Collapse dot runs: "../.." can no longer traverse once slashes are
		// gone, but leaving ".." in a key is needlessly confusing for anything
		// that later mirrors the bucket onto a filesystem.
		.replace(/\.{2,}/g, ".")
		.replace(/^[-.]+|[-.]+$/g, "")
		.slice(-80);
	return cleaned || "file";
}

/**
 * Builds a bucketed object key. `ownerId` scopes the object to the organization
 * or user it belongs to, which is what makes ownership checkable on download:
 * a key always encodes who it belongs to, so we never have to trust the client.
 */
export function buildStorageKey(input: {
	purpose: StoragePurpose;
	ownerId: string;
	fileName: string;
}): string {
	const target = PURPOSE_TARGETS[input.purpose];
	return `${target.bucket}/${target.prefix}/${input.ownerId}/${randomUUID()}-${safeFileName(input.fileName)}`;
}

/** Builds a key for feed media uploads in the shared `feed_media` bucket. */
export function buildFeedMediaKey(input: {
	ownerId: string;
	mediaFolder: string;
	fileName: string;
}): string {
	return `${FEED_MEDIA_BUCKET}/${FEED_MEDIA_PREFIX}/${input.ownerId}/${input.mediaFolder}/${randomUUID()}-${safeFileName(input.fileName)}`;
}

/** Reads back the owner segment so downloads can be authorised. */
export function parseStorageKey(
	key: string,
): { purpose: StoragePurpose; ownerId: string } | null {
	const [bucket, prefix, ownerId] = key.split("/");
	if (!bucket || !prefix || !ownerId) return null;

	const purpose = (Object.entries(PURPOSE_TARGETS) as Array<
		[StoragePurpose, PurposeTarget]
	>).find(([, target]) => target.bucket === bucket && target.prefix === prefix)?.[0];
	if (!purpose) return null;

	return { purpose, ownerId };
}
