import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { authService } from "@/lib/api/auth";
import { API_URL } from "@/lib/env";
import { storage } from "@/lib/storage";
import { useAuthStore } from "@/store/auth-store";

const apiClient = axios.create({
	baseURL: API_URL,
	timeout: 30000,
	headers: { "Content-Type": "application/json" },
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
			await authService.logout();
			useAuthStore.getState().signOut();
		}
		return Promise.reject(error);
	},
);

export default apiClient;
