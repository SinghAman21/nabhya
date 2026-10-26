import { useSegments } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";

/**
 * The browser tab's title, per route, on the web.
 *
 * Expo Router turns React Navigation's document-title handling off
 * (`documentTitle: { enabled: false }` in `ExpoRoot`) and leaves it to
 * `expo-router/head`, which nothing here used - so every page of the app, from
 * the sign-in form to an NGO's verification queue, sat in a tab reading the
 * same static name. With three tabs of the console open there was no telling
 * them apart, and a screen reader announced the same title on every
 * navigation.
 *
 * Keyed by segments *with* their groups, because the path alone collides:
 * `(admin)/index`, `(volunteer)/index` and the NGO wizard are all `/`. A detail page gets its noun ("Event", "NGO") rather than its
 * record's name - the name arrives with the data, after this runs - which is
 * still the difference between a tab you can find and one you cannot.
 */
const TITLES: Record<string, string> = {
	"": "Volunteering, without the back-and-forth",
	"(auth)/login": "Sign in",
	"(auth)/signup": "Create an account",
	"(auth)/forgot-password": "Reset your password",
	"(auth)/reset-password": "Choose a new password",
	"role-select": "Choose your account",
	"(onboarding)": "Register your NGO",
	"(onboarding)/volunteer": "Set up your profile",

	"(volunteer)": "Home",
	"(volunteer)/activity": "Activity",
	"(volunteer)/applications": "Your applications",
	"(volunteer)/giving": "Your giving",
	"(volunteer)/me": "Profile",

	"(ngo)/dashboard": "Dashboard",
	"(ngo)/feed": "Feed",
	"(ngo)/needs": "Needs",
	"(ngo)/my-events": "Events",
	"(ngo)/announcements": "Updates",
	"(ngo)/reviews": "Reviews",
	"(ngo)/donations": "Donations",
	"(ngo)/reports": "Reports",
	"(ngo)/team": "Team",
	"(ngo)/profile": "Profile",
	"(ngo)/edit": "Edit organisation",
	"(ngo)/verification": "Verification",

	"(admin)": "Overview",
	"(admin)/queue": "Review queue",
	"(admin)/organizations": "NGOs",
	"(admin)/volunteers": "Volunteers",
	"(admin)/audit": "Activity log",
	"(admin)/finance": "Finance",

	notifications: "Notifications",
	bookmarks: "Saved NGOs",
	saved: "Saved posts",
	following: "Following",
	impact: "Your impact",
	"edit-profile": "Edit profile",
	"verify-identity": "Verify your identity",
	search: "Search",
	events: "Events",
	"events/[id]": "Event",
	ngos: "NGOs",
	"ngos/[id]": "NGO",
	"needs/[id]": "Need",
	certificates: "Certificates",
	"certificates/[code]": "Certificate",
	"team/invites/[token]": "Team invite",
};

const APP_NAME = "Nabhya";

/** Mounted once, in the root layout. A no-op off the web. */
export function useDocumentTitle() {
	const segments = useSegments() as string[];
	// `index` is implicit in a segment list; drop it so `(admin)/index` and
	// `(admin)` are the same key.
	const key = segments.filter((segment) => segment !== "index").join("/");

	useEffect(() => {
		if (Platform.OS !== "web" || typeof document === "undefined") return;
		const page = TITLES[key];
		document.title = page ? `${page} · ${APP_NAME}` : APP_NAME;
	}, [key]);
}
