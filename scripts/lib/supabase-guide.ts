import { color } from "@astrojs/cli-kit";
import { note } from "@clack/prompts";

const SUPABASE_CONSOLE = "https://supabase.com/dashboard";

export const SUPABASE_REGIONS = [
	{
		value: "us-east-1",
		label: "US East (N. Virginia)",
		hint: "lowest latency for North America",
	},
	{ value: "us-east-2", label: "US East (Ohio)", hint: "alternate US East" },
	{
		value: "us-west-1",
		label: "US West (N. California)",
		hint: "US West Coast",
	},
	{ value: "eu-central-1", label: "EU Central (Frankfurt)", hint: "Europe" },
	{
		value: "eu-west-2",
		label: "EU West (London)",
		hint: "UK / Western Europe",
	},
	{
		value: "ap-southeast-1",
		label: "Asia Pacific (Singapore)",
		hint: "Southeast Asia",
	},
	{
		value: "ap-southeast-2",
		label: "Asia Pacific (Sydney)",
		hint: "Australia",
	},
] as const;

export function showOverview() {
	const dim = color.dim;
	const b = color.bold;
	const lines = [
		`${b("1.")} Open ${color.cyan(SUPABASE_CONSOLE)}`,
		`   ${dim("Sign in with GitHub, GitLab, or email — free tier is fine.")}`,
		"",
		`${b("2.")} Click ${b("New Project")} (or pick an existing one).`,
		`   ${dim('Project name: anything (e.g. "nabhya"). Set a database password and save it.')}`,
		"",
		`${b("3.")} Pick a ${b("region")} closest to you.`,
		`   ${dim("I'll ask which one in a moment so I can recommend the right value.")}`,
		"",
		`${b("4.")} After the project is created, you'll land on the dashboard.`,
		`   ${dim("Go to Project Settings → Database for connection strings, and Project Settings → API for the URL and anon key.")}`,
	];
	note(lines.join("\n"), "Supabase — create a project");
}

export function showRegionTip(region: string) {
	const match = SUPABASE_REGIONS.find((r) => r.value === region);
	if (!match) return;
	note(
		`${color.dim("Selected region:")} ${color.bold(match.label)}\n${color.dim("When creating the Supabase project, pick this same region from the dropdown.")}`,
		"Region",
	);
}

export function showConnectionStringGuide() {
	const b = color.bold;
	const dim = color.dim;
	const ok = color.green;
	const warn = color.yellow;

	const lines = [
		`In ${b("Project Settings → Database")} you'll see connection strings for a few modes.`,
		"",
		`${ok("●")} ${b("Transaction pooler (pgbouncer)")}  ${dim("→ goes in DATABASE_URL")}`,
		`   ${dim("Looks like:")} ${color.cyan("postgresql://postgres.")}${warn("<project-ref>")}${color.cyan(":****@aws-0-<region>.pooler.supabase.com:")}${warn("6543")}${color.cyan("/postgres")}`,
		`   ${dim("Port")} ${warn("6543")}${dim(". Used by the app at runtime (handles many concurrent connections).")}`,
		"",
		`${ok("●")} ${b("Direct connection")}   ${dim("→ goes in DIRECT_URL")}`,
		`   ${dim("Looks like:")} ${color.cyan("postgresql://postgres:****@db.")}${warn("<project-ref>")}${color.cyan(".supabase.co:")}${warn("5432")}${color.cyan("/postgres")}`,
		`   ${dim("Port")} ${warn("5432")}${dim(". Used by Drizzle Kit for push/generate (needs a stable single connection).")}`,
		"",
		`${b("In")} ${b("Project Settings → API")}${b(", also grab:")}`,
		`   ${dim("Project URL — used for EXPO_PUBLIC_SUPABASE_URL and to derive the JWKS endpoint.")}`,
		`   ${dim("anon / public key — used for EXPO_PUBLIC_SUPABASE_ANON_KEY.")}`,
		"",
		`${b("In")} ${b("Authentication → Sessions")}${b(", switch JWT signing keys to")} ${ok("asymmetric (ES256/RS256)")}`,
		`   ${dim("so the JWKS endpoint the server verifies against is populated. The legacy shared HS256 secret has no JWKS endpoint and isn't supported here.")}`,
		"",
		`${dim("Tip: copy each value with the clipboard icon next to the field.")}`,
	];
	note(lines.join("\n"), "Supabase — copy your credentials");
}

export function consoleUrl(): string {
	return SUPABASE_CONSOLE;
}
