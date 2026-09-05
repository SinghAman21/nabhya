import { randomUUID } from "node:crypto";
import type { StoragePurpose } from "./storage.types";

const PREFIXES: Record<StoragePurpose, string> = {
	ORG_DOCUMENT: "org-documents",
	USER_DOCUMENT: "user-documents",
	ORG_LOGO: "org-logos",
	ORG_COVER: "org-covers",
	AVATAR: "avatars",
	EVENT_COVER: "event-covers",
	FINANCIAL_REPORT: "financial-reports",
	CERTIFICATE: "certificates",
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
 * Builds the object key. `ownerId` scopes the object to the organization or
 * user it belongs to, which is what makes ownership checkable on download:
 * a key always encodes who it belongs to, so we never have to trust the client.
 */
export function buildStorageKey(input: {
	purpose: StoragePurpose;
	ownerId: string;
	fileName: string;
}): string {
	const prefix = PREFIXES[input.purpose];
	return `${prefix}/${input.ownerId}/${randomUUID()}-${safeFileName(input.fileName)}`;
}

/** Reads back the owner segment so downloads can be authorised. */
export function parseStorageKey(
	key: string,
): { purpose: StoragePurpose; ownerId: string } | null {
	const [prefix, ownerId] = key.split("/");
	if (!prefix || !ownerId) return null;

	const purpose = (Object.keys(PREFIXES) as StoragePurpose[]).find(
		(candidate) => PREFIXES[candidate] === prefix,
	);
	if (!purpose) return null;

	return { purpose, ownerId };
}
