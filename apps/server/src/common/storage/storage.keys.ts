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

function pad(value: number): string {
	return value.toString().padStart(2, "0");
}

function formatDate(date: Date): string {
	return `${pad(date.getUTCDate())}${pad(date.getUTCMonth() + 1)}${date
		.getUTCFullYear()
		.toString()
		.slice(-2)}`;
}

function formatDateTime(date: Date): string {
	return `${formatDate(date)}${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`;
}

/**
 * Strips anything that could escape the intended prefix or confuse tooling.
 * The random UUID in front means a sanitised collision can't overwrite an
 * existing object.
 */
function safeFileName(fileName: string): string {
	const cleaned = fileName
		.toLowerCase()
		// Anything outside the allowlist - including "/" - becomes a dash, so a
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

function fileExtension(fileName: string): string {
	const extension = fileName.split(".").pop()?.toLowerCase();
	if (!extension || extension === fileName.toLowerCase()) return "";
	return `.${safeFileName(extension)}`;
}

function stripExtension(fileName: string): string {
	const lastDot = fileName.lastIndexOf(".");
	if (lastDot <= 0) return fileName;
	return fileName.slice(0, lastDot);
}

function readableSegment(value: string, fallback: string): string {
	const cleaned = safeFileName(value)
		.replace(/\.+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^[-.]+|[-.]+$/g, "");
	return cleaned || fallback;
}

function buildReadableDocumentName(input: {
	label: string;
	fileName: string;
	createdAt?: Date;
}): string {
	const dateTime = formatDateTime(input.createdAt ?? new Date());
	const base = readableSegment(stripExtension(input.fileName), input.label);
	const ext = fileExtension(input.fileName);
	return `${base}-${dateTime}${ext}`;
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
	ownerLabel?: string;
	documentLabel?: string;
	createdAt?: Date;
}): string {
	const target = PURPOSE_TARGETS[input.purpose];

	if (input.purpose === "ORG_DOCUMENT" || input.purpose === "USER_DOCUMENT") {
		const documentName = buildReadableDocumentName({
			label: input.documentLabel ?? input.fileName,
			fileName: input.fileName,
			createdAt: input.createdAt,
		});
		return `${target.bucket}/${target.prefix}/${input.ownerId}/${documentName}`;
	}

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
	const segments = key.split("/");
	if (segments.length < 4) return null;

	const [bucket, prefix] = segments;
	const purpose = (Object.keys(PURPOSE_TARGETS) as StoragePurpose[]).find(
		(candidate) =>
			PURPOSE_TARGETS[candidate].bucket === bucket &&
			PURPOSE_TARGETS[candidate].prefix === prefix,
	);
	if (!purpose) return null;

	const ownerId =
		purpose === "ORG_DOCUMENT" && segments.length >= 5
			? segments[3]
			: segments[2];
	return ownerId ? { purpose, ownerId } : null;
}
