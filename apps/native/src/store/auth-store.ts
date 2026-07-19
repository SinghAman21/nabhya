import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { storage } from "@/lib/storage";
import type { User } from "@/lib/types";

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

export type UserRole = "ngo" | "volunteer";

export interface AuthState {
	user: User | null;
	email: string | null;
	role: UserRole | null;
	orgProfile: OrgProfile;
	isOnboarded: boolean;
	isVerified: boolean;
	isSkipped: boolean;
	isHydrated: boolean;
	setUser: (user: User) => void;
	setRole: (role: UserRole) => void;
	mergeProfile: (fields: Partial<OrgProfile>) => void;
	setAuth: (email: string) => void;
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
			user: null,
			email: null,
			role: null,
			orgProfile: { ...emptyProfile },
			isOnboarded: false,
			isVerified: false,
			isSkipped: false,
			isHydrated: false,
			setUser: (user) => set({ user, email: user.email }),
			setRole: (role) => set({ role }),
			mergeProfile: (fields) =>
				set((state) => ({
					orgProfile: { ...state.orgProfile, ...fields },
				})),
			setAuth: (email) => set({ email }),
			setOnboarded: () => set({ isOnboarded: true }),
			setVerified: () => set({ isVerified: true, isSkipped: false }),
			setSkipped: () =>
				set({
					isSkipped: true,
					isOnboarded: true,
					isVerified: false,
				}),
			setGuestMode: () =>
				set({
					email: "guest@nabhya.app",
					user: null,
					role: "volunteer",
					orgProfile: { ...emptyProfile },
					isOnboarded: true,
					isVerified: false,
					isSkipped: true,
				}),
			signOut: () => {
				void storage.remove("accessToken");
				set({
					user: null,
					email: null,
					role: null,
					orgProfile: { ...emptyProfile },
					isOnboarded: false,
					isVerified: false,
					isSkipped: false,
				});
			},
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
				email: state.email,
				role: state.role,
				orgProfile: state.orgProfile,
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
