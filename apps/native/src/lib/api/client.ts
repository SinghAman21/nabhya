import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { authClient } from "@/lib/auth-client";
import { API_URL } from "@/lib/env";
import { useAuthStore } from "@/store/auth-store";

const apiClient = axios.create({
	baseURL: API_URL,
	timeout: 30000,
	headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use(
	async (config: InternalAxiosRequestConfig) => {
		try {
			const cookie = authClient.getCookie?.();
			if (cookie) {
				const match = cookie.match(/better-auth\.session_token=([^;]+)/);
				if (match) {
					config.headers.Authorization = `Bearer ${match[1]}`;
				}
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
			useAuthStore.getState().signOut();
		}
		return Promise.reject(error);
	},
);

export default apiClient;
