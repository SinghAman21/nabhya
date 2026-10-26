import { check, sleep } from "k6";
import http from "k6/http";
import { Trend } from "k6/metrics";

const rawBaseUrl = __ENV.BASE_URL;

if (!rawBaseUrl) {
	throw new Error("BASE_URL is required (for example, http://localhost:3000).");
}

const baseUrl = rawBaseUrl.replace(/\/$/, "");
const feedResponseDuration = new Trend("feed_response_duration", true);

/**
 * Reads the server's ignored env file. Never commit test credentials.
 */
function readDotEnv(path) {
	const values = {};
	for (const sourceLine of open(path).split(/\r?\n/)) {
		const line = sourceLine.trim();
		if (!line || line.startsWith("#")) continue;
		const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
		if (!match) continue;
		const [, key, rawValue] = match;
		if (!key || rawValue === undefined) continue;
		values[key] = rawValue.trim().replace(/^("|')(.*)\1$/, "$2");
	}
	return values;
}

const serverEnv = readDotEnv("../../apps/server/.env");
const supabaseUrl = __ENV.SUPABASE_URL ?? serverEnv.SUPABASE_URL;
const supabaseAnonKey =
	__ENV.SUPABASE_ANON_KEY ??
	serverEnv.SUPABASE_ANON_KEY ??
	serverEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const testEmail = __ENV.K6_TEST_EMAIL ?? serverEnv.K6_TEST_EMAIL;
const testPassword = __ENV.K6_TEST_PASSWORD ?? serverEnv.K6_TEST_PASSWORD;

export const options = {
	summaryTrendStats: ["avg", "med", "p(95)", "p(99)", "max", "count"],
	scenarios: {
		feed_load: {
			executor: "ramping-vus",
			stages: [
				{ duration: "30s", target: 10 },
				{ duration: "2m", target: 20 },
				{ duration: "30s", target: 0 },
			],
		},
	},
	thresholds: {
		http_req_failed: ["rate<0.01"],
	},
};

export function setup() {
	if (__ENV.AUTH_TOKEN) return { accessToken: __ENV.AUTH_TOKEN };

	if (!supabaseUrl || !supabaseAnonKey || !testEmail || !testPassword) {
		throw new Error(
			"Set SUPABASE_ANON_KEY, K6_TEST_EMAIL, and K6_TEST_PASSWORD in apps/server/.env, or pass AUTH_TOKEN directly.",
		);
	}

	const response = http.post(
		`${supabaseUrl}/auth/v1/token?grant_type=password`,
		JSON.stringify({ email: testEmail, password: testPassword }),
		{
			headers: {
				apikey: supabaseAnonKey,
				"Content-Type": "application/json",
			},
			tags: { endpoint: "supabase-login" },
		},
	);

	if (response.status !== 200) {
		throw new Error(
			`Supabase test-account login failed with HTTP ${response.status}.`,
		);
	}

	const accessToken = response.json("access_token");
	if (typeof accessToken !== "string" || !accessToken) {
		throw new Error("Supabase login response did not include an access token.");
	}
	return { accessToken };
}

export default function ({ accessToken }) {
	const response = http.get(`${baseUrl}/api/feed/for-you?page=1&limit=10`, {
		headers: { Authorization: `Bearer ${accessToken}` },
		tags: { endpoint: "for-you-feed" },
	});

	// This endpoint-specific Trend is the number to use for résumé p95/p99 values.
	feedResponseDuration.add(response.timings.duration);

	check(response, {
		"for-you feed returns 200": (result) => result.status === 200,
	});

	// Prevents each virtual user from issuing requests as fast as its CPU allows.
	sleep(0.5);
}
