import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AuthTokens } from "@/lib/api/types";
import { storage } from "@/lib/storage";

export interface OrgProfile {
	orgName: string;
	phone: string;
	orgType: string;
	address: string;
	city: string;
	state: string;
	pincode: string;
	teamSize: number;
	foundingYear: number;
	description: string;
	website: string;
}

const emptyProfile: OrgProfile = {
	orgName: "",
	phone: "",
	orgType: "",
	address: "",
	city: "",
	state: "",
	pincode: "",
	teamSize: 0,
	foundingYear: 0,
	description: "",
	website: "",
};

interface AuthState {
	email: string | null;
	orgProfile: OrgProfile;
	tokens: AuthTokens | null;
	isOnboarded: boolean;
	isVerified: boolean;
	isSkipped: boolean;
	isHydrated: boolean;
	signUp: (email: string) => void;
	mergeProfile: (fields: Partial<OrgProfile>) => void;
	setAuth: (email: string, tokens: AuthTokens) => void;
	setTokens: (tokens: AuthTokens) => void;
	setOnboarded: () => void;
	setVerified: () => void;
	setSkipped: () => void;
	setGuestMode: () => void;
	signOut: () => void;
	hydrate: () => void;
}

export const useAuthStore = create<AuthState>()(
	persist(
		(set) => ({
			email: null,
			orgProfile: { ...emptyProfile },
			tokens: null,
			isOnboarded: false,
			isVerified: false,
			isSkipped: false,
			isHydrated: false,
			signUp: (email) =>
				set({
					email,
					orgProfile: { ...emptyProfile },
					isOnboarded: false,
					isVerified: false,
					isSkipped: false,
				}),
			mergeProfile: (fields) =>
				set((state) => ({
					orgProfile: { ...state.orgProfile, ...fields },
				})),
			setAuth: (email, tokens) => set({ email, tokens }),
			setTokens: (tokens) => set({ tokens }),
			setOnboarded: () => set({ isOnboarded: true }),
			setVerified: () => set({ isVerified: true, isSkipped: false }),
			setSkipped: () =>
				set({
					isSkipped: true,
					isOnboarded: true,
					isVerified: false,
					tokens: null,
				}),
			setGuestMode: () =>
				set({
					email: "guest@nabhya.app",
					orgProfile: { ...emptyProfile },
					tokens: null,
					isOnboarded: true,
					isVerified: false,
					isSkipped: true,
				}),
			signOut: () =>
				set({
					email: null,
					orgProfile: { ...emptyProfile },
					tokens: null,
					isOnboarded: false,
					isVerified: false,
					isSkipped: false,
				}),
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
				email: state.email,
				orgProfile: state.orgProfile,
				tokens: state.tokens,
				isOnboarded: state.isOnboarded,
				isVerified: state.isVerified,
				isSkipped: state.isSkipped,
			}),
			onRehydrateStorage: () => (state) => {
				state?.hydrate();
			},
		},
	),
);
