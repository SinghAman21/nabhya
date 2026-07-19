import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authService } from "@/lib/api/auth";
import { useAuthStore } from "@/store/auth-store";

export function useSignIn() {
	const setUser = useAuthStore((s) => s.setUser);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (input: { email: string; password: string }) => {
			return authService.login(input);
		},
		onSuccess: (data) => {
			if (data?.user) setUser(data.user);
			queryClient.invalidateQueries({ queryKey: ["me"] });
		},
	});
}

export function useSignUp() {
	const setUser = useAuthStore((s) => s.setUser);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (input: {
			email: string;
			password: string;
			name: string;
		}) => {
			return authService.signup(input);
		},
		onSuccess: (data) => {
			if (data?.user) setUser(data.user);
			queryClient.invalidateQueries({ queryKey: ["me"] });
		},
	});
}

export function useSignOut() {
	const signOut = useAuthStore((s) => s.signOut);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async () => {
			await authService.logout();
		},
		onSettled: () => {
			queryClient.clear();
			signOut();
		},
	});
}
