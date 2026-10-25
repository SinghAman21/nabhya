import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { router } from "expo-router";
import { authService } from "@/lib/api/auth";
import { API_URL } from "@/lib/env";
import { storage } from "@/lib/storage";
import { useAuthStore } from "@/store/auth-store";

const apiClient = axios.create({
	baseURL: API_URL,
	timeout: 30000,
	headers: {
		"Content-Type": "application/json",
		// A build pointed at an ngrok tunnel (a local API for a demo): ngrok's
		// free plan can answer with its "you are about to visit" HTML page
		// instead of proxying, which the app would read as a broken response.
		// The header skips that page. Sent only for ngrok hosts, so the web
		// build's CORS preflight never sees an extra custom header.
		...(/ngrok/.test(API_URL) ? { "ngrok-skip-browser-warning": "1" } : {}),
	},
});

apiClient.interceptors.request.use(
	async (config: InternalAxiosRequestConfig) => {
		try {
			const token = await storage.get("accessToken");
			if (token) {
				config.headers.Authorization = `Bearer ${token}`;
			}
		} catch {
			// Not signed in
		}
		return config;
	},
);

apiClient.interceptors.response.use(
	(response) => response,
	async (error: AxiosError) => {
		if (error.response?.status === 401) {
			const original = error.config as
				| (InternalAxiosRequestConfig & { _retried?: boolean })
				| undefined;
			// Access tokens expire after ~15 min; mint a fresh one from the
			// session and retry once before treating the 401 as a real sign-out.
			if (original && !original._retried) {
				const token = await authService.refreshAccessToken();
				if (token) {
					original._retried = true;
					original.headers.Authorization = `Bearer ${token}`;
					return apiClient(original);
				}
			}
			await authService.logout();
			useAuthStore.getState().signOut();
			// Clearing the token is not the same as leaving the screen. Without
			// this the user stayed on whatever they were doing, now signed out:
			// every further request went out with no Authorization header and came
			// back "Authorization header missing", which reads like a broken API
			// rather than an expired session.
			router.replace("/(auth)/login");
		}
		return Promise.reject(error);
	},
);

export default apiClient;
