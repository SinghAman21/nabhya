import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { storage } from "@/lib/storage";

interface FeedState {
	/**
	 * A feed search term. Nothing writes it today: the desktop top bar's field
	 * is now a global search (`components/search-panel.tsx`) that opens
	 * results rather than filtering the feed under it. Kept so a future
	 * in-feed filter has one place to live.
	 */
	search: string;
	setSearch: (search: string) => void;
	/** City scope. Empty string (`ALL_INDIA`) means unscoped. */
	city: string;
	setCity: (city: string) => void;
}

/**
 * The feed's city scope, owned outside the screen.
 *
 * **The default is All India, always.** It used to apply the volunteer's
 * profile city on first load (and fall back to Mumbai when a detected city
 * came up empty), so a new volunteer's first feed was one city's handful of
 * rows - on a young platform, often none - with nothing on screen explaining
 * why. Their home city is now a one-tap row at the top of the picker, never
 * applied on their behalf.
 *
 * The city is persisted, because it is only ever set by the person choosing
 * it: an explicit choice should survive a relaunch, and the default it
 * replaces is the widest view rather than a guess. The search term is not.
 */
export const useFeedStore = create<FeedState>()(
	persist(
		(set) => ({
			search: "",
			setSearch: (search) => set({ search }),
			city: "",
			setCity: (city) => set({ city }),
		}),
		{
			name: "nabhya-feed-scope",
			storage: createJSONStorage(() => ({
				getItem: (key) => storage.get(key),
				setItem: (key, value) => storage.set(key, value),
				removeItem: (key) => storage.remove(key),
			})),
			partialize: (state) => ({ city: state.city }),
		},
	),
);
