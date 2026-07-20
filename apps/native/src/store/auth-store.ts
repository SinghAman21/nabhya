import type { Role } from "@nabhya/shared";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { storage } from "@/lib/storage";
import type { OnboardingStatus, User } from "@/lib/types";

export interface OrgProfile {
	orgName: string;
	phone: string;
	orgType: string;
	registrationNumber: string;
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
	registrationNumber: "",
	address: "",
	city: "",
	state: "",
	pincode: "",
	teamSize: 0,
	foundingYear: 0,
	description: "",
	website: "",
};

/**
 * Canonical vocabulary — `organisation`, not `ngo`. The Expo route group is
 * still called `(ngo)` for readability, but the role value matches the server
 * and the `roles` table.
 */
export type UserRole = Role;

export interface AuthState {
	user: User | null;
	email: string | null;
	role: UserRole | null;
	/** Draft state for the multi-step NGO onboarding wizard. */
	orgProfile: OrgProfile;
	isOnboarded: boolean;
	isVerified: boolean;
	isHydrated: boolean;
	setUser: (user: User) => void;
	setRole: (role: UserRole) => void;
	mergeProfile: (fields: Partial<OrgProfile>) => void;
	setAuth: (email: string) => void;
	setOnboarded: () => void;
	setVerified: () => void;
	/** Reconciles cached routing state with the server's answer. */
	syncFromStatus: (status: OnboardingStatus) => void;
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
			isHydrated: false,
			setUser: (user) => set({ user, email: user.email }),
			setRole: (role) => set({ role }),
			mergeProfile: (fields) =>
				set((state) => ({
					orgProfile: { ...state.orgProfile, ...fields },
				})),
			setAuth: (email) => set({ email }),
			setOnboarded: () => set({ isOnboarded: true }),
			setVerified: () => set({ isVerified: true }),
			syncFromStatus: (status) =>
				set({
					role: status.role,
					isOnboarded: status.isOnboarded,
					isVerified:
						status.organization?.verificationStatus === "VERIFIED" ||
						status.verificationStatus === "VERIFIED",
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
			}),
			onRehydrateStorage: () => (state) => {
				state?.hydrate();
			},
		},
	),
);
