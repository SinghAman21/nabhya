import { useRouter, useSegments } from "expo-router";
import type { LucideIcon } from "lucide-react-native";
import {
	LogOut,
	Menu,
	Moon,
	PanelLeftClose,
	PanelLeftOpen,
	Sun,
	X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Body, Caption, H5, Label } from "@/components/ui/typography";
import { useSignOut } from "@/hooks/use-auth";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useMedia } from "@/hooks/useMedia";
import { useTheme } from "@/hooks/useTheme";
import { focusable } from "@/lib/focus";
import { storage } from "@/lib/storage";
import { useAuthStore } from "@/store/auth-store";

/**
 * Desktop rail / mobile drawer.
 *
 * Monochrome by design: the active row is an ink label on a subtle fill, not an
 * orange-tinted pill with an orange icon. Navigation is not an action, and
 * spending the brand colour on whichever row you happen to be looking at left
 * the actual actions on the page with nothing louder to say.
 *
 * The rail collapses to icons. Collapsing animates **one** value — the width —
 * and everything else derives from it by interpolation, so there is no second
 * timeline to fall out of step with the first. The row tree is identical in both
 * states: labels are clipped by the container rather than unmounted, which is
 * what keeps the transition seamless instead of a layout swap mid-animation.
 */

export interface NavItem {
	label: string;
	href: string;
	icon: LucideIcon;
	/** Optional group heading. Items sharing the same section are rendered together. */
	section?: string;
}

const EXPANDED_WIDTH = 264;
/*
 * Collapsed-rail geometry. These are one equation and change together:
 *
 *   ROW_MARGIN + ROW_INSET + ICON_SIZE/2  ==  COLLAPSED_WIDTH / 2   (icon centred)
 *   ROW_INSET + ICON_SIZE + ICON_GAP      <=  COLLAPSED_WIDTH - 2*ROW_MARGIN
 *
 * The second line is the one that bites. The row is `icon, gap, label(flex:1)`
 * and an icon does not shrink — RN defaults `flexShrink` to 0, unlike the web —
 * so when inset + icon + gap + paddingRight came to 63px inside a 56px row, the
 * row was over-constrained by 7px and Yoga resolved that overflow on every frame
 * of the collapse.
 *
 * The fix is arithmetic, not a conditional: the row carries no `paddingRight`
 * (the label does, so it can shrink to nothing), and the gap is small enough to
 * fit. Do **not** make the gap depend on `collapsed` — the flag flips instantly
 * while the width takes 260ms, so the row would jump halfway through.
 */
const COLLAPSED_WIDTH = 68;
const ROW_MARGIN = 8;
const ROW_INSET = 15;
const ICON_SIZE = 22;
const ICON_GAP = 10;
const DRAWER_WIDTH = 288;

const NO_SECTION = "__default__";
const COLLAPSE_KEY = "nabhya-sidebar-collapsed";

/** react-native-web reports `focused`/`hovered` here; native only sets `pressed`. */
type PressState = { pressed: boolean; focused?: boolean; hovered?: boolean };

function isActive(navHref: string, currentSegments: string[]): boolean {
	const navSegments = navHref.split("/").filter(Boolean);
	if (navSegments.length === 1) {
		return (
			currentSegments.length === 1 && currentSegments[0] === navSegments[0]
		);
	}
	if (currentSegments.length < navSegments.length) return false;
	for (let i = 0; i < navSegments.length; i++) {
		if (currentSegments[i] !== navSegments[i]) return false;
	}
	return true;
}

function groupBySection(navItems: NavItem[]) {
	const order: string[] = [];
	const map = new Map<string, NavItem[]>();
	for (const item of navItems) {
		const key = item.section ?? NO_SECTION;
		if (!map.has(key)) {
			map.set(key, []);
			order.push(key);
		}
		map.get(key)?.push(item);
	}
	return order.map((key) => ({
		section: key === NO_SECTION ? undefined : key,
		items: map.get(key) ?? [],
	}));
}

/* -------------------------------------------------------------------------- */
/* Nav item row                                                               */
/* -------------------------------------------------------------------------- */

function NavItemRow({
	item,
	segments,
	onPress,
	labelOpacity,
	collapsed,
}: {
	item: NavItem;
	segments: string[];
	onPress: () => void;
	collapsed: boolean;
	/** 1 when expanded, 0 when collapsed. Null in the drawer, which never collapses. */
	labelOpacity?: Animated.AnimatedInterpolation<number>;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	const Icon = item.icon;
	const active = isActive(item.href, segments);

	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="link"
			accessibilityLabel={item.label}
			accessibilityState={{ selected: active }}
			{...focusable}
			style={(state) => {
				const { pressed, hovered } = state as PressState;
				return {
					flexDirection: "row",
					alignItems: "center",
					gap: collapsed ? 0 : ICON_GAP,
					marginHorizontal: ROW_MARGIN,
					marginVertical: 1,
					paddingVertical: spacing[3],
					paddingLeft: ROW_INSET,
					borderRadius: borderRadius.md,
					backgroundColor: active
						? colors.background.subtle
						: pressed || hovered
							? colors.background.secondary
							: "transparent",
				};
			}}
		>
			<Icon
				size={ICON_SIZE}
				strokeWidth={active ? 2.2 : 1.9}
				color={
					active
						? (colors.text.primary as string)
						: (colors.text.tertiary as string)
				}
			/>
			<Animated.View
				style={{
					flex: 1,
					// The row has no right padding: this carries it, so it can shrink
					// to nothing instead of reserving space in a 68px rail.
					paddingRight: spacing[3],
					...(labelOpacity ? { opacity: labelOpacity } : null),
				}}
			>
				<Body
					weight={active ? "semibold" : "normal"}
					color={active ? "primary" : "secondary"}
					numberOfLines={1}
				>
					{item.label}
				</Body>
			</Animated.View>
		</Pressable>
	);
}

/* -------------------------------------------------------------------------- */
/* Section heading                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Expanded, a group is named. Collapsed, the name would be a truncated word, so
 * it cross-fades into a hairline: the grouping survives the collapse, the label
 * does not.
 */
function SectionHeading({
	label,
	first,
	labelOpacity,
	railOpacity,
}: {
	label?: string;
	first: boolean;
	labelOpacity?: Animated.AnimatedInterpolation<number>;
	railOpacity?: Animated.AnimatedInterpolation<number>;
}) {
	const { colors, spacing } = useTheme();

	if (!label) {
		return <View style={{ height: first ? spacing[2] : spacing[4] }} />;
	}

	return (
		<View
			style={{
				height: 34,
				justifyContent: "center",
				marginTop: first ? spacing[2] : spacing[3],
			}}
		>
			<Animated.View
				style={{
					paddingHorizontal: ROW_MARGIN + ROW_INSET,
					...(labelOpacity ? { opacity: labelOpacity } : null),
				}}
			>
				<Caption color="quaternary" numberOfLines={1}>
					{label}
				</Caption>
			</Animated.View>
			{railOpacity && (
				<Animated.View
					pointerEvents="none"
					style={{
						position: "absolute",
						left: spacing[5],
						right: spacing[5],
						height: 1,
						backgroundColor: colors.border.hairline,
						opacity: railOpacity,
					}}
				/>
			)}
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Icon button                                                                */
/* -------------------------------------------------------------------------- */

function IconButton({
	icon: Icon,
	label,
	onPress,
	role = "button",
	checked,
	expanded,
}: {
	icon: LucideIcon;
	label: string;
	onPress: () => void;
	role?: "button" | "switch";
	checked?: boolean;
	expanded?: boolean;
}) {
	const { colors, borderRadius } = useTheme();

	return (
		<Pressable
			onPress={onPress}
			accessibilityRole={role}
			accessibilityLabel={label}
			{...(role === "switch" ? { accessibilityState: { checked } } : {})}
			{...(expanded === undefined ? {} : { accessibilityState: { expanded } })}
			hitSlop={6}
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
						pressed || hovered ? colors.background.subtle : "transparent",
				};
			}}
		>
			<Icon
				size={16}
				color={colors.text.tertiary as string}
				strokeWidth={1.9}
			/>
		</Pressable>
	);
}

/* -------------------------------------------------------------------------- */
/* User / account section                                                     */
/* -------------------------------------------------------------------------- */

function UserSection({
	labelOpacity,
	collapsed,
}: {
	labelOpacity?: Animated.AnimatedInterpolation<number>;
	collapsed?: boolean;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	const { isDark, toggleTheme } = useAppTheme();
	const user = useAuthStore((s) => s.user);
	const role = useAuthStore((s) => s.role);
	const signOut = useSignOut();

	const initials = useMemo(() => {
		if (!user?.name) return user?.email?.charAt(0).toUpperCase() ?? "?";
		return user.name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 2);
	}, [user?.name, user?.email]);

	const roleLabel =
		role === "superadmin"
			? "Admin"
			: role === "organisation"
				? "NGO"
				: "Volunteer";

	const avatar = (
		<View
			style={{
				width: 34,
				height: 34,
				borderRadius: borderRadius.sm,
				backgroundColor: colors.background.subtle,
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<Caption weight="bold">{initials}</Caption>
		</View>
	);

	// Collapsed, the account block stacks: the row would only ever show its
	// avatar with the two controls clipped off the edge.
	if (collapsed) {
		return (
			<View
				style={{
					paddingVertical: spacing[3],
					alignItems: "center",
					gap: spacing[1],
				}}
			>
				{avatar}
				<IconButton
					icon={isDark ? Sun : Moon}
					label="Dark mode"
					role="switch"
					checked={isDark}
					onPress={toggleTheme}
				/>
				<IconButton
					icon={LogOut}
					label="Sign out"
					onPress={() => signOut.mutate()}
				/>
			</View>
		);
	}

	return (
		<View style={{ padding: spacing[3] }}>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[3],
					paddingLeft: spacing[1],
				}}
			>
				{avatar}
				<Animated.View
					style={{
						flex: 1,
						...(labelOpacity ? { opacity: labelOpacity } : null),
					}}
				>
					<Body weight="semibold" numberOfLines={1}>
						{user?.name ?? "User"}
					</Body>
					<Caption color="quaternary" numberOfLines={1}>
						{roleLabel}
					</Caption>
				</Animated.View>
				<Animated.View
					style={{
						flexDirection: "row",
						...(labelOpacity ? { opacity: labelOpacity } : null),
					}}
				>
					<IconButton
						icon={isDark ? Sun : Moon}
						label="Dark mode"
						role="switch"
						checked={isDark}
						onPress={toggleTheme}
					/>
					<IconButton
						icon={LogOut}
						label="Sign out"
						onPress={() => signOut.mutate()}
					/>
				</Animated.View>
			</View>
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Brand header                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Wordmark only. The logo tile — an orange rounded square holding one letter —
 * was doing the same job as the word next to it.
 */
function BrandHeader({
	brandTitle,
	labelOpacity,
	trailing,
	collapsed,
}: {
	brandTitle?: string;
	labelOpacity?: Animated.AnimatedInterpolation<number>;
	trailing?: React.ReactNode;
	collapsed?: boolean;
}) {
	const { spacing } = useTheme();

	if (collapsed) {
		return (
			<View
				style={{
					paddingTop: spacing[4],
					paddingBottom: spacing[2],
					alignItems: "center",
					gap: spacing[1],
				}}
			>
				<Label weight="bold" style={{ fontSize: 18 }}>
					n
				</Label>
				{trailing}
			</View>
		);
	}

	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				paddingTop: spacing[4],
				paddingBottom: spacing[3],
				paddingLeft: ROW_MARGIN + ROW_INSET,
				paddingRight: spacing[2],
			}}
		>
			<Animated.View
				style={{
					flex: 1,
					...(labelOpacity ? { opacity: labelOpacity } : null),
				}}
			>
				{brandTitle ? (
					<>
						<H5 numberOfLines={1}>{brandTitle}</H5>
						<Caption color="quaternary" numberOfLines={1}>
							nabhya
						</Caption>
					</>
				) : (
					<Label weight="bold" style={{ fontSize: 18 }}>
						nabhya
					</Label>
				)}
			</Animated.View>
			{trailing}
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Sidebar                                                                    */
/* -------------------------------------------------------------------------- */

export function Sidebar({
	navItems,
	brandTitle,
}: {
	navItems: NavItem[];
	brandTitle?: string;
}) {
	const { colors, spacing, borderRadius, elevation, isDark } = useTheme();
	const segments = useSegments();
	const router = useRouter();
	const { isDesktop } = useMedia();
	const insets = useSafeAreaInsets();

	const sections = useMemo(() => groupBySection(navItems), [navItems]);

	/* ---- Collapse ---- */

	const [collapsed, setCollapsed] = useState(false);
	const [collapseRestored, setCollapseRestored] = useState(false);
	// 1 = expanded, 0 = collapsed. Every other value derives from this one.
	const openness = useRef(new Animated.Value(1)).current;

	useEffect(() => {
		storage.get(COLLAPSE_KEY).then((saved) => {
			if (saved === "1") {
				setCollapsed(true);
				openness.setValue(0);
			}
			setCollapseRestored(true);
		});
	}, [openness]);

	const toggleCollapsed = useCallback(() => {
		const next = !collapsed;
		setCollapsed(next);
		storage.set(COLLAPSE_KEY, next ? "1" : "0");
		Animated.timing(openness, {
			toValue: next ? 0 : 1,
			duration: 260,
			// Decelerating: quick to commit, settling into place. No overshoot —
			// a rail that bounces past its width reads as a glitch, not physics.
			easing: Easing.bezier(0.22, 1, 0.36, 1),
			useNativeDriver: false,
		}).start();
	}, [collapsed, openness]);

	const railWidth = openness.interpolate({
		inputRange: [0, 1],
		outputRange: [COLLAPSED_WIDTH, EXPANDED_WIDTH],
	});
	// Labels finish fading before the width is done, so text never sits in a rail
	// too narrow to hold it.
	const labelOpacity = openness.interpolate({
		inputRange: [0, 0.55, 1],
		outputRange: [0, 0, 1],
	});
	const railOpacity = openness.interpolate({
		inputRange: [0, 0.45, 1],
		outputRange: [1, 0, 0],
	});

	/* ---- Mobile drawer ---- */

	const [mobileOpen, setMobileOpen] = useState(false);
	const [drawerMounted, setDrawerMounted] = useState(false);
	const drawerAnim = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		if (mobileOpen) {
			setDrawerMounted(true);
			Animated.timing(drawerAnim, {
				toValue: 1,
				duration: 300,
				easing: Easing.bezier(0.22, 1, 0.36, 1),
				useNativeDriver: true,
			}).start();
		} else if (drawerMounted) {
			Animated.timing(drawerAnim, {
				toValue: 0,
				duration: 220,
				easing: Easing.in(Easing.cubic),
				useNativeDriver: true,
			}).start(({ finished }) => {
				if (finished) setDrawerMounted(false);
			});
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [mobileOpen]);

	const drawerTranslateX = drawerAnim.interpolate({
		inputRange: [0, 1],
		outputRange: [-DRAWER_WIDTH, 0],
	});
	const backdropOpacity = drawerAnim.interpolate({
		inputRange: [0, 1],
		outputRange: [0, 1],
	});

	const handleNavigate = useCallback(
		(href: string) => {
			router.push(href as never);
			setMobileOpen(false);
		},
		[router],
	);

	const renderNavList = (animated: boolean) => (
		<>
			{sections.map((group, i) => (
				<View key={group.section ?? `section-${i}`}>
					<SectionHeading
						label={group.section}
						first={i === 0}
						{...(animated ? { labelOpacity, railOpacity } : {})}
					/>
					{group.items.map((item) => (
						<NavItemRow
							key={item.href}
							item={item}
							segments={segments}
							collapsed={animated ? collapsed : false}
							onPress={() => handleNavigate(item.href)}
							{...(animated ? { labelOpacity } : {})}
						/>
					))}
				</View>
			))}
		</>
	);

	if (isDesktop) {
		// Nothing renders until the stored state is known: mounting expanded and
		// snapping to collapsed a frame later is a visible flinch.
		if (!collapseRestored) {
			return (
				<View
					style={{
						width: COLLAPSED_WIDTH,
						backgroundColor: colors.background.card,
						borderRightWidth: 1,
						borderRightColor: colors.border.hairline,
						height: "100%",
					}}
				/>
			);
		}

		return (
			<Animated.View
				style={{
					width: railWidth,
					backgroundColor: colors.background.card,
					borderRightWidth: 1,
					borderRightColor: colors.border.hairline,
					height: "100%",
					overflow: "hidden",
				}}
			>
				<BrandHeader
					brandTitle={brandTitle}
					labelOpacity={labelOpacity}
					collapsed={collapsed}
					trailing={
						<IconButton
							icon={collapsed ? PanelLeftOpen : PanelLeftClose}
							label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
							expanded={!collapsed}
							onPress={toggleCollapsed}
						/>
					}
				/>
				<ScrollView
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{ paddingBottom: spacing[2], flexGrow: 1 }}
				>
					{renderNavList(true)}
				</ScrollView>
				<UserSection labelOpacity={labelOpacity} collapsed={collapsed} />
			</Animated.View>
		);
	}

	return (
		<>
			<View
				style={{
					position: "absolute",
					top: insets.top + spacing[2],
					left: spacing[3],
					zIndex: 60,
				}}
			>
				<Pressable
					onPress={() => setMobileOpen(true)}
					accessibilityRole="button"
					accessibilityLabel="Open navigation menu"
					hitSlop={6}
					style={({ pressed }) => ({
						width: 44,
						height: 44,
						borderRadius: borderRadius.md,
						backgroundColor: pressed
							? colors.background.subtle
							: colors.background.card,
						alignItems: "center",
						justifyContent: "center",
						...(isDark ? {} : elevation.card),
					})}
				>
					<Menu size={20} color={colors.text.primary as string} />
				</Pressable>
			</View>

			{drawerMounted && (
				<View style={{ position: "absolute", inset: 0, zIndex: 50 }}>
					<Animated.View
						style={{
							position: "absolute",
							inset: 0,
							backgroundColor: "rgba(0,0,0,0.32)",
							opacity: backdropOpacity,
						}}
					>
						<Pressable
							onPress={() => setMobileOpen(false)}
							accessibilityRole="button"
							accessibilityLabel="Close navigation menu"
							style={{ flex: 1 }}
						/>
					</Animated.View>
					<Animated.View
						style={{
							position: "absolute",
							top: 0,
							left: 0,
							bottom: 0,
							width: DRAWER_WIDTH,
							backgroundColor: colors.background.card,
							transform: [{ translateX: drawerTranslateX }],
							shadowColor: "#000",
							shadowOffset: { width: 4, height: 0 },
							shadowOpacity: 0.15,
							shadowRadius: 24,
							elevation: 16,
						}}
					>
						<View style={{ paddingTop: insets.top }}>
							<BrandHeader
								brandTitle={brandTitle}
								trailing={
									<IconButton
										icon={X}
										label="Close navigation menu"
										onPress={() => setMobileOpen(false)}
									/>
								}
							/>
						</View>
						<ScrollView
							showsVerticalScrollIndicator={false}
							contentContainerStyle={{ paddingBottom: spacing[2], flexGrow: 1 }}
						>
							{renderNavList(false)}
						</ScrollView>
						<UserSection />
					</Animated.View>
				</View>
			)}
		</>
	);
}
