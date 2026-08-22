import { useEffect, useState } from "react";

/**
 * Debounces a rapidly-changing value — a search box, in practice.
 *
 * Without this, every keystroke is a request: typing "blankets" fires eight
 * queries, seven of which are already stale when they land, and the list flickers
 * through their results in whatever order the network returns them.
 */
export function useDebounced<T>(value: T, delayMs = 300): T {
	const [debounced, setDebounced] = useState(value);

	useEffect(() => {
		const timer = setTimeout(() => setDebounced(value), delayMs);
		return () => clearTimeout(timer);
	}, [value, delayMs]);

	return debounced;
}
