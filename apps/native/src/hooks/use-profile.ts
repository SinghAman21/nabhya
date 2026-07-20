import type {
	CompleteOrgOnboardingInput,
	CompleteVolunteerOnboardingInput,
	SelectableRole,
	UpdateUserProfileInput,
	UploadUserDocumentInput,
} from "@nabhya/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { categoriesApi, onboardingApi, queryKeys, usersApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

/** The authenticated user's profile — the client's source of truth for role. */
export function useMe(enabled = true) {
	return useQuery({
		queryKey: queryKeys.me,
		queryFn: usersApi.me,
		enabled,
	});
}

export function useOnboardingStatus(enabled = true) {
	return useQuery({
		queryKey: queryKeys.onboardingStatus,
		queryFn: onboardingApi.status,
		enabled,
	});
}

export function useCategories() {
	return useQuery({
		queryKey: queryKeys.categories,
		queryFn: categoriesApi.list,
		// Cause categories are effectively static within a session.
		staleTime: 30 * 60 * 1000,
	});
}

export function useUpdateProfile() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: UpdateUserProfileInput) =>
			usersApi.updateProfile(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.me });
		},
	});
}

export function useMyDocuments() {
	return useQuery({
		queryKey: queryKeys.myDocuments,
		queryFn: usersApi.documents,
	});
}

export function useUploadUserDocument() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: UploadUserDocumentInput) =>
			usersApi.uploadDocument(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.myDocuments });
			// A fresh upload flips the user back to PENDING verification.
			queryClient.invalidateQueries({ queryKey: queryKeys.me });
		},
	});
}

/**
 * Persists the role chosen on the role-select screen, then mirrors it into the
 * local store so routing can proceed without waiting for a refetch.
 */
export function useSelectRole() {
	const queryClient = useQueryClient();
	const setRole = useAuthStore((s) => s.setRole);

	return useMutation({
		mutationFn: (role: SelectableRole) => usersApi.selectRole(role),
		onSuccess: (_data, role) => {
			setRole(role);
			queryClient.invalidateQueries({ queryKey: queryKeys.me });
			queryClient.invalidateQueries({ queryKey: queryKeys.onboardingStatus });
		},
	});
}

export function useCompleteOrgOnboarding() {
	const queryClient = useQueryClient();
	const setOnboarded = useAuthStore((s) => s.setOnboarded);

	return useMutation({
		mutationFn: (input: CompleteOrgOnboardingInput) =>
			onboardingApi.completeOrganization(input),
		onSuccess: () => {
			setOnboarded();
			queryClient.invalidateQueries({ queryKey: queryKeys.me });
			queryClient.invalidateQueries({ queryKey: queryKeys.onboardingStatus });
		},
	});
}

export function useCompleteVolunteerOnboarding() {
	const queryClient = useQueryClient();
	const setOnboarded = useAuthStore((s) => s.setOnboarded);

	return useMutation({
		mutationFn: (input: CompleteVolunteerOnboardingInput) =>
			onboardingApi.completeVolunteer(input),
		onSuccess: () => {
			setOnboarded();
			queryClient.invalidateQueries({ queryKey: queryKeys.me });
			queryClient.invalidateQueries({ queryKey: queryKeys.onboardingStatus });
		},
	});
}
