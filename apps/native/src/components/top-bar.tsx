import { useRouter, useSegments } from "expo-router/build/hooks";
import { History, LogOut, User } from "lucide-react-native";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Platform, View } from "react-native";
import {
	APPEARANCE_LABEL,
	AppearanceSheet,
	appearanceIcon,
} from "@/components/appearance-row";
import { ListRow } from "@/components/screen-shell";
import { SearchField } from "@/components/search-field";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption, H5, Label } from "@/components/ui/typography";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useSignOut } from "@/hooks/use-auth";
import { useUnreadCount } from "@/hooks/use-engagement";
import { useTheme } from "@/hooks/use-theme";
import { focusable } from "@/lib/focus";
import { useAuthStore } from "@/store/auth-store";
import { useFeedStore } from "@/store/feed-store";

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
 * Search lives here on desktop and in the page on mobile - one field either way,
 * reading the same store, so a filtered feed can never disagree with the input
 * the user can see.
 */

export const TOP_BAR_HEIGHT = 60;
/** Feed layouts get the width; reading pages stay at `WebContent`'s 720. */
export const CONTENT_MAX_WIDTH = 1180;

type PressState = { pressed: boolean; focused?: boolean; hovered?: boolean };

export function TopBar({
	home,
	activityHref,
	profileHref,
	searchable,
}: {
	/** Where the wordmark goes - the default surface, so it needs no nav link. */
	home: string;
	activityHref: string;
	profileHref: string;
	/** Shows the search field. Only the feed consumes the term. */
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
				<H5>nabhya</H5>
			</Pressable>

			<View style={{ flex: 1, alignItems: "center" }}>
				{searchable && <TopBarSearch />}
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

function TopBarSearch() {
	const search = useFeedStore((s) => s.search);
	const setSearch = useFeedStore((s) => s.setSearch);

	// 440 and 40pt: the bar is 60 tall and the field shares the row with the
	// wordmark and the account controls, so it is the one search in the app that
	// is chrome rather than page content.
	return (
		<SearchField
			value={search}
			onChange={setSearch}
			placeholder="Search items, causes or NGOs"
			maxWidth={440}
			compact
		/>
	);
}

/* -------------------------------------------------------------------------- */
/* Account menu                                                               */
/* -------------------------------------------------------------------------- */

const MENU_WIDTH = 248;

/**
 * Where settings live on desktop. Appearance opens the same three-way sheet
 * every other surface uses, so a person who switches between phone and laptop
 * meets one control, not two.
 */
function AccountMenu({ profileHref }: { profileHref: string }) {
	const { colors, borderRadius, elevation, isDark } = useTheme();
	const user = useAuthStore((s) => s.user);
	const [open, setOpen] = useState(false);
	const [appearanceOpen, setAppearanceOpen] = useState(false);
	// Viewport position of the trigger, so the panel can be portalled to
	// document.body on web and escape every ancestor stacking context.
	const [anchor, setAnchor] = useState({ x: 0, y: 0, width: 40, height: 40 });

	const initials = useMemo(() => {
		if (!user?.name) return user?.email?.charAt(0).toUpperCase() ?? "?";
		return user.name
			.split(" ")
			.map((part) => part[0])
			.join("")
			.toUpperCase()
			.slice(0, 2);
	}, [user?.name, user?.email]);

	const trigger = (
		<View
			onLayout={(event) => setAnchor(event.nativeEvent.layout)}
			collapsable={false}
		>
			<Pressable
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
						borderRadius: borderRadius.sm,
						alignItems: "center",
						justifyContent: "center",
						backgroundColor:
							open || pressed || hovered
								? colors.background.subtle
								: colors.background.tertiary,
					};
				}}
			>
				<Caption weight="bold">{initials}</Caption>
			</Pressable>
		</View>
	);

	const sheet = (
		<AppearanceSheet
			visible={appearanceOpen}
			onClose={() => setAppearanceOpen(false)}
		/>
	);

	const body = (
		<MenuBody
			profileHref={profileHref}
			onClose={() => setOpen(false)}
			onAppearance={() => {
				setOpen(false);
				setAppearanceOpen(true);
			}}
		/>
	);

	if (!open) {
		return (
			<>
				{trigger}
				{sheet}
			</>
		);
	}

	const panelStyle = {
		width: MENU_WIDTH,
		backgroundColor: colors.background.card,
		borderRadius: borderRadius.lg,
		borderWidth: isDark ? 1 : 0,
		borderColor: colors.border.hairline,
		overflow: "hidden" as const,
		...(isDark ? {} : elevation.raised),
	};

	// Web: the inline panel loses the z-index fight with any later sibling that
	// paints its own stacking context (elevated cards, sticky rails). Portal to
	// document.body with `position: fixed` - above everything, always.
	if (Platform.OS === "web") {
		return (
			<>
				{trigger}
				{sheet}
				{createPortal(
					<>
						<Pressable
							onPress={() => setOpen(false)}
							accessibilityRole="button"
							accessibilityLabel="Close account menu"
							style={
								{
									position: "fixed",
									inset: 0,
									zIndex: 9990,
								} as never
							}
						/>
						<View
							accessibilityRole="menu"
							style={
								{
									position: "fixed",
									top: anchor.y + anchor.height + 8,
									left: Math.max(8, anchor.x + anchor.width - MENU_WIDTH),
									zIndex: 9999,
									...panelStyle,
								} as never
							}
						>
							{body}
						</View>
					</>,
					document.body,
				)}
			</>
		);
	}

	return (
		<View>
			{trigger}
			{sheet}

			{/* Click-away, behind the panel. */}
			<Pressable
				onPress={() => setOpen(false)}
				accessibilityRole="button"
				accessibilityLabel="Close account menu"
				style={{
					position: "absolute",
					top: -2000,
					left: -2000,
					right: -2000,
					bottom: -2000,
					zIndex: 40,
				}}
			/>

			<View
				accessibilityRole="menu"
				style={{
					position: "absolute",
					top: 48,
					right: 0,
					zIndex: 50,
					...panelStyle,
				}}
			>
				{body}
			</View>
		</View>
	);
}

/**
 * The menu's contents, shared by the inline (native) render and the
 * document.body portal (web).
 */
function MenuBody({
	profileHref,
	onClose,
	onAppearance,
}: {
	profileHref: string;
	onClose: () => void;
	onAppearance: () => void;
}) {
	const { colors, spacing } = useTheme();
	const { preference } = useAppTheme();
	const router = useRouter();
	const user = useAuthStore((s) => s.user);
	const signOut = useSignOut();

	return (
		<>
			<View
				accessible
				accessibilityRole="text"
				style={{
					paddingHorizontal: spacing[4],
					paddingVertical: spacing[3],
					borderBottomWidth: 1,
					borderBottomColor: colors.border.hairline,
				}}
			>
				<Label weight="semibold" numberOfLines={1}>
					{user?.name ?? "Volunteer"}
				</Label>
				<Caption color="quaternary" numberOfLines={1}>
					{user?.email ?? ""}
				</Caption>
			</View>

			<ListRow
				icon={User}
				label="Profile"
				onPress={() => {
					onClose();
					router.push(profileHref as never);
				}}
			/>
			<Divider />
			<ListRow
				icon={appearanceIcon(preference)}
				label="Appearance"
				value={
					<Caption color="tertiary">{APPEARANCE_LABEL[preference]}</Caption>
				}
				onPress={onAppearance}
			/>
			<Divider />
			<ListRow
				icon={LogOut}
				label="Sign out"
				value={<View />}
				onPress={() => {
					if (signOut.isPending) return;
					onClose();
					signOut.mutate();
				}}
			/>
		</>
	);
}

function Divider() {
	const { colors, spacing } = useTheme();
	return (
		<View
			style={{
				height: 1,
				marginLeft: spacing[4],
				backgroundColor: colors.border.hairline,
			}}
		/>
	);
}

/* -------------------------------------------------------------------------- */
/* Content                                                                    */
/* -------------------------------------------------------------------------- */

/** Centres and caps the page under a top bar. */
export function TopBarContent({ children }: { children: React.ReactNode }) {
	return (
		<View style={{ flex: 1, alignItems: "center" }}>
			<View style={{ flex: 1, width: "100%", maxWidth: CONTENT_MAX_WIDTH }}>
				{children}
			</View>
		</View>
	);
}
