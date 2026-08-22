import "@/lib/crypto-polyfill";
import { createInternalNeonAuth } from "@neondatabase/auth";
import axios from "axios";
import { API_URL, NEON_AUTH_URL } from "@/lib/env";
import type { AuthResponse, LoginInput, SignUpInput } from "@/lib/types";
import { storage } from "../storage";
import { USERS } from "./endpoints";

const neonAuth = createInternalNeonAuth(NEON_AUTH_URL);
const neonAuthClient = neonAuth.adapter;

export class AuthService {
	async signup(input: SignUpInput): Promise<AuthResponse> {
		const result = await neonAuthClient.signUp.email({
			email: input.email,
			password: input.password,
			name: input.name,
		});
		this.throwIfNeonAuthError(result.error);
		return this.getAuthenticatedUser();
	}

	async login(input: LoginInput): Promise<AuthResponse> {
		const result = await neonAuthClient.signIn.email({
			email: input.email,
			password: input.password,
		});
		this.throwIfNeonAuthError(result.error);
		return this.getAuthenticatedUser();
	}

	async logout(): Promise<void> {
		try {
			await neonAuthClient.signOut();
		} finally {
			await this.clearToken();
		}
	}

	private async getAuthenticatedUser(): Promise<AuthResponse> {
		const accessToken = await this.refreshAccessToken();
		if (!accessToken) {
			throw new Error("Neon Auth did not return an access token");
		}

		await storage.set("accessToken", accessToken);

		const response = await axios.get(`${API_URL}${USERS.ME}`, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		return { accessToken, user: response.data.data };
	}

	private throwIfNeonAuthError(error: { message?: string } | null) {
		if (error) throw new Error(error.message ?? "Neon Auth request failed");
	}

	private async clearToken(): Promise<void> {
		await storage.remove("accessToken");
	}

	/**
	 * Get stored access token
	 */
	async getAccessToken(): Promise<string | null> {
		return storage.get("accessToken");
	}

	/**
	 * Mint a fresh JWT from the Better Auth session. The JWTs expire after
	 * ~15 minutes while the session itself is long-lived, so a 401 usually
	 * just means "stale token", not "signed out".
	 *
	 * NB: `neonAuth.getJWTToken()` is NOT usable here — it returns the
	 * session token minted once at sign-in, whose `exp` then passes and
	 * never recovers. The `/token` endpoint signs a fresh JWT per call.
	 */
	async refreshAccessToken(): Promise<string | null> {
		try {
			const response = await fetch(`${NEON_AUTH_URL}/token`, {
				method: "GET",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
			});
			if (!response.ok) return null;
			const data = (await response.json()) as { token?: string };
			const accessToken = data?.token ?? null;
			if (!accessToken) return null;
			await storage.set("accessToken", accessToken);
			return accessToken;
		} catch {
			return null;
		}
	}
}

export const authService = new AuthService();
