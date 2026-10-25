/**
 * Shared plumbing for `seed-flex.ts` and `seed-flex-cleanup.ts`: env loading,
 * the tagging scheme, a deterministic RNG and a minimal Supabase Storage client.
 *
 * Tagging scheme - how every seeded thing can be found again:
 * - every row the seeder inserts has a primary key starting `5eedf1e0-`
 *   (derived from a stable label, so a re-run produces the same ids and
 *   `on conflict do nothing` makes it idempotent);
 * - seeded people have `@seed.nabhya.in` emails (they have no Supabase Auth
 *   account and never log in);
 * - seeded payments use `seed_` provider ids;
 * - every storage object the seeder writes has a `seed` path segment
 *   (`<bucket>/<prefix>/<ownerId>/seed/...`, or `<bucket>/seed/...` for the
 *   shared source pool), so keys still parse to their owner.
 */
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Loads apps/server/.env without echoing anything. Call before importing ./index. */
export function loadServerEnv() {
	dotenv.config({
		path: path.resolve(here, "../../../apps/server/.env"),
		quiet: true,
	});
}

export const SEED_ID_PREFIX = "5eedf1e0";
export const SEED_EMAIL_DOMAIN = "seed.nabhya.in";
export const SEED_PAYMENT_PREFIX = "seed_";

/** Stable UUID for a label, always starting with the seed prefix. */
export function sid(label: string): string {
	const h = createHash("sha256")
		.update(`nabhya-seed-flex:${label}`)
		.digest("hex");
	return `${SEED_ID_PREFIX}-${h.slice(0, 4)}-4${h.slice(4, 7)}-8${h.slice(7, 10)}-${h.slice(10, 22)}`;
}

/** Short stable hex digest of a label. */
export function hashHex(label: string, length = 12): string {
	return createHash("sha256")
		.update(`nabhya-seed-flex:${label}`)
		.digest("hex")
		.slice(0, length);
}

/** Deterministic PRNG (mulberry32) seeded from a label. */
export function rngFor(label: string) {
	let a = Number.parseInt(hashHex(label, 8), 16) >>> 0;
	const next = () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	return {
		next,
		int: (min: number, max: number) =>
			min + Math.floor(next() * (max - min + 1)),
		float: (min: number, max: number) => min + next() * (max - min),
		chance: (p: number) => next() < p,
		pick: <T>(items: readonly T[]): T => {
			const item = items[Math.floor(next() * items.length)];
			if (item === undefined) throw new Error("pick from empty list");
			return item;
		},
		/** Up to `count` distinct items, order randomised. */
		sample: <T>(items: readonly T[], count: number): T[] => {
			const copy = [...items];
			for (let i = copy.length - 1; i > 0; i--) {
				const j = Math.floor(next() * (i + 1));
				[copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
			}
			return copy.slice(0, Math.max(0, count));
		},
		weighted: <T>(entries: ReadonlyArray<readonly [T, number]>): T => {
			const total = entries.reduce((sum, [, w]) => sum + w, 0);
			let roll = next() * total;
			for (const [value, weight] of entries) {
				roll -= weight;
				if (roll <= 0) return value;
			}
			const last = entries[entries.length - 1];
			if (!last) throw new Error("weighted pick from empty list");
			return last[0];
		},
	};
}
export type Rng = ReturnType<typeof rngFor>;

// ─── Supabase Storage (REST, service role) ──────────────────────────────────

function storageConfig() {
	const url = process.env.SUPABASE_URL;
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!url || !key) return null;
	return { url: url.replace(/\/$/, ""), key };
}

export function storageConfigured(): boolean {
	return storageConfig() !== null;
}

function splitKey(key: string) {
	const [bucket, ...rest] = key.split("/");
	const objectPath = rest.join("/");
	if (!bucket || !objectPath) throw new Error("Malformed storage key");
	return { bucket, objectPath };
}

async function storageFetch(
	route: string,
	init: {
		method: string;
		body?: string | Uint8Array;
		headers?: Record<string, string>;
	},
) {
	const config = storageConfig();
	if (!config) throw new Error("Supabase Storage is not configured");
	for (let attempt = 0; ; attempt++) {
		try {
			const response = await fetch(`${config.url}/storage/v1/${route}`, {
				method: init.method,
				body: init.body as never,
				headers: {
					Authorization: `Bearer ${config.key}`,
					apikey: config.key,
					...init.headers,
				},
			});
			if (response.status >= 500 && attempt < 3) {
				await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
				continue;
			}
			return response;
		} catch (error) {
			if (attempt >= 3) throw error;
			await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
		}
	}
}

/** Uploads bytes to a key (upsert - only ever used on seed keys). */
export async function uploadObject(
	key: string,
	body: Uint8Array,
	contentType: string,
): Promise<void> {
	const { bucket, objectPath } = splitKey(key);
	const response = await storageFetch(
		`object/${bucket}/${encodePath(objectPath)}`,
		{
			method: "POST",
			body,
			headers: { "Content-Type": contentType, "x-upsert": "true" },
		},
	);
	if (!response.ok) {
		throw new Error(
			`Upload failed for ${key}: ${response.status} ${(await response.text()).slice(0, 200)}`,
		);
	}
}

/** Server-side copy inside one bucket. An existing destination counts as done. */
export async function copyObject(source: string, destination: string) {
	const from = splitKey(source);
	const to = splitKey(destination);
	if (from.bucket !== to.bucket) throw new Error("Cross-bucket copy");
	const response = await storageFetch("object/copy", {
		method: "POST",
		body: JSON.stringify({
			bucketId: from.bucket,
			sourceKey: from.objectPath,
			destinationKey: to.objectPath,
		}),
		headers: { "Content-Type": "application/json" },
	});
	if (response.ok) return;
	const text = await response.text();
	if (/already exists|Duplicate/i.test(text)) return;
	throw new Error(
		`Copy failed for ${destination}: ${response.status} ${text.slice(0, 200)}`,
	);
}

/** Removes keys (any bucket mix). Missing objects are ignored by Supabase. */
export async function removeObjects(keys: string[]): Promise<number> {
	const byBucket = new Map<string, string[]>();
	for (const key of keys) {
		const { bucket, objectPath } = splitKey(key);
		byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), objectPath]);
	}
	let removed = 0;
	for (const [bucket, paths] of byBucket) {
		for (let i = 0; i < paths.length; i += 500) {
			const response = await storageFetch(`object/${bucket}`, {
				method: "DELETE",
				body: JSON.stringify({ prefixes: paths.slice(i, i + 500) }),
				headers: { "Content-Type": "application/json" },
			});
			if (!response.ok) {
				throw new Error(
					`Delete failed in ${bucket}: ${response.status} ${(await response.text()).slice(0, 200)}`,
				);
			}
			const json = (await response.json()) as unknown[];
			removed += Array.isArray(json) ? json.length : 0;
		}
	}
	return removed;
}

function encodePath(objectPath: string) {
	return objectPath.split("/").map(encodeURIComponent).join("/");
}

/** Runs async work over items with bounded concurrency. */
export async function mapLimit<T>(
	items: readonly T[],
	limit: number,
	work: (item: T, index: number) => Promise<void>,
) {
	let cursor = 0;
	const runners = Array.from({ length: Math.min(limit, items.length) }, () =>
		(async () => {
			while (cursor < items.length) {
				const index = cursor++;
				await work(items[index] as T, index);
			}
		})(),
	);
	await Promise.all(runners);
}
