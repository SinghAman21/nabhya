import { useQuery } from "@tanstack/react-query";
import { queryKeys, uploadsApi } from "@/lib/api";

/**
 * How long a resolved URL is treated as fresh.
 *
 * The server signs read URLs for longer than this; the gap is deliberate, so a
 * URL is replaced well before it expires rather than at the moment a slow
 * connection is halfway through fetching the image it points at.
 */
const FRESH_FOR_MS = 5 * 60 * 1000;

/**
 * Turns a stored object key into something an `<Image>` can load.
 *
 * The bucket is private and this app stores **keys, not URLs** — see the
 * uploads note in the root `AGENTS.md`. So an org logo or cover cannot be
 * rendered straight from the record: the key has to be exchanged for a
 * short-lived signed URL first. Cached per key so a logo shown in three places
 * on one screen resolves once.
 *
 * Returns `undefined` for a missing key, a key that has not resolved yet, or a
 * key the storage layer refuses — every caller therefore needs a real fallback
 * (initials for a logo, a tinted panel for a cover), not a spinner. That also
 * covers development with no Supabase Storage credentials, where the storage
 * stub has nothing to sign.
 */
export function useStoredImageUrl(key: string | null | undefined) {
	const query = useQuery({
		queryKey: queryKeys.storedImage(key ?? ""),
		queryFn: () => uploadsApi.downloadUrl(key as string),
		enabled: Boolean(key),
		staleTime: FRESH_FOR_MS,
		gcTime: FRESH_FOR_MS,
		// A key whose object is gone will not come back by asking again.
		retry: false,
	});

	return query.data?.url;
}
