import type { SortDir } from "@nabhya/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDebounced } from "@/hooks/useDebounced";

/**
 * A console list's filters, sort and search, held in the URL.
 *
 * They were all `useState`, so a reload, a shared link or a Back from another
 * page put a reviewer on the default filter with no idea where they had been.
 * In the URL they survive all three, and the dashboard can link straight to a
 * filtered list (`/organizations?verification=AWAITING`) instead of to a list
 * that then disagrees with the tile that opened it.
 *
 * **The default is never written.** Choosing the default removes the param, so
 * an unfiltered page has a clean URL and a link to it does not pin today's
 * default forever. An unknown value (a stale link, a hand-edited URL) reads as
 * the default rather than reaching the server and failing validation.
 */

type Params = Record<string, string | string[] | undefined>;

function read(params: Params, name: string) {
	const raw = params[name];
	return typeof raw === "string" ? raw : undefined;
}

export function useParamState<T extends string>(
	name: string,
	fallback: T,
	allowed: readonly T[],
) {
	const params = useLocalSearchParams() as Params;
	const router = useRouter();
	const raw = read(params, name);
	const value =
		raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;

	const set = useCallback(
		(next: T) =>
			router.setParams({ [name]: next === fallback ? undefined : next }),
		[router, name, fallback],
	);

	return [value, set] as const;
}

/**
 * Sort key and direction, as one value - they are written together, since a
 * header press changes both and two `setParams` calls would render the page
 * once with the new key and the old direction.
 */
export function useParamSort<K extends string>(
	fallback: { sort: K; dir: SortDir },
	allowed: readonly K[],
) {
	const params = useLocalSearchParams() as Params;
	const router = useRouter();
	const rawSort = read(params, "sort");
	const rawDir = read(params, "dir");

	const sort =
		rawSort && (allowed as readonly string[]).includes(rawSort)
			? (rawSort as K)
			: fallback.sort;
	const dir: SortDir =
		rawDir === "asc" || rawDir === "desc" ? rawDir : fallback.dir;

	const set = useCallback(
		(next: { sort: K; dir: SortDir }) =>
			router.setParams({
				sort: next.sort === fallback.sort ? undefined : next.sort,
				dir:
					next.sort === fallback.sort && next.dir === fallback.dir
						? undefined
						: next.dir,
			}),
		[router, fallback.sort, fallback.dir],
	);

	return [{ sort, dir }, set] as const;
}

/**
 * The search box: typed into local state, written to the URL once debounced.
 *
 * Not `setParams` per keystroke - each one is a navigation, and on the web a
 * history write. The box stays responsive and the URL catches up when the
 * query does. Returns the live text for the field and the debounced value for
 * the request, which is the pair `Toolbar` already takes.
 */
export function useParamSearch(name = "q") {
	const params = useLocalSearchParams() as Params;
	const router = useRouter();
	const fromUrl = read(params, name) ?? "";
	const [text, setText] = useState(fromUrl);
	const debounced = useDebounced(text.trim());

	// Write only what the URL does not already say, so a value that arrived
	// *from* the URL is not written straight back.
	const written = useRef(fromUrl);
	useEffect(() => {
		if (debounced === written.current) return;
		written.current = debounced;
		router.setParams({ [name]: debounced || undefined });
	}, [debounced, name, router]);

	// A link or Back that changes the param under a mounted screen.
	useEffect(() => {
		if (fromUrl !== written.current) {
			written.current = fromUrl;
			setText(fromUrl);
		}
	}, [fromUrl]);

	return { text, setText, debounced };
}
