import { createClient } from "@supabase/supabase-js";
import axios from "axios";
import { AppState } from "react-native";
import "react-native-url-polyfill/auto";
import { API_URL, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import type { AuthResponse, LoginInput, SignUpInput } from "@/lib/types";
import { storage } from "../storage";
import { USERS } from "./endpoints";

// Supabase's session storage adapter expects getItem/setItem/removeItem —
// apps/native/src/lib/storage.ts uses get/set/remove for its other callers
// (theme, auth-store persistence), so this is a thin shim rather than a
// rename that would ripple through unrelated code.
const supabaseStorage = {
	getItem: (key: string) => storage.get(key),
	setItem: (key: string, value: string) => storage.set(key, value),
	removeItem: (key: string) => storage.remove(key),
};

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
	auth: {
		storage: supabaseStorage,
		autoRefreshToken: true,
		persistSession: true,
		detectSessionInUrl: false,
	},
});

// Supabase's token auto-refresh is driven by a timer that keeps running while
// the app is backgrounded unless explicitly paused — this is the officially
// recommended wiring for React Native (supabase-js docs), and has no Neon
// Auth equivalent since that adapter managed its own session lifecycle.
AppState.addEventListener("change", (state) => {
	if (state === "active") {
		supabase.auth.startAutoRefresh();
	} else {
		supabase.auth.stopAutoRefresh();
	}
});

export class AuthService {
	async signup(input: SignUpInput): Promise<AuthResponse> {
		const result = await supabase.auth.signUp({
			email: input.email,
			password: input.password,
			options: { data: { name: input.name } },
		});
		this.throwIfSupabaseError(result.error);
		return this.getAuthenticatedUser(result.data.session?.access_token);
	}

	async login(input: LoginInput): Promise<AuthResponse> {
		const result = await supabase.auth.signInWithPassword({
			email: input.email,
			password: input.password,
		});
		this.throwIfSupabaseError(result.error);
		return this.getAuthenticatedUser(result.data.session?.access_token);
	}

	async logout(): Promise<void> {
		try {
			await supabase.auth.signOut();
		} finally {
			await this.clearToken();
		}
	}

	private async getAuthenticatedUser(
		accessToken: string | undefined,
	): Promise<AuthResponse> {
		if (!accessToken) {
			throw new Error("Supabase Auth did not return an access token");
		}

		await storage.set("accessToken", accessToken);

		const response = await axios.get(`${API_URL}${USERS.ME}`, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		return { accessToken, user: response.data.data };
	}

	private throwIfSupabaseError(error: { message?: string } | null) {
		if (error) throw new Error(error.message ?? "Supabase Auth request failed");
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
}

export const authService = new AuthService();
