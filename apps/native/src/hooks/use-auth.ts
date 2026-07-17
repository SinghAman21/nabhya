import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { useAuthStore } from "@/store/auth-store";

export function useSignIn() {
	const setUser = useAuthStore((s) => s.setUser);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (input: { email: string; password: string }) => {
			const { data, error } = await authClient.signIn.email(input);
			if (error) throw error;
			return data;
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
			const { data, error } = await authClient.signUp.email(input);
			if (error) throw error;
			return data;
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
			await authClient.signOut();
		},
		onSettled: () => {
			queryClient.clear();
			signOut();
		},
	});
}
