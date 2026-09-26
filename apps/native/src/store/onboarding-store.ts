import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { storage } from "@/lib/storage";

/**
 * Drafts for the two onboarding wizards.
 *
 * Both verticals now persist, which they did not before: the NGO wizard kept
 * its values in `auth-store.orgProfile` (persisted, but never cleared, so a
 * finished NGO carried a stale copy of its own registration number forever)
 * and the volunteer wizard kept its values in `useState` (lost entirely the
 * moment the app was backgrounded long enough to be killed - halfway through
 * a form is exactly when someone puts the phone down to find a document).
 *
 * One store, one shape per vertical, cleared on a successful submit.
 *
 * **Keep these objects small.** On native `lib/storage` is
 * `expo-secure-store`, which caps a value at 2048 bytes - the same budget
 * `lib/post-drafts.ts` works against. Everything here is short text plus two
 * storage keys and a coordinate pair; the free-text fields are the only ones
 * that could grow, and both are capped at 500 characters by their schema.
 */

export interface OrgDraft {
	orgName: string;
	phone: string;
	orgType: string;
	registrationNumber: string;
	address: string;
	city: string;
	state: string;
	pincode: string;
	latitude?: number;
	longitude?: number;
	categoryIds: string[];
	description: string;
	teamSize: string;
	foundingYear: string;
	website: string;
	/**
	 * Local file URIs of the picked logo and banner. There are no keys beside
	 * them: `ORG_LOGO` and `ORG_COVER` keys cannot be minted before the
	 * organisation exists, so the wizard uploads both after creation and
	 * PATCHes the keys on.
	 */
	logoPreview: string;
	coverPreview: string;
}

export interface VolunteerDraft {
	fullName: string;
	phone: string;
	city: string;
	state: string;
	latitude?: number;
	longitude?: number;
	categoryIds: string[];
	bio: string;
	profileImage: string;
	profileImagePreview: string;
}

const emptyOrg: OrgDraft = {
	orgName: "",
	phone: "",
	orgType: "",
	registrationNumber: "",
	address: "",
	city: "",
	state: "",
	pincode: "",
	categoryIds: [],
	description: "",
	// Numbers live as strings here for the same reason they do in the form: an
	// untouched numeric input is "", and coercing that to 0 made an optional
	// "Founded in" fail its own range check.
	teamSize: "",
	foundingYear: "",
	website: "",
	logoPreview: "",
	coverPreview: "",
};

const emptyVolunteer: VolunteerDraft = {
	fullName: "",
	phone: "",
	city: "",
	state: "",
	categoryIds: [],
	bio: "",
	profileImage: "",
	profileImagePreview: "",
};

interface OnboardingState {
	org: OrgDraft;
	volunteer: VolunteerDraft;
	/** The step each wizard was last on, so a resumed draft resumes in place. */
	orgStep: number;
	volunteerStep: number;
	isHydrated: boolean;
	mergeOrg: (fields: Partial<OrgDraft>) => void;
	mergeVolunteer: (fields: Partial<VolunteerDraft>) => void;
	setOrgStep: (step: number) => void;
	setVolunteerStep: (step: number) => void;
	clearOrg: () => void;
	clearVolunteer: () => void;
	hydrate: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
	persist(
		(set) => ({
			org: { ...emptyOrg },
			volunteer: { ...emptyVolunteer },
			orgStep: 0,
			volunteerStep: 0,
			isHydrated: false,
			mergeOrg: (fields) =>
				set((state) => ({ org: { ...state.org, ...fields } })),
			mergeVolunteer: (fields) =>
				set((state) => ({ volunteer: { ...state.volunteer, ...fields } })),
			setOrgStep: (orgStep) => set({ orgStep }),
			setVolunteerStep: (volunteerStep) => set({ volunteerStep }),
			clearOrg: () => set({ org: { ...emptyOrg }, orgStep: 0 }),
			clearVolunteer: () =>
				set({ volunteer: { ...emptyVolunteer }, volunteerStep: 0 }),
			hydrate: () => set({ isHydrated: true }),
		}),
		{
			name: "nabhya-onboarding",
			storage: createJSONStorage(() => ({
				getItem: (key) => storage.get(key),
				setItem: async (key, value) => {
					await storage.set(key, value);
				},
				removeItem: async (key) => {
					await storage.remove(key);
				},
			})),
			// The `*Preview` fields are deliberately dropped: they are local
			// `file://` URIs, which the picker can revoke as soon as its session
			// ends, so a restored draft claiming a photo would restore a broken
			// one. The uploaded object key survives, and that is the real value -
			// the slot falls back to reading it through `useStoredImageUrl`.
			partialize: (state) => ({
				org: { ...state.org, logoPreview: "", coverPreview: "" },
				volunteer: { ...state.volunteer, profileImagePreview: "" },
				orgStep: state.orgStep,
				volunteerStep: state.volunteerStep,
			}),
			onRehydrateStorage: () => (state) => {
				state?.hydrate();
			},
		},
	),
);
