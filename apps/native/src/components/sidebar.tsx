import { useRouter, useSegments } from "expo-router";
import type { LucideIcon } from "lucide-react-native";
import { LogOut, Menu, Moon, Sun, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Body, Caption } from "@/components/ui/typography";
import { useSignOut } from "@/hooks/use-auth";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useMedia } from "@/hooks/useMedia";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/store/auth-store";

export interface NavItem {
	label: string;
	href: string;
	icon: LucideIcon;
	/** Optional group heading. Items sharing the same section are rendered together. */
	section?: string;
}

const EXPANDED_WIDTH = 264;
const DRAWER_WIDTH = 288;

const NO_SECTION = "__default__";

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
}: {
	item: NavItem;
	segments: string[];
	onPress: () => void;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	const Icon = item.icon;
	const active = isActive(item.href, segments);

	const press = useRef(new Animated.Value(1)).current;
	const highlight = useRef(new Animated.Value(active ? 1 : 0)).current;

	useEffect(() => {
		Animated.timing(highlight, {
			toValue: active ? 1 : 0,
			duration: 240,
			easing: Easing.out(Easing.cubic),
			useNativeDriver: false,
		}).start();
	}, [active, highlight]);

	const onPressIn = () =>
		Animated.spring(press, {
			toValue: 0.96,
			useNativeDriver: true,
			speed: 40,
			bounciness: 0,
		}).start();

	const onPressOut = () =>
		Animated.spring(press, {
			toValue: 1,
			useNativeDriver: true,
			speed: 24,
			bounciness: 6,
		}).start();

	const backgroundColor = highlight.interpolate({
		inputRange: [0, 1],
		outputRange: ["rgba(0,0,0,0)", `${colors.primary.main}12`],
	});

	return (
		<Animated.View style={{ transform: [{ scale: press }] }}>
			<Pressable
				onPress={onPress}
				onPressIn={onPressIn}
				onPressOut={onPressOut}
				style={{ marginHorizontal: spacing[2], marginVertical: 1 }}
			>
				<Animated.View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[3],
						paddingVertical: spacing[2.5],
						paddingHorizontal: spacing[3.5],
						borderRadius: borderRadius.md,
						backgroundColor,
						overflow: "hidden",
					}}
				>
					<Icon
						size={19}
						strokeWidth={active ? 2.3 : 2}
						color={
							active
								? (colors.primary.main as string)
								: (colors.text.tertiary as string)
						}
					/>

					<View style={{ flex: 1 }}>
						<Body
							weight={active ? "bold" : "medium"}
							color={active ? "primary" : "secondary"}
							numberOfLines={1}
						>
							{item.label}
						</Body>
					</View>
				</Animated.View>
			</Pressable>
		</Animated.View>
	);
}

/* -------------------------------------------------------------------------- */
/* Section heading / divider                                                  */
/* -------------------------------------------------------------------------- */

function SectionHeading({ label, first }: { label?: string; first: boolean }) {
	const { colors, spacing } = useTheme();

	if (!label) {
		return <View style={{ height: first ? spacing[2] : spacing[3] }} />;
	}

	return (
		<View
			style={{
				paddingHorizontal: spacing[4],
				marginTop: first ? spacing[2] : spacing[5],
				marginBottom: spacing[1.5],
			}}
		>
			<Caption
				weight="semibold"
				color="tertiary"
				style={{
					fontSize: 10.5,
					letterSpacing: 0.8,
					textTransform: "uppercase",
					opacity: 0.7,
				}}
				numberOfLines={1}
			>
				{label}
			</Caption>
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* User / account section                                                     */
/* -------------------------------------------------------------------------- */

function UserSection() {
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
				width: 36,
				height: 36,
				borderRadius: 12,
				backgroundColor: colors.primary.main,
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<Caption weight="bold" color={colors.primary.contrast as string}>
				{initials}
			</Caption>
		</View>
	);

	return (
		<View
			style={{
				borderTopWidth: 1,
				borderTopColor: colors.border.light,
				paddingVertical: spacing[3.5],
				paddingHorizontal: spacing[3.5],
				gap: spacing[3],
			}}
		>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[3],
				}}
			>
				{avatar}
				<View style={{ flex: 1 }}>
					<Body weight="semibold" numberOfLines={1}>
						{user?.name ?? "User"}
					</Body>
					<Caption color="tertiary" numberOfLines={1}>
						{user?.email ?? ""}
					</Caption>
				</View>
				<View
					style={{
						paddingHorizontal: spacing[1.5],
						paddingVertical: spacing[0.5],
						borderRadius: borderRadius.sm,
						backgroundColor: `${colors.primary.main}15`,
					}}
				>
					<Caption
						weight="medium"
						color={colors.primary.main as string}
						style={{
							fontSize: 10,
							letterSpacing: 0.5,
							textTransform: "uppercase",
						}}
					>
						{roleLabel}
					</Caption>
				</View>
			</View>

			<View style={{ flexDirection: "row", gap: spacing[1.5] }}>
				<Pressable
					onPress={toggleTheme}
					style={({ pressed }) => ({
						flex: 1,
						flexDirection: "row",
						alignItems: "center",
						justifyContent: "center",
						gap: spacing[1.5],
						paddingVertical: spacing[2],
						borderRadius: borderRadius.sm,
						backgroundColor: pressed
							? colors.background.tertiary
							: colors.background.secondary,
					})}
				>
					{isDark ? (
						<Sun size={14} color={colors.text.tertiary as string} />
					) : (
						<Moon size={14} color={colors.text.tertiary as string} />
					)}
					<Caption color="tertiary">{isDark ? "Light" : "Dark"}</Caption>
				</Pressable>
				<Pressable
					onPress={() => signOut.mutate()}
					style={({ pressed }) => ({
						flex: 1,
						flexDirection: "row",
						alignItems: "center",
						justifyContent: "center",
						gap: spacing[1.5],
						paddingVertical: spacing[2],
						borderRadius: borderRadius.sm,
						backgroundColor: pressed
							? colors.background.tertiary
							: colors.background.secondary,
					})}
				>
					<LogOut size={14} color={colors.text.tertiary as string} />
					<Caption color="tertiary">Sign out</Caption>
				</Pressable>
			</View>
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Brand header — logo + org name                                             */
/* -------------------------------------------------------------------------- */

function BrandHeader({ brandTitle }: { brandTitle?: string }) {
	const { colors, spacing } = useTheme();

	return (
		<View
			style={{
				paddingVertical: spacing[3.5],
				paddingHorizontal: spacing[3.5],
				borderBottomWidth: 1,
				borderBottomColor: colors.border.light,
			}}
		>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[2.5],
				}}
			>
				<View
					style={{
						width: 34,
						height: 34,
						borderRadius: 10,
						backgroundColor: colors.primary.main,
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<Caption
						weight="bold"
						color={colors.primary.contrast as string}
						style={{ fontSize: 15 }}
					>
						{brandTitle ? brandTitle.charAt(0).toUpperCase() : "N"}
					</Caption>
				</View>
				<View style={{ flex: 1 }}>
					<Body weight="bold" numberOfLines={1} style={{ fontSize: 16.5 }}>
						{brandTitle ?? "nabhya"}
					</Body>
					<Body
						numberOfLines={1}
						style={{
							fontSize: 11,
							marginTop: -1,
							fontFamily: "NeutralFace-Bold",
							color: colors.text.quaternary,
							letterSpacing: -0.2,
						}}
					>
						{brandTitle ? "nabhya" : ""}
					</Body>
				</View>
			</View>
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Sidebar                                                                     */
/* -------------------------------------------------------------------------- */

export function Sidebar({
	navItems,
	brandTitle,
}: {
	navItems: NavItem[];
	brandTitle?: string;
}) {
	const { colors, spacing } = useTheme();
	const segments = useSegments();
	const router = useRouter();
	const { isDesktop } = useMedia();
	const insets = useSafeAreaInsets();

	const sections = useMemo(() => groupBySection(navItems), [navItems]);

	// Mobile drawer
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

	const renderNavList = () => (
		<>
			{sections.map((group, i) => (
				<View key={group.section ?? `section-${i}`}>
					<SectionHeading label={group.section} first={i === 0} />
					{group.items.map((item) => (
						<NavItemRow
							key={item.href}
							item={item}
							segments={segments}
							onPress={() => handleNavigate(item.href)}
						/>
					))}
				</View>
			))}
		</>
	);

	if (isDesktop) {
		return (
			<View
				style={{
					width: EXPANDED_WIDTH,
					backgroundColor: colors.background.primary,
					borderRightWidth: 1,
					borderRightColor: colors.border.light,
					height: "100%",
				}}
			>
				<BrandHeader brandTitle={brandTitle} />
				<ScrollView
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{
						paddingVertical: spacing[2],
						flexGrow: 1,
					}}
				>
					{renderNavList()}
				</ScrollView>
				<UserSection />
			</View>
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
					style={({ pressed }) => ({
						width: 40,
						height: 40,
						borderRadius: 10,
						backgroundColor: pressed
							? colors.background.tertiary
							: colors.background.primary,
						alignItems: "center",
						justifyContent: "center",
						borderWidth: 1,
						borderColor: colors.border.light,
						shadowColor: "#000",
						shadowOffset: { width: 0, height: 1 },
						shadowOpacity: 0.08,
						shadowRadius: 4,
						elevation: 2,
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
							backgroundColor: "rgba(0,0,0,0.3)",
							opacity: backdropOpacity,
						}}
					>
						<Pressable
							onPress={() => setMobileOpen(false)}
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
							backgroundColor: colors.background.primary,
							transform: [{ translateX: drawerTranslateX }],
							shadowColor: "#000",
							shadowOffset: { width: 4, height: 0 },
							shadowOpacity: 0.15,
							shadowRadius: 24,
							elevation: 16,
						}}
					>
						<View
							style={{
								flexDirection: "row",
								justifyContent: "flex-end",
								paddingRight: spacing[2],
								paddingTop: insets.top + spacing[2],
							}}
						>
							<Pressable
								onPress={() => setMobileOpen(false)}
								style={({ pressed }) => ({
									width: 36,
									height: 36,
									borderRadius: 10,
									alignItems: "center",
									justifyContent: "center",
									backgroundColor: pressed
										? colors.background.tertiary
										: "transparent",
								})}
							>
								<X size={20} color={colors.text.secondary as string} />
							</Pressable>
						</View>
						<BrandHeader brandTitle={brandTitle} />
						<ScrollView
							showsVerticalScrollIndicator={false}
							contentContainerStyle={{
								paddingVertical: spacing[2],
								flexGrow: 1,
							}}
						>
							{renderNavList()}
						</ScrollView>
						<UserSection />
					</Animated.View>
				</View>
			)}
		</>
	);
}
