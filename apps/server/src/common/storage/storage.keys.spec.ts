import { describe, expect, it } from "vitest";
import {
	buildOrgVerificationKey,
	buildStorageKey,
	createFeedMediaFolder,
	parseStorageKey,
} from "./storage.keys";

describe("storage keys", () => {
	it("scopes regular assets to the configured bucket and owner", () => {
		const key = buildStorageKey({
			purpose: "USER_DOCUMENT",
			ownerId: "user-9",
			fileName: "aadhaar.jpg",
		});
		expect(key.startsWith("user_avatars/user-documents/user-9/")).toBe(true);
		expect(parseStorageKey(key)).toEqual({
			purpose: "USER_DOCUMENT",
			ownerId: "user-9",
		});
	});

	it("uses the requested private NGO verification folder and document name", () => {
		const key = buildOrgVerificationKey({
			organizationName: "Helping Hands India!",
			documentType: "PAN_CARD",
			fileName: "PAN Scan.PDF",
		});
		expect(key).toMatch(
			/^ngo_verification\/helping-hands-india-\d{6}\/pan-card-\d{6}\.pdf$/,
		);
	});

	it("keeps the requested timestamp prefix while preventing folder collisions", () => {
		const first = createFeedMediaFolder(new Date("2026-09-04T12:34:56"));
		const second = createFeedMediaFolder(new Date("2026-09-04T12:34:56"));
		expect(first).toMatch(/^040926123456-[a-z0-9]{6}$/);
		expect(first).not.toBe(second);
	});

	it("neutralises path traversal in supplied file names", () => {
		const key = buildStorageKey({
			purpose: "AVATAR",
			ownerId: "user-1",
			fileName: "../../../etc/passwd",
		});
		expect(key.split("/")).toHaveLength(4);
		expect(key).not.toContain("..");
	});
});
