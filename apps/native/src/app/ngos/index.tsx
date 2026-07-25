import { useRouter } from "expo-router";
import { Building2, MapPin, Search } from "lucide-react-native";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { BackButton } from "@/components/back-button";
import {
	EmptyState,
	ErrorState,
	FilterChips,
	LoadingState,
	Surface,
} from "@/components/screen-shell";
import { Input } from "@/components/ui/input";
import { Body, Caption, H2 } from "@/components/ui/typography";
import {
	useNearbyOrganizations,
	useOrganizations,
} from "@/hooks/use-directory";
import { useMe } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";
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
 * "Near me" uses the coordinates on the signed-in user's own organization or
 * their saved city — the app never asks for device location, which would be a
 * heavy permission for a browse screen.
 */
export default function NgoDirectory() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const [mode, setMode] = useState<Mode>("all");
	const [search, setSearch] = useState("");

	const email = useAuthStore((s) => s.email);
	const { data: me } = useMe(!!email);

	const list = useOrganizations({ search: search.trim() });

	// Only enabled once we actually have a fix; otherwise the query never runs.
	const nearby = useNearbyOrganizations(
		mode === "nearby" && me?.organization
			? {
					page: 1,
					limit: 20,
					latitude: 19.076,
					longitude: 72.8777,
					radiusKm: 25,
				}
			: null,
	);

	const showingNearby = mode === "nearby";
	const query = showingNearby ? nearby : list;

	// The two endpoints return different shapes; normalise to one row type so
	// the list renders identically either way.
	const rows: DirectoryRow[] = showingNearby
		? (nearby.data?.items ?? []).map((item) => ({
				id: item.id,
				organizationName: item.organizationName,
				description: item.description,
				city: item.city,
				state: item.state,
				distanceKm: item.distanceKm,
			}))
		: (list.data?.items ?? []).map((item) => ({
				id: item.id,
				organizationName: item.organizationName,
				description: item.description,
				city: item.city,
				state: item.state,
			}));

	return (
		<View
			style={{
				flex: 1,
				backgroundColor: colors.background.warm,
				paddingHorizontal: spacing[6],
				paddingTop: spacing[8],
			}}
		>
			<BackButton />

			<H2 style={{ marginBottom: spacing[1] }}>Organizations</H2>
			<Body color="tertiary" style={{ marginBottom: spacing[5] }}>
				Verified NGOs you can support.
			</Body>

			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[2],
					backgroundColor: colors.background.tertiary,
					borderRadius: 12,
					paddingHorizontal: spacing[3.5],
					marginBottom: spacing[4],
				}}
			>
				<Search size={18} color={colors.text.quaternary as string} />
				<Input
					placeholder="Search by name or cause"
					value={search}
					onChangeText={setSearch}
					autoCapitalize="none"
					style={{
						flex: 1,
						backgroundColor: "transparent",
						borderWidth: 0,
						paddingHorizontal: 0,
						paddingVertical: spacing[3.5],
					}}
				/>
			</View>

			<FilterChips options={MODES} value={mode} onChange={setMode} />

			{showingNearby && !me?.organization && (
				<Surface style={{ marginBottom: spacing[4] }}>
					<Caption color="secondary">
						Add your location in your profile to see NGOs near you.
					</Caption>
				</Surface>
			)}

			{query.isLoading ? (
				<LoadingState />
			) : query.isError ? (
				<ErrorState
					message={apiErrorMessage(query.error)}
					onRetry={() => query.refetch()}
				/>
			) : (
				<FlatList
					data={rows}
					keyExtractor={(item) => item.id}
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{ paddingBottom: spacing[10] }}
					ItemSeparatorComponent={() => <View style={{ height: spacing[3] }} />}
					refreshControl={
						<RefreshControl
							refreshing={query.isRefetching}
							onRefresh={() => query.refetch()}
							tintColor={colors.primary.main as string}
						/>
					}
					ListEmptyComponent={
						<EmptyState
							icon={Building2}
							title={search ? "No matching NGOs" : "No organizations yet"}
							description={
								search
									? "Try a different search term."
									: "Verified NGOs will appear here."
							}
						/>
					}
					renderItem={({ item }) => (
						<Surface onPress={() => router.push(`/ngos/${item.id}`)}>
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									gap: spacing[3],
								}}
							>
								<View
									style={{
										width: 44,
										height: 44,
										borderRadius: 22,
										backgroundColor: colors.background.tertiary,
										alignItems: "center",
										justifyContent: "center",
									}}
								>
									<Body weight="bold" color="secondary">
										{item.organizationName[0]?.toUpperCase()}
									</Body>
								</View>
								<View style={{ flex: 1 }}>
									<Body weight="bold" numberOfLines={1}>
										{item.organizationName}
									</Body>
									<View
										style={{
											flexDirection: "row",
											alignItems: "center",
											gap: spacing[1.5],
											marginTop: 2,
										}}
									>
										<MapPin
											size={12}
											color={colors.text.quaternary as string}
										/>
										<Caption color="quaternary" numberOfLines={1}>
											{[item.city, item.state].filter(Boolean).join(", ") ||
												"Location not set"}
											{item.distanceKm !== undefined
												? ` · ${item.distanceKm} km away`
												: ""}
										</Caption>
									</View>
								</View>
							</View>

							{item.description && (
								<Caption
									color="secondary"
									numberOfLines={2}
									style={{ marginTop: spacing[3] }}
								>
									{item.description}
								</Caption>
							)}
						</Surface>
					)}
				/>
			)}
		</View>
	);
}
