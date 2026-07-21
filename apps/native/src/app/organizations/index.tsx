import { useRouter } from "expo-router";
import { ArrowLeft, Building2, Search } from "lucide-react-native";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import {
	EmptyState,
	ErrorState,
	LoadingState,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import { StatusPill } from "@/components/status-pill";
import { Input } from "@/components/ui/input";
import { Body, Caption, H3 } from "@/components/ui/typography";
import { usePublicOrganizations } from "@/hooks/use-organizations";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";
import type { PublicOrgListItem } from "@/lib/types";

/** Public directory of verified NGOs. */
export default function OrganizationDirectory() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const [search, setSearch] = useState("");

	const query = usePublicOrganizations({ search: search.trim() });

	return (
		<View
			style={{
				flex: 1,
				backgroundColor: colors.background.warm,
				paddingHorizontal: spacing[6],
				paddingTop: spacing[8],
			}}
		>
			<Pressable
				onPress={() => router.back()}
				hitSlop={12}
				style={{ marginBottom: spacing[4] }}
			>
				<ArrowLeft size={22} color={colors.text.secondary as string} />
			</Pressable>

			<ScreenHeader
				title="NGOs"
				subtitle="Every organization here has been verified by the Nabhya team."
			/>

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

			{query.isLoading ? (
				<LoadingState label="Finding NGOs…" />
			) : query.isError ? (
				<ErrorState
					message={apiErrorMessage(query.error)}
					onRetry={() => query.refetch()}
				/>
			) : (
				<FlatList
					data={query.data?.items ?? []}
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
							title={search ? "No matching NGOs" : "No NGOs listed yet"}
							description={
								search
									? "Try a different search term."
									: "Verified organizations will appear here."
							}
						/>
					}
					renderItem={({ item }) => (
						<OrgCard
							organization={item}
							onPress={() => router.push(`/organizations/${item.id}`)}
						/>
					)}
				/>
			)}
		</View>
	);
}

function OrgCard({
	organization,
	onPress,
}: {
	organization: PublicOrgListItem;
	onPress: () => void;
}) {
	const { colors, spacing } = useTheme();
	const location = [organization.city, organization.state]
		.filter(Boolean)
		.join(", ");

	return (
		<Surface onPress={onPress}>
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
						backgroundColor: colors.primary.main,
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<H3 color={colors.primary.contrast as string}>
						{organization.organizationName[0]?.toUpperCase()}
					</H3>
				</View>
				<View style={{ flex: 1 }}>
					<Body weight="bold" numberOfLines={1}>
						{organization.organizationName}
					</Body>
					{location ? (
						<Caption color="tertiary" numberOfLines={1}>
							{location}
						</Caption>
					) : null}
				</View>
				<StatusPill label="Verified" tone="success" />
			</View>
			{organization.description ? (
				<Caption
					color="secondary"
					numberOfLines={2}
					style={{ marginTop: spacing[3] }}
				>
					{organization.description}
				</Caption>
			) : null}
		</Surface>
	);
}
