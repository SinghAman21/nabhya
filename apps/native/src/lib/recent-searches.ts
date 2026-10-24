import { useCallback, useEffect, useMemo, useState } from "react";
import { storage } from "@/lib/storage";

const KEY = "nabhya-recent-searches";

/**
 * Eight, and short ones. `lib/storage` is `expo-secure-store` on native, which
 * caps a value at 2048 bytes - the same budget `lib/post-drafts.ts` works
 * against - and a list longer than this stops being a shortcut and becomes
 * another list to read.
 */
const MAX = 8;
const MAX_TERM_LENGTH = 60;

/**
 * The terms this person searched for, most recent first.
 *
 * A search screen without them makes every repeat search a retype, which is the
 * common case on a phone: the same NGO, the same item, the same city, a day
 * apart. Kept on the device only - a search term is a fair record of what
 * someone is short of, and there is no reason for the server to hold it.
 *
 * Only **committed** terms are recorded (the keyboard's Search key, or opening
 * a result), never what the debounce fires on: recording as you type would fill
 * the list with "b", "bl", "bla".
 */
export function useRecentSearches() {
	const [terms, setTerms] = useState<string[]>([]);

	useEffect(() => {
		let cancelled = false;
		storage.get(KEY).then((raw) => {
			if (cancelled || !raw) return;
			try {
				const parsed: unknown = JSON.parse(raw);
				if (Array.isArray(parsed)) {
					setTerms(
						parsed
							.filter((t): t is string => typeof t === "string")
							.slice(0, MAX),
					);
				}
			} catch {
				// A malformed value is not worth reporting: drop it and move on.
			}
		});
		return () => {
			cancelled = true;
		};
	}, []);

	const persist = useCallback((next: string[]) => {
		setTerms(next);
		if (next.length === 0) storage.remove(KEY);
		else storage.set(KEY, JSON.stringify(next));
	}, []);

	const record = useCallback(
		(raw: string) => {
			const term = raw.trim().slice(0, MAX_TERM_LENGTH);
			if (!term) return;
			// Case-insensitive dedupe, but the new spelling wins: whatever the
			// person typed most recently is what they will recognise.
			const rest = terms.filter(
				(existing) => existing.toLowerCase() !== term.toLowerCase(),
			);
			persist([term, ...rest].slice(0, MAX));
		},
		[terms, persist],
	);

	const remove = useCallback(
		(term: string) => {
			persist(terms.filter((existing) => existing !== term));
		},
		[terms, persist],
	);

	const clear = useCallback(() => persist([]), [persist]);

	// One object per change, not per render, so a caller can list it as a
	// dependency without re-running on every keystroke.
	return useMemo(
		() => ({ terms, record, remove, clear }),
		[terms, record, remove, clear],
	);
}
