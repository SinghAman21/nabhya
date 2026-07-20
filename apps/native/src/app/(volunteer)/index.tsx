import type { NeedType } from "@nabhya/shared";
import { useRouter } from "expo-router";
import { Building2, HeartHandshake, Search } from "lucide-react-native";
import { useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, View } from "react-native";
import {
	EmptyState,
	ErrorState,
	FilterChips,
	LoadingState,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import { StatusPill, urgencyTone } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Body, Caption } from "@/components/ui/typography";
import { useCreatePledge, usePublicNeeds } from "@/hooks/use-needs";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";
import { formatProgress, formatRelative } from "@/lib/format";
import type { PublicNeed } from "@/lib/types";

type Filter = "ALL" | NeedType;

const FILTERS: Array<{ value: Filter; label: string }> = [
	{ value: "ALL", label: "All" },
	{ value: "WANT", label: "NGOs need" },
	{ value: "OFFER", label: "Free to take" },
];

/**
 * Discover — the volunteer-facing side of what organizations post. WANT posts
 * are things to donate; OFFER posts are surplus available to claim.
 */
export default function Discover() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const [filter, setFilter] = useState<Filter>("ALL");
	const [search, setSearch] = useState("");

	const query = usePublicNeeds({
		search: search.trim(),
		...(filter === "ALL" ? {} : { type: filter }),
	});

	return (
		<View
			style={{
				flex: 1,
				backgroundColor: colors.background.warm,
				paddingHorizontal: spacing[6],
				paddingTop: spacing[8],
			}}
		>
			<ScreenHeader
				title="Discover"
				subtitle="What verified NGOs need right now — and what they're giving away."
				action={
					<Pressable
						onPress={() => router.push("/organizations")}
						style={{
							width: 44,
							height: 44,
							borderRadius: 22,
							alignItems: "center",
							justifyContent: "center",
							backgroundColor: colors.background.primary,
							borderWidth: 1,
							borderColor: colors.border.light,
						}}
					>
						<Building2 size={20} color={colors.text.secondary as string} />
					</Pressable>
				}
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
					placeholder="Search items, causes or NGOs"
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

			<FilterChips options={FILTERS} value={filter} onChange={setFilter} />

			{query.isLoading ? (
				<LoadingState label="Finding posts…" />
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
							icon={HeartHandshake}
							title={search ? "No matching posts" : "Nothing posted yet"}
							description={
								search
									? "Try a different search term."
									: "Verified NGOs will post what they need here."
							}
						/>
					}
					renderItem={({ item }) => <NeedCard need={item} />}
				/>
			)}
		</View>
	);
}

function NeedCard({ need }: { need: PublicNeed }) {
	const { spacing } = useTheme();
	const router = useRouter();
	const pledge = useCreatePledge(need.id);

	const onPledge = () => {
		pledge.mutate(
			{},
			{
				onSuccess: () =>
					Alert.alert(
						"Thanks!",
						need.type === "WANT"
							? "The NGO will review your offer and get in touch."
							: "The NGO will confirm and arrange handover.",
					),
				onError: (error) =>
					Alert.alert("Could not respond", apiErrorMessage(error)),
			},
		);
	};

	return (
		<Surface onPress={() => router.push(`/needs/${need.id}`)}>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[2],
					marginBottom: spacing[2],
				}}
			>
				<StatusPill
					label={need.type === "WANT" ? "Needs this" : "Giving away"}
					tone={need.type === "WANT" ? "info" : "success"}
				/>
				{need.urgency === "HIGH" && (
					<StatusPill label="Urgent" tone={urgencyTone(need.urgency)} />
				)}
			</View>

			<Caption color="secondary" numberOfLines={1}>
				{need.organization.organizationName}
			</Caption>
			<Body weight="bold" numberOfLines={2} style={{ marginTop: 2 }}>
				{need.title}
			</Body>
			<Caption color="tertiary" numberOfLines={3} style={{ marginTop: 4 }}>
				{need.description}
			</Caption>

			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					marginTop: spacing[3],
				}}
			>
				<Caption color="secondary">
					{formatProgress(need.fulfilledQuantity, need.quantity, need.unit)}
				</Caption>
				<Caption color="quaternary">
					{need.city ?? ""} · {formatRelative(need.createdAt)}
				</Caption>
			</View>

			<Button
				size="sm"
				onPress={onPledge}
				loading={pledge.isPending}
				style={{ marginTop: spacing[4] }}
			>
				{need.type === "WANT" ? "I can help with this" : "I'd like this"}
			</Button>
		</Surface>
	);
}
