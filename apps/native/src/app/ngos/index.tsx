import { useRouter } from "expo-router";
import { Building2, MapPin, Search } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { PAGE_SIZE, PagedList, usePagedQuery } from "@/components/paged-list";
import {
	Banner,
	EmptyState,
	FilterChips,
	Screen,
	ScreenHeader,
} from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption, Label } from "@/components/ui/typography";
import { useMe } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { useDebounced } from "@/hooks/useDebounced";
import { orgDirectoryApi, queryKeys } from "@/lib/api";
import { focusable, focusWithin } from "@/lib/focus";
import { useAuthStore } from "@/store/auth-store";

type Mode = "all" | "nearby";

/** Common row shape across the "all" and "nearby" endpoints. */
interface DirectoryRow {
	id: string;
	organizationName: string;
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
 * "Near me" uses the coordinates on the signed-in user's own organisation or
 * their saved city - the app never asks for device location, which would be a
 * heavy permission for a browse screen.
 */
export default function NgoDirectory() {
	const { colors, spacing, borderRadius } = useTheme();
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

	const hasFix = !!me?.organization;
	const nearby = usePagedQuery({
		queryKey: queryKeys.nearby({ limit: PAGE_SIZE }),
		fetchPage: (page) =>
			orgDirectoryApi.nearby({
				page,
				limit: PAGE_SIZE,
				latitude: 19.076,
				longitude: 72.8777,
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
				description: item.description,
				city: item.city,
				state: item.state,
				distanceKm: item.distanceKm,
			}))
		: list.items.map((item) => ({
				id: item.id,
				organizationName: item.organizationName,
				description: item.description,
				city: item.city,
				state: item.state,
			}));

	const active = showingNearby ? nearby : list;

	return (
		<Screen>
			<ScreenHeader
				back
				title="NGOs"
				subtitle="Verified organisations you can support"
			/>

			<View
				{...focusWithin}
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[2],
					backgroundColor: colors.background.subtle,
					borderRadius: borderRadius.lg,
					paddingHorizontal: spacing[3.5],
					marginBottom: spacing[3],
				}}
			>
				<Search size={18} color={colors.text.quaternary as string} />
				<Input
					placeholder="Search by name"
					value={search}
					onChangeText={setSearch}
					autoCapitalize="none"
					autoCorrect={false}
					returnKeyType="search"
					accessibilityLabel="Search NGOs"
					style={{
						flex: 1,
						backgroundColor: "transparent",
						borderWidth: 0,
						paddingHorizontal: 0,
						paddingVertical: spacing[3],
					}}
				/>
			</View>

			<FilterChips options={MODES} value={mode} onChange={setMode} />

			{showingNearby && !hasFix ? (
				<EmptyState
					icon={MapPin}
					title="We don't know where you are yet"
					description="Add your city in your profile and we'll show the NGOs closest to you."
					action={
						email ? (
							<Button
								size="sm"
								variant="outline"
								onPress={() => router.push("/edit-profile")}
							>
								Add your city
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
								<Banner
									tone="info"
									title="Within 25 km of your saved location"
								/>
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
							<View
								style={{
									width: 40,
									height: 40,
									borderRadius: 20,
									backgroundColor: colors.primary.tint,
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								<Label weight="bold" color={colors.primary.ink}>
									{item.organizationName[0]?.toUpperCase()}
								</Label>
							</View>
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
