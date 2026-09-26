import Constants from "expo-constants";
import { Platform } from "react-native";

/** The API listens here; only the host ever changes between machines. */
const API_PORT = 3000;

/**
 * Dev fallback per platform: the Android emulator maps the host machine's
 * loopback to 10.0.2.2; localhost only works on iOS simulator / web.
 */
const devFallback = Platform.select({
	android: `http://10.0.2.2:${API_PORT}`,
	default: `http://localhost:${API_PORT}`,
});

/**
 * A tunnelled packager is not a host the API is also reachable on, so the
 * derivation below must not fire for one - `EXPO_PUBLIC_API_URL` is the only
 * answer in that case.
 */
const TUNNEL_HOST =
	/\.(exp\.direct|ngrok\.io|ngrok-free\.app|trycloudflare\.com)$/i;

/**
 * The host Metro is actually being served from, from the manifest.
 *
 * `Constants.expoConfig` is `ExpoConfig & { hostUri: string } | null`, and
 * `hostUri` is `host:port` (e.g. `192.168.0.101:8081`), so the port and any
 * trailing path are stripped. Null in a production build, which is why the
 * caller still requires the env var there.
 */
function packagerHost(): string | null {
	const hostUri = Constants.expoConfig?.hostUri;
	if (!hostUri) return null;

	const host = hostUri.split("/")[0]?.split(":")[0];
	if (!host || TUNNEL_HOST.test(host)) return null;

	// An Android emulator reaches the host machine at 10.0.2.2, never at its
	// own loopback - and Metro reports `localhost` there.
	if (
		Platform.OS === "android" &&
		(host === "localhost" || host === "127.0.0.1")
	) {
		return "10.0.2.2";
	}
	return host;
}

/**
 * Where the API lives.
 *
 * In development this **follows the packager** rather than being written down.
 * `EXPO_PUBLIC_API_URL` used to be the only source, which meant the machine's
 * LAN IP was hardcoded in `.env` and had to be kept in step with
 * `REACT_NATIVE_PACKAGER_HOSTNAME` in `.env.local` by hand. Every time the
 * network changed - a new router, a phone hotspot - the two drifted apart and
 * the app failed in the least diagnosable way available: Metro still served
 * the bundle, so the app booted and signed in normally, and only data requests
 * hung until the client's 30s timeout, twice over. "The feed says Building the
 * feed forever" is not a symptom anyone traces back to a stale env file.
 *
 * Deriving it from `hostUri` collapses that to one value. The packager host
 * has to be right for the app to load at all, so the API host cannot be stale
 * while everything else works; if it is wrong, nothing connects, which is an
 * obvious failure rather than a silent one.
 *
 * `EXPO_PUBLIC_API_URL` still wins when set, and is still required for
 * production builds, a tunnelled packager, or pointing a local client at a
 * deployed API.
 */
function resolveApiUrl(): string {
	const explicit = process.env.EXPO_PUBLIC_API_URL;
	const derived = __DEV__
		? (() => {
				const host = packagerHost();
				return host ? `http://${host}:${API_PORT}` : devFallback;
			})()
		: undefined;

	const resolvedUrl = explicit || derived;
	if (!resolvedUrl) {
		throw new Error("EXPO_PUBLIC_API_URL must be set in production builds");
	}

	return resolvedUrl.replace(/\/+$/, "").replace(/\/api$/, "");
}

export const API_URL = resolveApiUrl();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
if (!supabaseUrl) {
	throw new Error("EXPO_PUBLIC_SUPABASE_URL must be set for Supabase Auth");
}
export const SUPABASE_URL = supabaseUrl;

const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseAnonKey) {
	throw new Error(
		"EXPO_PUBLIC_SUPABASE_ANON_KEY must be set for Supabase Auth",
	);
}
export const SUPABASE_ANON_KEY = supabaseAnonKey;
