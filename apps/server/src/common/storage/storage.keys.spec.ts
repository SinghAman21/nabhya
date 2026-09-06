import { describe, expect, it } from "vitest";
import {
	buildFeedMediaKey,
	buildStorageKey,
	parseStorageKey,
} from "./storage.keys";

describe("storage keys", () => {
	it("puts each purpose under its own bucket and a readable org folder", () => {
		const key = buildStorageKey({
			purpose: "ORG_DOCUMENT",
			ownerId: "org-123",
			ownerLabel: "Sakhi Trust",
			fileName: "pan.pdf",
			createdAt: new Date("2026-09-06T10:11:12Z"),
		});

		expect(
			key.startsWith(
				"ngo_verification/org-documents/sakhi-trust-060926/org-123/",
			),
		).toBe(true);
		expect(key.endsWith("-060926101112.pdf")).toBe(true);
	});

	it("round-trips the owner, which is what authorises downloads", () => {
		const key = buildStorageKey({
			purpose: "USER_DOCUMENT",
			ownerId: "user-9",
			fileName: "aadhaar.jpg",
		});

		expect(parseStorageKey(key)).toEqual({
			purpose: "USER_DOCUMENT",
			ownerId: "user-9",
		});
	});

	it("neutralises path traversal in the supplied file name", () => {
		const key = buildStorageKey({
			purpose: "ORG_DOCUMENT",
			ownerId: "org-1",
			ownerLabel: "Test Org",
			fileName: "../../../etc/passwd",
			createdAt: new Date("2026-09-06T10:11:12Z"),
		});

		// What actually matters: the name cannot introduce a new path segment,
		// so it can never escape the owner's prefix.
		expect(
			key.startsWith("ngo_verification/org-documents/test-org-060926/org-1/"),
		).toBe(true);
		expect(key.split("/")).toHaveLength(5);
		expect(key).not.toContain("..");
	});

	it("never collides for identical file names", () => {
		const input = {
			purpose: "AVATAR",
			ownerId: "user-1",
			fileName: "photo.png",
		} as const;

		expect(buildStorageKey(input)).not.toBe(buildStorageKey(input));
	});

	it("builds feed media keys in the feed_media bucket", () => {
		const key = buildFeedMediaKey({
			ownerId: "user-1",
			mediaFolder: "123456789012-abcdef",
			fileName: "hero.png",
		});

		expect(
			key.startsWith("feed_media/feed-media/user-1/123456789012-abcdef/"),
		).toBe(true);
		expect(key.endsWith("-hero.png")).toBe(true);
	});

	it("falls back to a safe name when the input sanitises to nothing", () => {
		const key = buildStorageKey({
			purpose: "AVATAR",
			ownerId: "user-1",
			fileName: "!!!",
		});
		expect(key.endsWith("-file")).toBe(true);
	});

	it("rejects malformed keys rather than guessing", () => {
		expect(parseStorageKey("nonsense")).toBeNull();
		expect(parseStorageKey("unknown-prefix/owner/file.pdf")).toBeNull();
		expect(parseStorageKey("")).toBeNull();
	});
});
