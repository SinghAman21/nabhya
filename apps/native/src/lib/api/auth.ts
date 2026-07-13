import axios, { type AxiosInstance } from "axios";
import type { AuthResponse, LoginInput, SignUpInput } from "@/lib/types";
import { storage } from "../storage";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";

export class AuthService {
	private apiClient: AxiosInstance;

	constructor() {
		this.apiClient = axios.create({
			baseURL: API_URL,
			timeout: 10000,
		});

		// Add interceptor to include access token in headers
		this.apiClient.interceptors.request.use(async (config) => {
			const token = await storage.get("accessToken");
			if (token) {
				config.headers.Authorization = `Bearer ${token}`;
			}
			return config;
		});

		// Add interceptor to handle token refresh on 401
		this.apiClient.interceptors.response.use(
			(response) => response,
			async (error) => {
				if (error.response?.status === 401) {
					try {
						const refreshToken = await storage.get("refreshToken");
						if (refreshToken) {
							await this.refreshAccessToken();
						}
					} catch (refreshError) {
						// Refresh failed, need to logout
						await this.clearTokens();
					}
				}
				return Promise.reject(error);
			},
		);
	}

	/**
	 * Register a new user
	 */
	async signup(input: SignUpInput): Promise<AuthResponse> {
		const response = await this.apiClient.post<AuthResponse>("/auth/register", {
			email: input.email,
			password: input.password,
			name: input.name,
			role: input.role || "volunteer",
		});

		const { accessToken, refreshToken, user } = response.data;

		// Store tokens securely
		await this.storeTokens(accessToken, refreshToken);

		return {
			user,
			accessToken,
			refreshToken,
		};
	}

	/**
	 * Login with email and password
	 */
	async login(input: LoginInput): Promise<AuthResponse> {
		const response = await this.apiClient.post<AuthResponse>("/auth/login", {
			email: input.email,
			password: input.password,
		});

		const { accessToken, refreshToken, user } = response.data;

		// Store tokens securely
		await this.storeTokens(accessToken, refreshToken);

		return {
			user,
			accessToken,
			refreshToken,
		};
	}

	/**
	 * Refresh access token using refresh token
	 */
	async refreshAccessToken(): Promise<string> {
		const refreshToken = await storage.get("refreshToken");

		if (!refreshToken) {
			throw new Error("No refresh token found");
		}

		const response = await this.apiClient.post<AuthResponse>("/auth/refresh", {
			refreshToken,
		});

		const { accessToken, refreshToken: newRefreshToken } = response.data;

		// Update tokens
		await this.storeTokens(accessToken, newRefreshToken);

		return accessToken;
	}

	/**
	 * Logout user
	 */
	async logout(): Promise<void> {
		try {
			await this.apiClient.post("/auth/logout");
		} catch (error) {
			// Even if logout fails, clear local tokens
			console.error("Logout error:", error);
		}

		await this.clearTokens();
	}

	/**
	 * Store tokens securely in device storage
	 */
	private async storeTokens(
		accessToken: string,
		refreshToken: string,
	): Promise<void> {
		await Promise.all([
			storage.set("accessToken", accessToken),
			storage.set("refreshToken", refreshToken),
		]);
	}

	/**
	 * Clear tokens from storage
	 */
	private async clearTokens(): Promise<void> {
		await Promise.all([
			storage.remove("accessToken"),
			storage.remove("refreshToken"),
		]);
	}

	/**
	 * Get stored access token
	 */
	async getAccessToken(): Promise<string | null> {
		return storage.get("accessToken");
	}

	/**
	 * Get stored refresh token
	 */
	async getRefreshToken(): Promise<string | null> {
		return storage.get("refreshToken");
	}
}

export const authService = new AuthService();
