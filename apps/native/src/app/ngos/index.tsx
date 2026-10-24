import { useRouter } from "expo-router";
import { Building2, MapPin } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { OrgLogo } from "@/components/org-branding";
import { PAGE_SIZE, PagedList, usePagedQuery } from "@/components/paged-list";
import {
	Banner,
	EmptyState,
	FilterChips,
	Screen,
	ScreenHeader,
} from "@/components/screen-shell";
import { SearchField } from "@/components/search-field";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption } from "@/components/ui/typography";
import { useMe } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { useDebounced } from "@/hooks/useDebounced";
import { orgDirectoryApi, queryKeys } from "@/lib/api";
import { cityCoordinates } from "@/lib/cities";
import { focusable } from "@/lib/focus";
import { READING_COLUMN } from "@/lib/reading-column";
import { useAuthStore } from "@/store/auth-store";

type Mode = "all" | "nearby";

/** Common row shape across the "all" and "nearby" endpoints. */
interface DirectoryRow {
	id: string;
	organizationName: string;
	logo: string | null;
	description: string | null;
	city: string | null;
	state: string | null;
	distanceKm?: number;
}

const MODES: Array<{ value: Mode; label: string }> = [
	{ value: "all", label: "All NGOs" },
	{ value: "nearby", label: "Near me" },
];

/**
 * Public NGO directory.
 *
 * "Near me" measures from the pin the person saved ("use my location" at
 * onboarding or in Edit profile), else from the centre of their saved city,
 * else from their organisation's city - the app never asks for device location
 * here, which would be a heavy permission for a browse screen.
 *
 * It used to send Mumbai's coordinates for everyone and enable itself only for
 * an account that owned an organisation, so a volunteer - the person the tab
 * is for - always got "we don't know where you are", and the fix it offered
 * (add your city) changed nothing.
 */
export default function NgoDirectory() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const [mode, setMode] = useState<Mode>("all");
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebounced(search.trim());

	const email = useAuthStore((s) => s.email);
	const { data: me } = useMe(!!email);

	const listFilters = debouncedSearch ? { search: debouncedSearch } : {};
	const list = usePagedQuery({
		queryKey: queryKeys.organizations({ ...listFilters, limit: PAGE_SIZE }),
		fetchPage: (page) =>
			orgDirectoryApi.list({ ...listFilters, page, limit: PAGE_SIZE }),
		enabled: mode === "all",
	});

	const pin =
		me?.latitude && me.longitude
			? { latitude: Number(me.latitude), longitude: Number(me.longitude) }
			: null;
	const origin =
		pin ?? cityCoordinates(me?.city) ?? cityCoordinates(me?.organization?.city);
	const originLabel = pin
		? "your saved location"
		: (me?.city ?? me?.organization?.city ?? "");
	const hasFix = !!origin;
	const nearby = usePagedQuery({
		queryKey: queryKeys.nearby({ ...origin, limit: PAGE_SIZE }),
		fetchPage: (page) =>
			orgDirectoryApi.nearby({
				page,
				limit: PAGE_SIZE,
				latitude: origin?.latitude ?? 0,
				longitude: origin?.longitude ?? 0,
				radiusKm: 25,
			}),
		// Only once we actually have a fix; otherwise the query never runs.
		enabled: mode === "nearby" && hasFix,
	});

	const showingNearby = mode === "nearby";

	// The two endpoints return different shapes; normalise to one row type so
	// the list renders identically either way.
	const rows: DirectoryRow[] = showingNearby
		? nearby.items.map((item) => ({
				id: item.id,
				organizationName: item.organizationName,
				logo: item.logo,
				description: item.description,
				city: item.city,
				state: item.state,
				distanceKm: item.distanceKm,
			}))
		: list.items.map((item) => ({
				id: item.id,
				organizationName: item.organizationName,
				logo: item.logo,
				description: item.description,
				city: item.city,
				state: item.state,
			}));

	const active = showingNearby ? nearby : list;

	return (
		<Screen style={READING_COLUMN}>
			<ScreenHeader
				back
				title="NGOs"
				subtitle="Verified organisations you can support"
			/>

			{/* Search is a name filter on All NGOs; "Near me" takes no term, so the
			    field is only drawn where typing in it does something. */}
			{mode === "all" ? (
				<View style={{ marginBottom: spacing[3] }}>
					<SearchField
						value={search}
						onChange={setSearch}
						placeholder="Search NGOs by name"
						pending={search.trim() !== debouncedSearch}
					/>
				</View>
			) : null}

			<FilterChips options={MODES} value={mode} onChange={setMode} />

			{showingNearby && !hasFix ? (
				<EmptyState
					icon={MapPin}
					title="We don't know where you are yet"
					description={
						email
							? me?.city
								? `We can't place ${me.city} on the map yet. Use "my current location" in your profile and we'll measure from there.`
								: "Add your city in your profile and we'll show the NGOs closest to you."
							: "Sign in and add your city, and we'll show the NGOs closest to you."
					}
					action={
						email ? (
							<Button
								size="sm"
								variant="outline"
								onPress={() => router.push("/edit-profile")}
							>
								{me?.city ? "Set your location" : "Add your city"}
							</Button>
						) : (
							<Button
								size="sm"
								variant="outline"
								onPress={() => router.push("/(auth)/login")}
							>
								Sign in
							</Button>
						)
					}
				/>
			) : (
				<PagedList
					query={active.query}
					items={rows}
					loadMore={active.loadMore}
					grouped
					loadingLabel={showingNearby ? "Finding NGOs near you" : undefined}
					keyExtractor={(item) => item.id}
					header={
						showingNearby ? (
							<View style={{ marginBottom: spacing[3] }}>
								<Banner tone="info" title={`Within 25 km of ${originLabel}`} />
							</View>
						) : undefined
					}
					empty={
						<EmptyState
							icon={Building2}
							title={
								debouncedSearch
									? "No NGOs match"
									: showingNearby
										? "No NGOs nearby yet"
										: "No NGOs yet"
							}
							description={
								debouncedSearch
									? "Try a shorter name, or clear the search."
									: showingNearby
										? "Nothing within 25 km. Every verified NGO in India is under All NGOs."
										: "Verified NGOs will appear here as they join."
							}
							action={
								debouncedSearch ? (
									<Button
										size="sm"
										variant="outline"
										onPress={() => setSearch("")}
									>
										Clear search
									</Button>
								) : showingNearby ? (
									<Button
										size="sm"
										variant="outline"
										onPress={() => setMode("all")}
									>
										Show all NGOs
									</Button>
								) : undefined
							}
						/>
					}
					renderItem={(item) => (
						<Pressable
							onPress={() => router.push(`/ngos/${item.id}`)}
							accessibilityRole="button"
							accessibilityLabel={item.organizationName}
							{...focusable}
							style={(state) => {
								const { pressed, hovered } = state as {
									pressed: boolean;
									hovered?: boolean;
								};
								return {
									flexDirection: "row",
									alignItems: "center",
									gap: spacing[3],
									paddingHorizontal: spacing[4],
									paddingVertical: spacing[3],
									minHeight: 64,
									backgroundColor:
										pressed || hovered
											? colors.background.subtle
											: "transparent",
								};
							}}
						>
							{/* The NGO's own logo, initials as the fallback - the same
							    rounded square as its page and the Following list. */}
							<OrgLogo
								name={item.organizationName}
								imageKey={item.logo}
								size={40}
							/>
							<View style={{ flex: 1, minWidth: 0 }}>
								<Body weight="medium" numberOfLines={1}>
									{item.organizationName}
								</Body>
								<Caption color="tertiary" numberOfLines={1}>
									{[item.city, item.state].filter(Boolean).join(", ") ||
										"Location not set"}
									{item.distanceKm !== undefined
										? ` · ${Math.round(item.distanceKm)} km away`
										: ""}
								</Caption>
								{item.description && (
									<Caption
										color="quaternary"
										numberOfLines={1}
										style={{ marginTop: spacing[0.5] }}
									>
										{item.description}
									</Caption>
								)}
							</View>
						</Pressable>
					)}
				/>
			)}
		</Screen>
	);
}
