import type { PostTag } from "@nabhya/shared";
import { Platform } from "react-native";
import { storage } from "@/lib/storage";

/**
 * Post drafts.
 *
 * **Local to the device, by design and by necessity.** There is no draft
 * column on `posts` and no draft endpoint — the server takes a finished post
 * or nothing — so a draft cannot follow a coordinator to another phone, and
 * the composer says so rather than implying it can. Adding real drafts is a
 * schema change (`posts.status` or a `post_drafts` table) and belongs with
 * scheduling, which needs the same thing.
 *
 * **Media is not part of a draft.** A picked file is a `file://` or `content://`
 * URI that the OS may revoke the moment the picker session ends, so a restored
 * draft that claimed to hold four photos would be four broken tiles. Restoring
 * brings back the words and the type and asks for the pictures again, which is
 * the honest behaviour and also the cheap one.
 *
 * **The size budget is the interesting constraint.** On the web this is
 * `localStorage` and effectively unbounded. On native `lib/storage` is
 * `expo-secure-store`, whose documented per-value ceiling is 2048 bytes — and
 * a single post can be 5000 characters on its own. So writes are budgeted:
 * drafts are evicted oldest-first until the payload fits, and `saveDrafts`
 * reports what survived so the caller can tell the truth about it instead of
 * losing work silently. One draft too large to persist at all is kept for the
 * session and not written.
 */

export interface PostDraft {
	id: string;
	tag: PostTag | "URGENT";
	isUrgent?: boolean;
	title: string;
	body: string;
	/** ISO. Sorted on this, newest first. */
	savedAt: string;
}

const KEY = "nabhya-post-drafts";

/** Keep the list short enough to scan without scrolling. */
export const MAX_DRAFTS = 5;

/**
 * Bytes available for the whole serialised list. `expo-secure-store` documents
 * 2048; the margin covers the JSON scaffolding and multi-byte characters,
 * which matter here — Devanagari is three bytes a character, so a Hindi draft
 * costs three times what the character count suggests.
 */
const BUDGET = Platform.OS === "web" ? 2_000_000 : 1_800;

function byteLength(value: string) {
	if (typeof TextEncoder !== "undefined") {
		return new TextEncoder().encode(value).length;
	}
	// No encoder on this runtime: assume the worst case for UTF-8 rather than
	// reaching for a legacy global that may not exist under Hermes. Over-
	// estimating only ever evicts one draft too eagerly; under-estimating
	// would mean a write that silently fails.
	return value.length * 3;
}

function isDraft(value: unknown): value is PostDraft {
	if (!value || typeof value !== "object") return false;
	const row = value as Record<string, unknown>;
	return (
		typeof row.id === "string" &&
		typeof row.tag === "string" &&
		(row.isUrgent === undefined || typeof row.isUrgent === "boolean") &&
		typeof row.title === "string" &&
		typeof row.body === "string" &&
		typeof row.savedAt === "string"
	);
}

export function newDraftId() {
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Newest first. Anything unparseable is treated as no drafts, never thrown. */
export async function loadDrafts(): Promise<PostDraft[]> {
	try {
		const raw = await storage.get(KEY);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter(isDraft)
			.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
			.slice(0, MAX_DRAFTS);
	} catch {
		return [];
	}
}

export interface SaveResult {
	/** What is now on disk, newest first. */
	drafts: PostDraft[];
	/** How many older drafts had to be dropped to fit the budget. */
	evicted: number;
	/** True when even the newest draft alone exceeded the budget. */
	tooLarge: boolean;
}

/**
 * Write the list, oldest-first eviction until it fits.
 *
 * Returns what actually persisted rather than assuming success, because on
 * native "it did not fit" is a real outcome and the composer has to be able to
 * say so.
 */
export async function saveDrafts(drafts: PostDraft[]): Promise<SaveResult> {
	const ordered = [...drafts]
		.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
		.slice(0, MAX_DRAFTS);

	let kept = ordered;
	let evicted = 0;
	while (kept.length > 0 && byteLength(JSON.stringify(kept)) > BUDGET) {
		kept = kept.slice(0, -1);
		evicted += 1;
	}

	if (kept.length === 0) {
		// Nothing fits. Leave whatever is already stored alone rather than
		// clearing it to make room for something that cannot be stored either.
		return {
			drafts: await loadDrafts(),
			evicted,
			tooLarge: ordered.length > 0,
		};
	}

	try {
		await storage.set(KEY, JSON.stringify(kept));
	} catch {
		return { drafts: await loadDrafts(), evicted, tooLarge: true };
	}
	return { drafts: kept, evicted, tooLarge: false };
}

/** One line of preview for the drafts list: the title, or the first line. */
export function draftPreview(draft: PostDraft) {
	const source = draft.title.trim() || draft.body.trim();
	const firstLine = source.split("\n")[0]?.trim() ?? "";
	return firstLine.length > 72 ? `${firstLine.slice(0, 72)}…` : firstLine;
}
