import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AuthTokens, User } from "@/lib/api/types";
import { storage } from "@/lib/storage";

interface AuthState {
	user: User | null;
	tokens: AuthTokens | null;
	isOnboarded: boolean;
	isHydrated: boolean;
	setAuth: (user: User, tokens: AuthTokens) => void;
	setTokens: (tokens: AuthTokens) => void;
	setOnboarded: () => void;
	signOut: () => void;
	hydrate: () => void;
}

export const useAuthStore = create<AuthState>()(
	persist(
		(set) => ({
			user: null,
			tokens: null,
			isOnboarded: false,
			isHydrated: false,
			setAuth: (user, tokens) => set({ user, tokens }),
			setTokens: (tokens) => set({ tokens }),
			setOnboarded: () => set({ isOnboarded: true }),
			signOut: () => set({ user: null, tokens: null, isOnboarded: false }),
			hydrate: () => set({ isHydrated: true }),
		}),
		{
			name: "nabhya-auth",
			storage: createJSONStorage(() => ({
				getItem: async (key) => {
					const value = await storage.get(key);
					return value;
				},
				setItem: async (key, value) => {
					await storage.set(key, value);
				},
				removeItem: async (key) => {
					await storage.remove(key);
				},
			})),
			partialize: (state) => ({
				user: state.user,
				tokens: state.tokens,
				isOnboarded: state.isOnboarded,
			}),
			onRehydrateStorage: () => (state) => {
				state?.hydrate();
			},
		},
	),
);
