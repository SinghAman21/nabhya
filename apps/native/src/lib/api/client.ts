import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/store/auth-store";
import { AUTH } from "./endpoints";

const apiClient = axios.create({
	baseURL: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000",
	timeout: 30000,
	headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
	const token = useAuthStore.getState().tokens?.accessToken;
	if (token) {
		config.headers.Authorization = `Bearer ${token}`;
	}
	return config;
});

let isRefreshing = false;
let failedQueue: Array<{
	resolve: (token: string) => void;
	reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
	failedQueue.forEach((prom) => {
		if (error) {
			prom.reject(error);
		} else {
			prom.resolve(token!);
		}
	});
	failedQueue = [];
};

apiClient.interceptors.response.use(
	(response) => response,
	async (error: AxiosError) => {
		const originalRequest = error.config as InternalAxiosRequestConfig & {
			_retry?: boolean;
		};

		if (error.response?.status === 401 && !originalRequest._retry) {
			if (isRefreshing) {
				return new Promise((resolve, reject) => {
					failedQueue.push({ resolve, reject });
				}).then((token) => {
					originalRequest.headers.Authorization = `Bearer ${token}`;
					return apiClient(originalRequest);
				});
			}

			originalRequest._retry = true;
			isRefreshing = true;

			try {
				const refreshToken = useAuthStore.getState().tokens?.refreshToken;
				if (!refreshToken) throw new Error("No refresh token");

				const { data } = await axios.post(
					`${apiClient.defaults.baseURL}${AUTH.REFRESH}`,
					{ refreshToken },
				);

				const newToken = data.data.tokens.accessToken;
				useAuthStore.getState().setTokens(data.data.tokens);
				processQueue(null, newToken);

				originalRequest.headers.Authorization = `Bearer ${newToken}`;
				return apiClient(originalRequest);
			} catch (refreshError) {
				processQueue(refreshError, null);
				useAuthStore.getState().signOut();
				return Promise.reject(refreshError);
			} finally {
				isRefreshing = false;
			}
		}

		return Promise.reject(error);
	},
);

export default apiClient;
