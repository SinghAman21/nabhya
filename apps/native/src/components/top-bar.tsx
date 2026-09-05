import { useRouter, useSegments } from "expo-router/build/hooks";
import {
	History,
	LogOut,
	Moon,
	Search,
	Sun,
	User,
	X,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Platform, TextInput, View } from "react-native";
import { ListRow } from "@/components/screen-shell";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption, Label } from "@/components/ui/typography";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useSignOut } from "@/hooks/use-auth";
import { useUnreadCount } from "@/hooks/use-engagement";
import { useTheme } from "@/hooks/use-theme";
import { focusable, focusWithin } from "@/lib/focus";
import { useAuthStore } from "@/store/auth-store";
import { useFeedStore } from "@/store/feed-store";

/**
 * Desktop chrome for a shallow, browse-shaped role.
 *
 * The volunteer side has three destinations and they are not peers: Discover *is*
 * the app, Activity is your own record of it, Profile is you. So there are no nav
 * links — the wordmark is home, search takes the middle, and the two personal
 * surfaces sit on the right where account controls are looked for.
 *
 * Roles with real depth keep the sidebar: `(ngo)` has nine grouped destinations,
 * `(admin)` five plus tables. No one person sees both chromes.
 *
 * Search lives here on desktop and in the page on mobile — one field either way,
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
	/** Where the wordmark goes — the default surface, so it needs no nav link. */
	home: string;
	activityHref: string;
	profileHref: string;
	/** Shows the search field. Only the feed consumes the term. */
	searchable?: boolean;
}) {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	// Typed routes make `useSegments()` a union of known segments, so `includes`
	// narrows its argument to `never`. The check here is a plain string compare.
	const segments = useSegments() as string[];

	return (
		<View
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
				style={(state) => ({
					opacity: (state as PressState).pressed ? 0.7 : 1,
				})}
			>
				<Label weight="bold" style={{ fontSize: 18 }}>
					nabhya
				</Label>
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
 * A bell would promise notifications, and this goes somewhere wider — pledges,
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
					height: 36,
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
			<Body weight={active ? "semibold" : "normal"} color="secondary">
				Activity
			</Body>
			{unread > 0 && (
				<View
					style={{
						minWidth: 18,
						height: 18,
						borderRadius: 9,
						paddingHorizontal: 5,
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: colors.primary.main,
					}}
				>
					<Caption
						weight="bold"
						color={colors.primary.contrast as string}
						style={{ fontSize: 10, lineHeight: 13 }}
					>
						{unread > 9 ? "9+" : unread}
					</Caption>
				</View>
			)}
		</Pressable>
	);
}

/* -------------------------------------------------------------------------- */
/* Search                                                                     */
/* -------------------------------------------------------------------------- */

function TopBarSearch() {
	const { colors, spacing, borderRadius } = useTheme();
	const search = useFeedStore((s) => s.search);
	const setSearch = useFeedStore((s) => s.setSearch);

	return (
		<View
			{...focusWithin}
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: spacing[2.5],
				width: "100%",
				maxWidth: 440,
				height: 38,
				paddingHorizontal: spacing[3.5],
				borderRadius: borderRadius.md,
				backgroundColor: colors.background.subtle,
			}}
		>
			<Search
				size={16}
				color={colors.text.quaternary as string}
				strokeWidth={1.9}
			/>
			<TextInput
				value={search}
				onChangeText={setSearch}
				placeholder="Search items, causes or NGOs"
				placeholderTextColor={colors.text.quaternary as string}
				autoCapitalize="none"
				returnKeyType="search"
				accessibilityLabel="Search posts"
				style={{
					flex: 1,
					fontFamily: "MonaSans",
					fontSize: 14,
					color: colors.text.primary as string,
					borderWidth: 0,
					paddingVertical: 0,
				}}
			/>
			{search.length > 0 && (
				<Pressable
					onPress={() => setSearch("")}
					accessibilityRole="button"
					accessibilityLabel="Clear search"
					hitSlop={10}
				>
					<X size={15} color={colors.text.tertiary as string} strokeWidth={2} />
				</Pressable>
			)}
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Account menu                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Where settings live on desktop — which is also what retires the floating theme
 * button for this role. A control hovering over every screen is not a setting, it
 * is a leftover.
 */
function AccountMenu({ profileHref }: { profileHref: string }) {
	const { colors, borderRadius, elevation, isDark } = useTheme();
	const { isDark: dark, toggleTheme } = useAppTheme();
	const router = useRouter();
	const user = useAuthStore((s) => s.user);
	const signOut = useSignOut();
	const [open, setOpen] = useState(false);
	// Viewport position of the trigger, so the panel can be portalled to
	// document.body on web and escape every ancestor stacking context.
	const [anchor, setAnchor] = useState({ x: 0, y: 0, width: 36, height: 36 });

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
						width: 36,
						height: 36,
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

	if (!open) return trigger;

	const panelStyle = {
		width: 248,
		backgroundColor: colors.background.card,
		borderRadius: borderRadius.lg,
		borderWidth: isDark ? 1 : 0,
		borderColor: colors.border.hairline,
		overflow: "hidden" as const,
		...(isDark ? {} : elevation.raised),
	};

	// Web: the inline panel loses the z-index fight with any later sibling that
	// paints its own stacking context (elevated cards, sticky rails). Portal to
	// document.body with `position: fixed` — above everything, always.
	if (Platform.OS === "web") {
		return (
			<>
				{trigger}
				{createPortal(
					<>
						<Pressable
							onPress={() => setOpen(false)}
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
							style={
								{
									position: "fixed",
									top: anchor.y + anchor.height + 8,
									left: Math.max(8, anchor.x + anchor.width - 248),
									zIndex: 9999,
									...panelStyle,
								} as never
							}
						>
							<MenuBody
								user={user}
								dark={dark}
								toggleTheme={toggleTheme}
								onClose={() => setOpen(false)}
								signOut={signOut}
								router={router}
								profileHref={profileHref}
							/>
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

			{/* Click-away, behind the panel. */}
			<Pressable
				onPress={() => setOpen(false)}
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
				style={{
					position: "absolute",
					top: 44,
					right: 0,
					zIndex: 50,
					...panelStyle,
				}}
			>
				<MenuBody
					user={user}
					dark={dark}
					toggleTheme={toggleTheme}
					onClose={() => setOpen(false)}
					signOut={signOut}
					router={router}
					profileHref={profileHref}
				/>
			</View>
		</View>
	);
}

/**
 * The menu's contents, shared by the inline (native) render and the
 * document.body portal (web).
 */
function MenuBody({
	user,
	dark,
	toggleTheme,
	onClose,
	signOut,
	router,
	profileHref,
}: {
	user: ReturnType<typeof useAuthStore.getState>["user"];
	dark: boolean;
	toggleTheme: () => void;
	onClose: () => void;
	signOut: ReturnType<typeof useSignOut>;
	router: ReturnType<typeof useRouter>;
	profileHref: string;
}) {
	const { colors, spacing } = useTheme();

	return (
		<>
			<View
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
				icon={dark ? Sun : Moon}
				label={dark ? "Light mode" : "Dark mode"}
				onPress={toggleTheme}
			/>
			<Divider />
			<ListRow
				icon={LogOut}
				label="Sign out"
				onPress={() => {
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
