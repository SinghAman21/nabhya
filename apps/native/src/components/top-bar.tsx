import { useRouter, useSegments } from "expo-router/build/hooks";
import type { LucideIcon } from "lucide-react-native";
import { Award, History, LogOut, Sparkles, User } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { AppearanceMenu } from "@/components/appearance-menu";
import { APPEARANCE_LABEL, appearanceIcon } from "@/components/appearance-row";
import { InitialAvatar } from "@/components/initial-avatar";
import { Logo } from "@/components/logo";
import { SearchFloat } from "@/components/search-panel";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption, Label } from "@/components/ui/typography";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useSignOut } from "@/hooks/use-auth";
import { useUnreadCount } from "@/hooks/use-engagement";
import { useTheme } from "@/hooks/use-theme";
import { currentPage, focusable } from "@/lib/focus";
import { useAuthStore } from "@/store/auth-store";

/**
 * Desktop chrome for a shallow, browse-shaped role.
 *
 * The volunteer side has three destinations and they are not peers: Discover *is*
 * the app, Activity is your own record of it, Profile is you. So there are no nav
 * links - the wordmark is home, search takes the middle, and the two personal
 * surfaces sit on the right where account controls are looked for.
 *
 * Roles with real depth keep the sidebar: `(ngo)` has nine grouped destinations,
 * `(admin)` five plus tables. No one person sees both chromes.
 *
 * Search lives here on desktop and is its own route on mobile; on desktop it
 * is the field plus `SearchFloat`'s anchored panel. Both the panel and the
 * account menu hang below the bar, so the bar carries `zIndex` - it precedes
 * the page in the tree, and without it the page's own positioned children
 * would paint over anything that overflows the bar.
 */

export const TOP_BAR_HEIGHT = 60;
/** Feed layouts get the width; reading pages stay at `WebContent`'s 720. */
export const CONTENT_MAX_WIDTH = 1180;

type PressState = { pressed: boolean; focused?: boolean; hovered?: boolean };

export function TopBar({
	home,
	activityHref,
	profileHref,
	searchable = true,
}: {
	/** Where the wordmark goes - the default surface, so it needs no nav link. */
	home: string;
	activityHref: string;
	profileHref: string;
	/**
	 * Shows the search field. On by default now that it is a global search
	 * rather than a feed filter; hidden on `/search`, which is its own field.
	 */
	searchable?: boolean;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	const router = useRouter();
	// Typed routes make `useSegments()` a union of known segments, so `includes`
	// narrows its argument to `never`. The check here is a plain string compare.
	const segments = useSegments() as string[];

	return (
		<View
			accessibilityRole="header"
			style={{
				position: "relative",
				zIndex: 20,
				height: TOP_BAR_HEIGHT,
				flexDirection: "row",
				alignItems: "center",
				gap: spacing[4],
				paddingHorizontal: spacing[6],
				backgroundColor: colors.background.card,
				borderBottomWidth: 1,
				borderBottomColor: colors.border.hairline,
			}}
		>
			<Pressable
				onPress={() => router.push(home as never)}
				accessibilityRole="link"
				accessibilityLabel="nabhya, home"
				{...focusable}
				style={(state) => {
					const { pressed, hovered } = state as PressState;
					return {
						minHeight: 40,
						justifyContent: "center",
						paddingHorizontal: spacing[2],
						marginLeft: -spacing[2],
						borderRadius: borderRadius.sm,
						backgroundColor:
							pressed || hovered ? colors.background.subtle : "transparent",
					};
				}}
			>
				<Logo size={22} label={null} />
			</Pressable>

			<View style={{ flex: 1, alignItems: "center" }}>
				{searchable && !segments.includes("search") && <TopBarSearch />}
			</View>

			<ActivityButton
				active={segments.includes("activity")}
				onPress={() => router.push(activityHref as never)}
			/>
			<AccountMenu profileHref={profileHref} />
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Activity                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Labelled, not a bare bell.
 *
 * A bell would promise notifications, and this goes somewhere wider - pledges,
 * donations, applications, certificates and alerts in one timeline. It is also the
 * only notifications entry point on desktop: a bell popover beside it would be a
 * second door into a page that already exists.
 */
function ActivityButton({
	active,
	onPress,
}: {
	active: boolean;
	onPress: () => void;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	const email = useAuthStore((s) => s.email);
	const { data } = useUnreadCount(!!email);
	const unread = data?.unreadCount ?? 0;

	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="link"
			accessibilityLabel={
				unread > 0 ? `Activity, ${unread} unread` : "Activity"
			}
			accessibilityState={{ selected: active }}
			{...currentPage(active)}
			{...focusable}
			style={(state) => {
				const { pressed, hovered } = state as PressState;
				return {
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[2],
					height: 40,
					paddingHorizontal: spacing[3],
					borderRadius: borderRadius.sm,
					backgroundColor:
						active || pressed || hovered
							? colors.background.subtle
							: "transparent",
				};
			}}
		>
			<History
				size={17}
				strokeWidth={1.9}
				color={
					active
						? (colors.text.primary as string)
						: (colors.text.tertiary as string)
				}
			/>
			<Body
				weight={active ? "semibold" : "normal"}
				color={active ? "primary" : "secondary"}
			>
				Activity
			</Body>
			{unread > 0 && <UnreadBadge count={unread} />}
		</Pressable>
	);
}

/** Ink on the brand tint: readable, and quieter than a filled orange dot. */
function UnreadBadge({ count }: { count: number }) {
	const { colors, spacing } = useTheme();
	return (
		<View
			style={{
				minWidth: 20,
				height: 20,
				borderRadius: 10,
				paddingHorizontal: spacing[1.5],
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: colors.primary.tint,
			}}
		>
			<Caption weight="bold" color={colors.primary.ink}>
				{count > 99 ? "99+" : count}
			</Caption>
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Search                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A global search, not a feed filter. It used to write the feed store's term,
 * so typing here quietly narrowed the Home feed under the field - on every
 * other page it did nothing at all. It now drops `SearchFloat`'s panel
 * (recent, suggestions, live results by kind) and Enter opens `/search`.
 * 440 and 40pt: the field shares a 60pt row with the wordmark and the
 * account controls, so it is chrome rather than page content.
 */
function TopBarSearch() {
	return (
		<SearchFloat
			placeholder="Search NGOs, needs, events"
			maxWidth={440}
			compact
		/>
	);
}

/* -------------------------------------------------------------------------- */
/* Account menu                                                               */
/* -------------------------------------------------------------------------- */

const MENU_WIDTH = 264;

/**
 * Where the account lives on desktop: who you are, your three personal pages,
 * Appearance, and Sign out.
 *
 * **Inline, not portalled.** It used to `createPortal` into `document.body`
 * to win a z-index fight with later siblings; the bar itself now carries the
 * `zIndex` (see `TopBar`), so an absolutely positioned panel under the
 * trigger clears the page without leaving the React tree - which is also what
 * lets the outside-press check below be a plain `contains`.
 *
 * Appearance is `AppearanceMenu`, opening to the left of its row: the three
 * options next to the control that asked, instead of a centred dialog over
 * the window. Picking one closes both menus; its Escape closes only itself.
 */
function AccountMenu({ profileHref }: { profileHref: string }) {
	const { colors, spacing, borderRadius, elevation, isDark } = useTheme();
	const user = useAuthStore((s) => s.user);
	const [open, setOpen] = useState(false);
	const containerRef = useRef<View>(null);
	const triggerRef = useRef<View>(null);

	const close = useCallback((refocus?: boolean) => {
		setOpen(false);
		if (refocus) {
			(triggerRef.current as unknown as HTMLElement | null)?.focus?.();
		}
	}, []);

	/*
	 * A menu closes on Escape and hands focus back to the button that opened
	 * it, and closes on a press or focus outside it.
	 */
	useEffect(() => {
		if (!open || Platform.OS !== "web" || typeof document === "undefined") {
			return;
		}
		const node = containerRef.current as unknown as HTMLElement | null;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") close(true);
		};
		const outside = (event: Event) => {
			if (node && !node.contains(event.target as Node)) close();
		};
		window.addEventListener("keydown", onKey);
		document.addEventListener("mousedown", outside);
		document.addEventListener("focusin", outside);
		return () => {
			window.removeEventListener("keydown", onKey);
			document.removeEventListener("mousedown", outside);
			document.removeEventListener("focusin", outside);
		};
	}, [open, close]);

	const name = user?.name ?? user?.email ?? "Volunteer";

	return (
		<View ref={containerRef} style={{ position: "relative" }}>
			<Pressable
				ref={triggerRef}
				onPress={() => setOpen((value) => !value)}
				accessibilityRole="button"
				accessibilityLabel="Account menu"
				accessibilityState={{ expanded: open }}
				{...focusable}
				style={(state) => {
					const { pressed, hovered } = state as PressState;
					return {
						width: 40,
						height: 40,
						borderRadius: 999,
						alignItems: "center",
						justifyContent: "center",
						backgroundColor:
							open || pressed || hovered
								? colors.background.subtle
								: "transparent",
					};
				}}
			>
				<InitialAvatar name={name} size={32} />
			</Pressable>

			{open && (
				<View
					accessibilityRole="menu"
					style={{
						position: "absolute",
						top: 40 + spacing[2],
						right: 0,
						zIndex: 100,
						width: MENU_WIDTH,
						padding: spacing[1.5],
						backgroundColor: colors.background.card,
						borderRadius: borderRadius.lg,
						borderWidth: isDark ? 1 : 0,
						borderColor: colors.border.hairline,
						...(isDark ? {} : elevation.raised),
					}}
				>
					<MenuBody profileHref={profileHref} onClose={() => close()} />
				</View>
			)}
		</View>
	);
}

function MenuBody({
	profileHref,
	onClose,
}: {
	profileHref: string;
	onClose: () => void;
}) {
	const { spacing } = useTheme();
	const { preference } = useAppTheme();
	const router = useRouter();
	const user = useAuthStore((s) => s.user);
	const signOut = useSignOut();
	const name = user?.name ?? "Volunteer";

	const go = (href: string) => {
		onClose();
		router.push(href as never);
	};

	return (
		<>
			<View
				accessible
				accessibilityLabel={`Signed in as ${name}${user?.email ? `, ${user.email}` : ""}`}
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[3],
					paddingHorizontal: spacing[2.5],
					paddingTop: spacing[2],
					paddingBottom: spacing[3],
				}}
			>
				<InitialAvatar name={user?.name ?? user?.email} size={36} />
				<View style={{ flex: 1, minWidth: 0 }}>
					<Label weight="semibold" numberOfLines={1}>
						{name}
					</Label>
					{user?.email ? (
						<Caption color="tertiary" numberOfLines={1}>
							{user.email}
						</Caption>
					) : null}
				</View>
			</View>
			<Divider />
			<MenuItem icon={User} label="Profile" onPress={() => go(profileHref)} />
			<MenuItem icon={Sparkles} label="Impact" onPress={() => go("/impact")} />
			<MenuItem
				icon={Award}
				label="Certificates"
				onPress={() => go("/certificates")}
			/>
			<Divider />
			<AppearanceMenu placement="left-start" onPicked={onClose}>
				{({ open, toggle }) => (
					<MenuItem
						icon={appearanceIcon(preference)}
						label="Appearance"
						value={APPEARANCE_LABEL[preference]}
						expanded={open}
						onPress={toggle}
					/>
				)}
			</AppearanceMenu>
			<Divider />
			<MenuItem
				icon={LogOut}
				label={signOut.isPending ? "Signing out..." : "Sign out"}
				disabled={signOut.isPending}
				onPress={() => {
					onClose();
					signOut.mutate();
				}}
			/>
		</>
	);
}

/** A 40pt menu row: icon, label, an optional current value at the end. */
function MenuItem({
	icon: Icon,
	label,
	value,
	disabled,
	expanded,
	onPress,
}: {
	icon: LucideIcon;
	label: string;
	value?: string;
	disabled?: boolean;
	/** For a row that opens a submenu. */
	expanded?: boolean;
	onPress: () => void;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			accessibilityRole="menuitem"
			accessibilityLabel={value ? `${label}, ${value}` : label}
			accessibilityState={{
				disabled: !!disabled,
				...(expanded === undefined ? {} : { expanded }),
			}}
			{...focusable}
			style={(state) => {
				const { pressed, hovered } = state as PressState;
				return {
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[3],
					minHeight: 40,
					paddingHorizontal: spacing[2.5],
					borderRadius: borderRadius.md,
					opacity: disabled ? 0.6 : 1,
					backgroundColor:
						expanded || pressed || hovered
							? colors.background.subtle
							: "transparent",
				};
			}}
		>
			<Icon
				size={17}
				strokeWidth={1.9}
				color={colors.text.tertiary as string}
			/>
			<Body style={{ flex: 1 }} numberOfLines={1}>
				{label}
			</Body>
			{value ? <Caption color="quaternary">{value}</Caption> : null}
		</Pressable>
	);
}

function Divider() {
	const { colors, spacing } = useTheme();
	return (
		<View
			style={{
				height: 1,
				marginVertical: spacing[1],
				marginHorizontal: spacing[2.5],
				backgroundColor: colors.border.hairline,
			}}
		/>
	);
}

/* -------------------------------------------------------------------------- */
/* Content                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Centres and caps the page under a top bar.
 *
 * `minHeight: 0` on both links of the chain, for the reason in AGENTS.md ->
 * "A flex chain that never reaches the viewport": a flex item is floored at
 * its content height, so without it a tall page grew this box past the window
 * and its `ScrollView` had nothing to scroll. `AppShell`'s rail branch already
 * did this; the volunteer branch did not.
 */
export function TopBarContent({ children }: { children: React.ReactNode }) {
	return (
		<View style={{ flex: 1, minHeight: 0, alignItems: "center" }}>
			<View
				style={{
					flex: 1,
					minHeight: 0,
					width: "100%",
					maxWidth: CONTENT_MAX_WIDTH,
				}}
			>
				{children}
			</View>
		</View>
	);
}
