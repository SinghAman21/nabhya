import { create } from "zustand";

interface FeedState {
	/** The Discover search term. */
	search: string;
	setSearch: (search: string) => void;
	/** City scope. Empty string means All India. */
	city: string;
	setCity: (city: string) => void;
	/** True once the user has picked a city themselves. */
	cityTouched: boolean;
}

/**
 * Discover's search term and city scope, owned outside the screen.
 *
 * On desktop the search field lives in the top bar and on mobile it lives in the
 * page, so the value has to outlive whichever one is mounted — and there must be
 * exactly one of them. Two fields bound to two pieces of state is how a screen
 * ends up filtered by a term the visible input does not show.
 *
 * `cityTouched` is what lets the feed default to the user's profile city without
 * fighting them: the default applies until they choose, and their choice then
 * stands. Without the flag, every profile refetch would reset their selection.
 *
 * Not persisted: a stale search or a city they were only passing through, restored
 * on next launch, looks like an empty feed.
 */
export const useFeedStore = create<FeedState>((set) => ({
	search: "",
	setSearch: (search) => set({ search }),
	city: "",
	setCity: (city) => set({ city, cityTouched: true }),
	cityTouched: false,
}));
