import { Platform, View, type ViewStyle } from "react-native";
import { ADMIN_NAV_ITEMS, NGO_NAV_ITEMS } from "@/components/nav-items";
import { ShellFrameContext } from "@/components/screen-shell";
import { Sidebar } from "@/components/sidebar";
import { TopBar, TopBarContent } from "@/components/top-bar";
import { useMyOrganization } from "@/hooks/use-organization";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { useAuthStore } from "@/store/auth-store";

/**
 * The role's desktop chrome, around a screen that is not inside its role group.
 *
 * `(ngo)`, `(volunteer)` and `(admin)` each draw their own chrome in their
 * layout, so every screen inside them has a rail or a top bar on the web. The
 * shared screens do not live in any of those groups - `notifications`,
 * `bookmarks`, `impact`, `edit-profile`, `verify-identity`, `search` and the
 * public `ngos` / `events` / `certificates` stacks all sit on the root stack,
 * because a volunteer, a coordinator, an admin and a signed-out visitor can all
 * reach them. On the web that meant they opened as a bare page: no rail, no top
 * bar, nothing but the content, so following a link out of the sidebar
 * effectively left the app.
 *
 * This puts the chrome back without moving any route. Mobile passes straight
 * through - these are pushed pages, and a pushed page correctly has no tab bar.
 *
 * A signed-out visitor on a public page gets the capped column and no rail,
 * which is the honest answer: there is no navigation to offer them yet.
 *
 * ## Width
 *
 * The shell publishes which chrome it drew through `ShellFrameContext`, and
 * `Screen` (screen-shell.tsx) sizes the page from it - so the rule lives in
 * one place instead of in each screen's `style`:
 *
 * - **Rail** (`organisation`, `superadmin`): the content area runs from the
 *   rail to the window edge with no cap of its own, and the page inside it is
 *   left-aligned at `SHELL_PAGE_MAX_WIDTH` (1040; 760 for `measure="reading"`)
 *   one gutter from the rail. It was a 720 column centred in a 1440 box, which
 *   floated a narrow card mid-window with dead space either side of it.
 * - **Top bar** (`volunteer`): the same 1180 frame `(volunteer)/_layout.tsx`
 *   uses, with the page centred in it - there is no rail to align to.
 * - **Signed out**: the top-bar frame, without the bar.
 *
 * Pages that are rail / top-bar destinations also drop their back chevron on
 * desktop; that rule is `NAV_DESTINATIONS` in `back-button.tsx`.
 */

/** Matches `(ngo)/_layout.tsx` - see the note there on why this is capped. */
const CONTENT_MAX_WIDTH = 1440;

/**
 * A hard height for the desktop shell, for the reason spelled out in
 * `(ngo)/_layout.tsx`: every scroll region's height comes from a chain of
 * `flex: 1` ancestors, and on the web one link resolving to content height
 * silently makes the page unscrollable. `dvh` so a mobile browser's collapsing
 * toolbar cannot hide the bottom of the pane.
 */
const SHELL_HEIGHT: ViewStyle =
	Platform.OS === "web" ? ({ height: "100dvh" } as unknown as ViewStyle) : {};

export function AppShell({ children }: { children: React.ReactNode }) {
	const { colors } = useTheme();
	const { isDesktop } = useMedia();
	const role = useAuthStore((s) => s.role);

	const isOrg = role === "organisation";
	// The rail's brand line. Fetched only when it will actually be drawn - the
	// query key is shared with every other caller, so this is a cache read on
	// all but the first shared screen of a session.
	const { data: org } = useMyOrganization(isDesktop && isOrg);

	if (!isDesktop) return <>{children}</>;

	/*
	 * Volunteers get the top bar, not a rail: three destinations do not need
	 * one, and it is the chrome `(volunteer)/_layout.tsx` gives them. Search is
	 * off here - only the feed consumes the term, and `app/search.tsx` is its
	 * own field.
	 */
	if (role === "volunteer") {
		return (
			<View
				style={{
					flex: 1,
					...SHELL_HEIGHT,
					backgroundColor: colors.background.warm,
				}}
			>
				<TopBar
					home="/(volunteer)"
					activityHref="/(volunteer)/activity"
					profileHref="/(volunteer)/me"
				/>
				<ShellFrameContext.Provider value="topbar">
					<TopBarContent>{children}</TopBarContent>
				</ShellFrameContext.Provider>
			</View>
		);
	}

	const navItems = isOrg
		? NGO_NAV_ITEMS
		: role === "superadmin"
			? ADMIN_NAV_ITEMS
			: null;

	if (!navItems) {
		// Signed out: no chrome to offer, so the top bar's frame without the bar.
		return (
			<View
				style={{
					flex: 1,
					...SHELL_HEIGHT,
					backgroundColor: colors.background.warm,
				}}
			>
				<ShellFrameContext.Provider value="topbar">
					<TopBarContent>{children}</TopBarContent>
				</ShellFrameContext.Provider>
			</View>
		);
	}

	return (
		<View
			style={{
				flex: 1,
				...SHELL_HEIGHT,
				flexDirection: "row",
				backgroundColor: colors.background.warm,
			}}
		>
			<Sidebar
				navItems={navItems}
				brandTitle={isOrg ? org?.organizationName : undefined}
			/>
			<View
				style={{
					flex: 1,
					minWidth: 0,
					// Without this a flex item is floored at its content height,
					// which is the other half of the unscrollable-page problem.
					minHeight: 0,
					// Left-aligned, not centred: `Screen` caps the page at
					// SHELL_PAGE_MAX_WIDTH and pins it one gutter from the rail. A
					// centred box put the page's left edge wherever the window width
					// happened to leave it. The 1440 cap stays for screens that draw
					// without `Screen` (the hero detail pages).
					maxWidth: CONTENT_MAX_WIDTH,
				}}
			>
				<ShellFrameContext.Provider value="rail">
					{children}
				</ShellFrameContext.Provider>
			</View>
		</View>
	);
}

/**
 * `AppShell` as a wrapper around a route's default export.
 *
 * Applied at the export rather than inside the JSX on purpose: most of these
 * screens return early for their loading and error states, and a wrapper in the
 * markup would have to be repeated in each branch - one of which would
 * eventually be missed, giving a page that loses its sidebar for as long as it
 * is loading.
 */
export function withAppShell<P extends object>(Page: React.ComponentType<P>) {
	function Shelled(props: P) {
		return (
			<AppShell>
				<Page {...props} />
			</AppShell>
		);
	}

	Shelled.displayName = `withAppShell(${Page.displayName ?? Page.name ?? "Page"})`;
	return Shelled;
}
