import "@/lib/crypto-polyfill";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { AppState, Platform } from "react-native";
import "react-native-url-polyfill/auto";
import { API_URL, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import type { AuthResponse, LoginInput, SignUpInput } from "@/lib/types";
import { storage } from "../storage";
import { USERS } from "./endpoints";

// Required by expo-web-browser so a browser tab left open by an interrupted
// auth session (e.g. app backgrounded mid sign-in) resolves instead of
// leaking; a no-op everywhere except that edge case.
WebBrowser.maybeCompleteAuthSession();

// Supabase's session storage adapter expects getItem/setItem/removeItem -
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
		// The redirect flow below relies on Supabase parsing the session out of
		// the URL fragment itself on web; native never has session tokens in its
		// own address bar, so leave this off there.
		detectSessionInUrl: Platform.OS === "web",
	},
});

// Supabase's token auto-refresh is driven by a timer that keeps running while
// the app is backgrounded unless explicitly paused - this is the officially
// recommended wiring for React Native (supabase-js docs), and has no Neon
// Auth equivalent since that adapter managed its own session lifecycle.
AppState.addEventListener("change", (state) => {
	if (state === "active") {
		supabase.auth.startAutoRefresh();
	} else {
		supabase.auth.stopAutoRefresh();
	}
});

/** Rejects if `promise` has not settled within `ms` - the promise itself keeps running. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error("timed out")), ms);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(error) => {
				clearTimeout(timer);
				reject(error);
			},
		);
	});
}

/**
 * Sign-up either signs the person straight in or, when the Supabase project
 * requires email confirmation, creates the account with no session at all.
 * The second case is not a failure - the account exists and a retry would say
 * "already registered" - so it is a result the screen renders, not a throw.
 */
export type SignUpResult =
	| ({ status: "signed-in" } & AuthResponse)
	| { status: "confirm-email"; email: string };

/** Where Supabase's emailed links (confirm, reset) send the person back to. */
function authRedirect(path: string): string {
	return Platform.OS === "web"
		? `${window.location.origin}/${path}`
		: Linking.createURL(path);
}

export class AuthService {
	async signup(input: SignUpInput): Promise<SignUpResult> {
		const result = await supabase.auth.signUp({
			email: input.email,
			password: input.password,
			options: {
				data: { name: input.name },
				emailRedirectTo: authRedirect("login"),
			},
		});
		this.throwIfSupabaseError(result.error);
		if (!result.data.session) {
			return { status: "confirm-email", email: input.email };
		}
		const signedIn = await this.getAuthenticatedUser(
			result.data.session.access_token,
		);
		return { status: "signed-in", ...signedIn };
	}

	/** Sends the sign-up confirmation email again. */
	async resendConfirmation(email: string): Promise<void> {
		const { error } = await supabase.auth.resend({
			type: "signup",
			email,
			options: { emailRedirectTo: authRedirect("login") },
		});
		this.throwIfSupabaseError(error);
	}

	/**
	 * Emails a password-reset link. Supabase answers the same way whether or
	 * not the address has an account (anything else is an enumeration oracle),
	 * so the screen must not claim the account exists either.
	 */
	async requestPasswordReset(email: string): Promise<void> {
		const { error } = await supabase.auth.resetPasswordForEmail(email, {
			redirectTo: authRedirect("reset-password"),
		});
		this.throwIfSupabaseError(error);
	}

	/**
	 * Picks up the recovery session the reset link carries. Web: Supabase has
	 * already parsed it out of the address bar (`detectSessionInUrl`), so the
	 * session simply exists. Native: the deep link brings the tokens in its
	 * fragment, the same shape as the Google redirect, and they are set here.
	 * Returns whether a session is now available to change the password on.
	 */
	async startPasswordRecovery(url: string | null): Promise<boolean> {
		if (Platform.OS !== "web" && url) {
			const params = this.parseRedirectParams(url);
			if (params.error) {
				throw new Error(params.error_description ?? params.error);
			}
			if (params.access_token && params.refresh_token) {
				const session = await supabase.auth.setSession({
					access_token: params.access_token,
					refresh_token: params.refresh_token,
				});
				this.throwIfSupabaseError(session.error);
			}
		}
		const { data } = await supabase.auth.getSession();
		return !!data.session;
	}

	/** Sets a new password on the recovery session, then signs in with it. */
	async updatePassword(password: string): Promise<AuthResponse> {
		const { error } = await supabase.auth.updateUser({ password });
		this.throwIfSupabaseError(error);
		const { data } = await supabase.auth.getSession();
		return this.getAuthenticatedUser(data.session?.access_token);
	}

	async login(input: LoginInput): Promise<AuthResponse> {
		const result = await supabase.auth.signInWithPassword({
			email: input.email,
			password: input.password,
		});
		this.throwIfSupabaseError(result.error);
		return this.getAuthenticatedUser(result.data.session?.access_token);
	}

	/**
	 * Google sign-in, routed through Supabase's OAuth provider (already
	 * enabled in the Supabase dashboard - no client secret lives in this app).
	 *
	 * Web: a full-page redirect to Google and back. There is no popup here -
	 * `expo-web-browser`'s popup flow polls `window.closed` to notice the
	 * consent screen finishing, and Chrome's Cross-Origin-Opener-Policy blocks
	 * that read for a cross-origin popup (Google's login page), which either
	 * throws a console error or leaves the promise hanging. The browser tab
	 * *is* the app on web, so there's nothing a popup buys here anyway -
	 * Supabase parses the returned session out of the URL itself
	 * (`detectSessionInUrl` above) once Google redirects back to this origin;
	 * `getCurrentSession()` below picks it up on the next mount.
	 *
	 * Native has no redirect-capable webview of its own, so it opens the
	 * system browser for the Google consent screen and gets handed back to
	 * the app via the `nabhya://` deep link registered in app.json; Supabase
	 * appends the session as a URL fragment on that redirect, which we parse
	 * by hand rather than pull in expo-auth-session for one helper.
	 */
	async signInWithGoogle(): Promise<AuthResponse | null> {
		if (Platform.OS === "web") {
			const { error } = await supabase.auth.signInWithOAuth({
				provider: "google",
				options: { redirectTo: window.location.origin },
			});
			this.throwIfSupabaseError(error);
			return null; // page is navigating away to Google; nothing left to do here
		}

		const redirectTo = Linking.createURL("auth/callback");
		const { data, error } = await supabase.auth.signInWithOAuth({
			provider: "google",
			options: { redirectTo, skipBrowserRedirect: true },
		});
		this.throwIfSupabaseError(error);
		if (!data?.url) {
			throw new Error("Supabase did not return a Google sign-in URL");
		}

		const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
		if (result.type !== "success") {
			// User closed the browser or backgrounded the app - not a real error.
			throw new Error("CANCELLED");
		}

		const params = this.parseRedirectParams(result.url);
		if (params.error) {
			throw new Error(params.error_description ?? params.error);
		}
		if (!params.access_token || !params.refresh_token) {
			throw new Error("Supabase did not return session tokens");
		}

		const session = await supabase.auth.setSession({
			access_token: params.access_token,
			refresh_token: params.refresh_token,
		});
		this.throwIfSupabaseError(session.error);
		return this.getAuthenticatedUser(session.data.session?.access_token);
	}

	/**
	 * Web-only: after Supabase auto-parses a Google redirect's session out of
	 * the URL (`detectSessionInUrl`), pick up whatever session already exists
	 * on this origin. Called once at boot so a page load right after the
	 * Google round-trip lands signed in instead of back at the login screen.
	 */
	async getCurrentSession(): Promise<AuthResponse | null> {
		const { data, error } = await supabase.auth.getSession();
		if (error || !data.session?.access_token) return null;
		return this.getAuthenticatedUser(data.session.access_token);
	}

	/** Supabase's implicit-grant redirect carries the session in a `#` fragment, not `?` query params. */
	private parseRedirectParams(url: string): Record<string, string> {
		const splitIndex =
			url.indexOf("#") !== -1 ? url.indexOf("#") : url.indexOf("?");
		if (splitIndex === -1) return {};
		return Object.fromEntries(new URLSearchParams(url.slice(splitIndex + 1)));
	}

	async logout(): Promise<void> {
		try {
			// Supabase's default `scope: "global"` calls its Auth server to revoke
			// the session everywhere, which is a network request with no timeout
			// of its own - on a flaky connection it can hang well past what
			// anyone waits for a "sign out" tap. Race it: server-side revocation
			// still wins when the network cooperates, but a stalled request can
			// never trap the device sign-out below it, which is the part the
			// person actually asked for and the part `finally` cannot skip.
			await withTimeout(supabase.auth.signOut(), 5000);
		} catch {
			// Revocation failed or timed out - the device still signs out below.
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

	/**
	 * Return a valid access token, refreshing it through Supabase when the
	 * current one has expired. Access tokens are short-lived (an hour by
	 * default) while the refresh token in storage is long-lived, so a 401 from
	 * the API usually means "stale token", not "signed out".
	 *
	 * `getSession()` refreshes transparently when the stored token is past its
	 * expiry, so this is one call in the common case and a null only when there
	 * is genuinely no session left to recover.
	 */
	async refreshAccessToken(): Promise<string | null> {
		try {
			const { data, error } = await supabase.auth.getSession();
			if (error) return null;
			const accessToken = data.session?.access_token ?? null;
			if (!accessToken) return null;
			await storage.set("accessToken", accessToken);
			return accessToken;
		} catch {
			return null;
		}
	}
}

export const authService = new AuthService();
