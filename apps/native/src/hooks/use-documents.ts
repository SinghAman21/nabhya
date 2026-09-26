import type {
	UploadOrgDocumentInput,
	UploadUserDocumentInput,
} from "@nabhya/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Linking } from "react-native";
import { organizationsApi, queryKeys, uploadsApi, usersApi } from "@/lib/api";

export function useMyOrgDocuments(enabled = true) {
	return useQuery({
		queryKey: queryKeys.myOrgDocuments,
		queryFn: organizationsApi.documents,
		enabled,
	});
}

export function useMyUserDocuments(enabled = true) {
	return useQuery({
		queryKey: queryKeys.myUserDocuments,
		queryFn: usersApi.documents,
		enabled,
	});
}

export function useUploadOrgDocument() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: UploadOrgDocumentInput) =>
			organizationsApi.uploadDocument(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.myOrgDocuments });
			// Submitting a document re-opens review for a rejected NGO, which
			// changes the org row itself - without this the screen went on
			// saying "not approved" after the corrected copy was in.
			queryClient.invalidateQueries({ queryKey: queryKeys.myOrganization });
			queryClient.invalidateQueries({ queryKey: queryKeys.me });
			queryClient.invalidateQueries({ queryKey: queryKeys.onboardingStatus });
		},
	});
}

export function useUploadUserDocument() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: UploadUserDocumentInput) =>
			usersApi.uploadDocument(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.myUserDocuments });
			queryClient.invalidateQueries({ queryKey: queryKeys.me });
		},
	});
}

/**
 * Opens a stored document.
 *
 * Keys are not URLs and the bucket is private, so this exchanges the key for a
 * short-lived signed URL each time rather than persisting one anywhere.
 */
export function useOpenDocument() {
	return useMutation({
		mutationFn: async (key: string) => {
			const { url } = await uploadsApi.downloadUrl(key);
			const canOpen = await Linking.canOpenURL(url);
			if (!canOpen) throw new Error("No app available to open this file.");
			await Linking.openURL(url);
			return url;
		},
	});
}
