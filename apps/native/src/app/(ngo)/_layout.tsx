import { Redirect, Slot, Tabs } from "expo-router";
import {
	CalendarDays,
	HeartHandshake,
	House,
	Newspaper,
	User,
} from "lucide-react-native";
import { Platform, View, type ViewStyle } from "react-native";
import { NGO_NAV_ITEMS } from "@/components/nav-items";
import { OrgSuspended } from "@/components/org-suspended";
import { Sidebar } from "@/components/sidebar";
import { renderTabBar, useTabBarOptions } from "@/components/tab-bar";
import { useMyOrganization } from "@/hooks/use-organization";
import { useOnboardingStatus } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { useAuthStore } from "@/store/auth-store";

/**
 * How wide the content area is allowed to get on desktop.
 *
 * Every `(ngo)` screen is a `Screen` with `flex: 1`, so without this they take
 * whatever the monitor offers: at 2560px the needs grid drew three cards a
 * metre wide, and the reviews list ran a single line of prose across the whole
 * desk. Capping once here fixes all twelve screens rather than each remembering
 * to cap itself - and the page background stays full-bleed, because it is
 * painted by the row below, not by this column.
 *
 * 1440 holds the feed's 720pt column plus its 384pt rail with room to spare,
 * and three ~440px cards plus gutters on the grid screens, which is what
 * `useGridColumns` tops out at. Wider than this and a list row's label and its
 * trailing value end up a hand's width apart.
 */
const CONTENT_MAX_WIDTH = 1440;

/**
 * A hard height for the desktop shell.
 *
 * Every scroll region in the app is a `ScrollView` whose height comes from a
 * chain of `flex: 1` ancestors. On the web that chain is only as good as its
 * weakest link: if any ancestor resolves to content height instead of viewport
 * height, the `ScrollView` grows to fit its content, the `View` above it clips
 * at `overflow: hidden`, and the page silently becomes unscrollable - no
 * scrollbar, no wheel response, content simply gone below the fold.
 *
 * Pinning the shell to the viewport removes the chain from the question. `dvh`
 * rather than `vh` so a mobile browser's collapsing toolbar does not leave the
 * bottom of the pane under the address bar. Native keeps plain `flex: 1`,
 * where Yoga bounds it correctly already.
 *
 * Cast because React Native's `height` accepts only numbers and percentages;
 * `dvh` is a CSS unit react-native-web passes straight through. Same idiom as
 * the `position: sticky` rails elsewhere in this app.
 */
const SHELL_HEIGHT: ViewStyle =
	Platform.OS === "web" ? ({ height: "100dvh" } as unknown as ViewStyle) : {};

export default function NgoLayout() {
	const role = useAuthStore((s) => s.role);
	const email = useAuthStore((s) => s.email);
	const { colors } = useTheme();
	const { isDesktop } = useMedia();
	const tabBarOptions = useTabBarOptions();
	const { data: org } = useMyOrganization(isDesktop);

	// Status, not `/organizations/me`: the latter 403s for a suspended org.
	const { data: status } = useOnboardingStatus(role === "organisation");

	// Signed out: straight to sign-in, never via "/" - the gate there replaces
	// itself with login, and a layout still mounted for that frame redirecting
	// back to "/" looped the root Stack ("Maximum update depth exceeded").
	if (!email) return <Redirect href="/(auth)/login" />;
	if (role !== "organisation") return <Redirect href="/" />;

	const orgStatus = status?.organization?.status;
	if (orgStatus === "SUSPENDED" || orgStatus === "DELETED") {
		return (
			<OrgSuspended
				name={status?.organization?.organizationName}
				deleted={orgStatus === "DELETED"}
				reason={status?.organization?.statusReason}
			/>
		);
	}

	if (isDesktop) {
		return (
			<View
				style={{
					flex: 1,
					...SHELL_HEIGHT,
					flexDirection: "row",
					backgroundColor: colors.background.warm,
				}}
			>
				<Sidebar navItems={NGO_NAV_ITEMS} brandTitle={org?.organizationName} />
				<View style={{ flex: 1, minWidth: 0, alignItems: "center" }}>
					<View
						style={{
							flex: 1,
							// Without this a flex item is floored at its content
							// height, which is the other half of the unscrollable-page
							// problem described above.
							minHeight: 0,
							width: "100%",
							maxWidth: CONTENT_MAX_WIDTH,
						}}
					>
						<Slot />
					</View>
				</View>
			</View>
		);
	}

	return (
		<View style={{ flex: 1 }}>
			<Tabs screenOptions={tabBarOptions} tabBar={renderTabBar}>
				<Tabs.Screen
					name="feed"
					options={{
						title: "Feed",
						tabBarIcon: ({ color, size }) => (
							<Newspaper size={size} color={color} />
						),
					}}
				/>
				<Tabs.Screen
					name="index"
					options={{
						title: "Dashboard",
						tabBarIcon: ({ color, size }) => (
							<House size={size} color={color} />
						),
					}}
				/>
				<Tabs.Screen
					name="needs"
					options={{
						title: "Needs",
						tabBarIcon: ({ color, size }) => (
							<HeartHandshake size={size} color={color} />
						),
					}}
				/>
				<Tabs.Screen
					name="events"
					options={{
						title: "Events",
						tabBarIcon: ({ color, size }) => (
							<CalendarDays size={size} color={color} />
						),
					}}
				/>
				<Tabs.Screen name="edit" options={{ href: null }} />
				<Tabs.Screen name="verification" options={{ href: null }} />
				<Tabs.Screen name="announcements" options={{ href: null }} />
				<Tabs.Screen name="reviews" options={{ href: null }} />
				<Tabs.Screen name="team" options={{ href: null }} />
				<Tabs.Screen name="reports" options={{ href: null }} />
				<Tabs.Screen name="donations" options={{ href: null }} />
				<Tabs.Screen
					name="profile"
					options={{
						title: "Profile",
						tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
					}}
				/>
			</Tabs>
		</View>
	);
}
