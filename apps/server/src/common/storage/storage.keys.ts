import { randomUUID } from "node:crypto";
import { env } from "@nabhya/env/server";
import type { StoragePurpose } from "./storage.types";

const PREFIXES: Record<
	Exclude<StoragePurpose, "ORG_DOCUMENT" | "FEED_MEDIA">,
	string
> = {
	USER_DOCUMENT: "user-documents",
	ORG_LOGO: "org-logos",
	ORG_COVER: "org-covers",
	AVATAR: "avatars",
	EVENT_COVER: "event-covers",
	FINANCIAL_REPORT: "financial-reports",
	CERTIFICATE: "certificates",
};

function safeFileName(fileName: string): string {
	const cleaned = fileName
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, "-")
		.replace(/\.{2,}/g, ".")
		.replace(/^[-.]+|[-.]+$/g, "")
		.slice(-80);
	return cleaned || "file";
}

function dateCode(now = new Date()): string {
	return [now.getDate(), now.getMonth() + 1, now.getFullYear() % 100]
		.map((value) => String(value).padStart(2, "0"))
		.join("");
}

function slugify(value: string): string {
	return (
		value
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 80) || "organisation"
	);
}

/** General assets live in the configured private application-media bucket. */
export function buildStorageKey(input: {
	purpose: Exclude<StoragePurpose, "ORG_DOCUMENT" | "FEED_MEDIA">;
	ownerId: string;
	fileName: string;
}): string {
	return `${env.SUPABASE_DEFAULT_STORAGE_BUCKET}/${PREFIXES[input.purpose]}/${input.ownerId}/${randomUUID()}-${safeFileName(input.fileName)}`;
}

/** `ngo_verification/{org-slug}-{ddmmyy}/{document-type}-{ddmmyy}.{ext}`. */
export function buildOrgVerificationKey(input: {
	organizationName: string;
	documentType: string;
	fileName: string;
}): string {
	const extension = safeFileName(input.fileName).split(".").pop();
	const safeExtension =
		extension && /^[a-z0-9]+$/.test(extension) ? `.${extension}` : "";
	const date = dateCode();
	const document = slugify(input.documentType);
	return `ngo_verification/${slugify(input.organizationName)}-${date}/${document}-${date}${safeExtension}`;
}

/** Timestamp folder is collision-safe without changing the requested prefix. */
export function createFeedMediaFolder(now = new Date()): string {
	const dateTime = [
		String(now.getDate()).padStart(2, "0"),
		String(now.getMonth() + 1).padStart(2, "0"),
		String(now.getFullYear() % 100).padStart(2, "0"),
		String(now.getHours()).padStart(2, "0"),
		String(now.getMinutes()).padStart(2, "0"),
		String(now.getSeconds()).padStart(2, "0"),
	].join("");
	return `${dateTime}-${randomUUID().slice(0, 6)}`;
}

export function buildFeedMediaKey(input: {
	folder: string;
	ownerId: string;
	index: number;
	fileName: string;
}): string {
	return `feed_media/${input.folder}/${input.ownerId}-${input.index + 1}-${safeFileName(input.fileName)}`;
}

/** Reads generic ownership from a storage key for download authorisation. */
export function parseStorageKey(
	key: string,
): { purpose: StoragePurpose; ownerId: string | null } | null {
	const [bucket, prefix, ownerId] = key.split("/");
	if (bucket === "ngo_verification")
		return { purpose: "ORG_DOCUMENT", ownerId: null };
	if (bucket === "feed_media") return { purpose: "FEED_MEDIA", ownerId: null };
	if (bucket !== env.SUPABASE_DEFAULT_STORAGE_BUCKET || !prefix || !ownerId)
		return null;
	const purpose = (Object.keys(PREFIXES) as Array<keyof typeof PREFIXES>).find(
		(candidate) => PREFIXES[candidate] === prefix,
	);
	return purpose ? { purpose, ownerId } : null;
}
