import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	type ApiResponse,
	AUTH,
	apiClient,
	type LoginInput,
	type LoginResponse,
	type SignUpInput,
} from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

export function useSignIn() {
	const setAuth = useAuthStore((s) => s.setAuth);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (input: LoginInput) => {
			const { data } = await apiClient.post<ApiResponse<LoginResponse>>(
				AUTH.LOGIN,
				input,
			);
			return data.data;
		},
		onSuccess: (data) => {
			setAuth(data.user.email, data.tokens);
			queryClient.invalidateQueries({ queryKey: ["me"] });
		},
	});
}

export function useSignUp() {
	const setAuth = useAuthStore((s) => s.setAuth);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (input: SignUpInput) => {
			const { data } = await apiClient.post<ApiResponse<LoginResponse>>(
				AUTH.SIGNUP,
				input,
			);
			return data.data;
		},
		onSuccess: (data) => {
			setAuth(data.user.email, data.tokens);
			queryClient.invalidateQueries({ queryKey: ["me"] });
		},
	});
}

export function useSignOut() {
	const signOut = useAuthStore((s) => s.signOut);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async () => {
			try {
				await apiClient.post(AUTH.LOGOUT);
			} catch {
				// Logout is best-effort on the client
			}
		},
		onSuccess: () => {
			queryClient.clear();
			signOut();
		},
		onSettled: () => {
			queryClient.clear();
			signOut();
		},
	});
}
