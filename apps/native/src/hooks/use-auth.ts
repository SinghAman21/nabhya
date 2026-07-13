import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	type ApiResponse,
	AUTH,
	apiClient,
	type LoginInput,
	type SignUpInput,
} from "@/lib/api";
import type { LoginResponse } from "@/lib/types";
import type { AuthState } from "@/store/auth-store";
import { useAuthStore } from "@/store/auth-store";

export function useSignIn() {
	const setAuth = useAuthStore((state: AuthState) => state.setAuth);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (input: LoginInput) => {
			const { data } = await apiClient.post<ApiResponse<LoginResponse>>(
				AUTH.LOGIN,
				input,
			);
			return data.data;
		},
		onSuccess: (data: LoginResponse) => {
			setAuth(data.user, {
				accessToken: data.accessToken,
				refreshToken: data.refreshToken,
			});
			queryClient.invalidateQueries({ queryKey: ["me"] });
		},
	});
}

export function useSignUp() {
	const setAuth = useAuthStore((state: AuthState) => state.setAuth);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (input: SignUpInput) => {
			const { data } = await apiClient.post<ApiResponse<LoginResponse>>(
				AUTH.REGISTER,
				input,
			);
			return data.data;
		},
		onSuccess: (data: LoginResponse) => {
			setAuth(data.user, {
				accessToken: data.accessToken,
				refreshToken: data.refreshToken,
			});
			queryClient.invalidateQueries({ queryKey: ["me"] });
		},
	});
}

export function useSignOut() {
	const signOut = useAuthStore((state: AuthState) => state.signOut);
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
