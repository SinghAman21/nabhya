import type { NeedType } from "@nabhya/shared";
import {
	ChevronRight,
	HeartHandshake,
	MapPin,
	Search,
} from "lucide-react-native";
import { useState } from "react";
import {
	FlatList,
	Platform,
	Pressable,
	RefreshControl,
	ScrollView,
	View,
} from "react-native";
import { NotificationBell } from "@/components/notification-bell";
import { PledgeSheet } from "@/components/pledge-sheet";
import {
	EmptyState,
	ErrorState,
	FilterChips,
	LoadingState,
	ScreenHeader,
} from "@/components/screen-shell";
import { StatusPill, urgencyTone } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Body, Caption } from "@/components/ui/typography";
import { usePublicNeeds } from "@/hooks/use-needs";
import { useMedia } from "@/hooks/useMedia";
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

export default function Discover() {
	const { colors, spacing } = useTheme();
	const { isDesktop } = useMedia();
	const [filter, setFilter] = useState<Filter>("ALL");
	const [search, setSearch] = useState("");
	const [responding, setResponding] = useState<PublicNeed | null>(null);

	const query = usePublicNeeds({
		search: search.trim(),
		...(filter === "ALL" ? {} : { type: filter }),
	});

	const needs = query.data?.items ?? [];

	const content = (
		<>
			<ScreenHeader
				title="Discover"
				subtitle="What verified NGOs need right now — and what they're giving away."
				action={<NotificationBell />}
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
			) : needs.length === 0 ? (
				<EmptyState
					icon={HeartHandshake}
					title={search ? "No matching posts" : "Nothing posted yet"}
					description={
						search
							? "Try a different search term."
							: "Verified NGOs will post what they need here."
					}
				/>
			) : isDesktop ? (
				<DesktopNeedGrid
					needs={needs}
					onRespond={(need) => setResponding(need)}
				/>
			) : (
				<FlatList
					data={needs}
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
					renderItem={({ item }) => (
						<NeedCard need={item} onRespond={() => setResponding(item)} />
					)}
				/>
			)}
		</>
	);

	return (
		<View
			style={{
				flex: 1,
				backgroundColor: colors.background.warm,
				paddingTop: spacing[8],
				paddingHorizontal: spacing[6],
			}}
		>
			{content}
			<PledgeSheet need={responding} onClose={() => setResponding(null)} />
		</View>
	);
}

function DesktopNeedGrid({
	needs,
	onRespond,
}: {
	needs: PublicNeed[];
	onRespond: (need: PublicNeed) => void;
}) {
	const { spacing } = useTheme();

	return (
		<ScrollView
			showsVerticalScrollIndicator={false}
			contentContainerStyle={{ paddingBottom: spacing[10] }}
		>
			<View
				style={{
					flexDirection: "row",
					flexWrap: "wrap",
					marginHorizontal: -spacing[2],
				}}
			>
				{needs.map((need) => (
					<View
						key={need.id}
						style={{
							width: "33.333%",
							paddingHorizontal: spacing[2],
							marginBottom: spacing[4],
						}}
					>
						<NeedCard need={need} onRespond={() => onRespond(need)} />
					</View>
				))}
			</View>
		</ScrollView>
	);
}

function NeedCard({
	need,
	onRespond,
}: {
	need: PublicNeed;
	onRespond: () => void;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	const isWeb = Platform.OS === "web";

	const typeColor =
		need.type === "WANT"
			? (colors.info.main as string)
			: (colors.success.main as string);
	const typeBg =
		need.type === "WANT" ? `${colors.info.main}12` : `${colors.success.main}12`;
	const orgInitial =
		need.organization.organizationName?.charAt(0).toUpperCase() ?? "N";

	return (
		<View
			style={{
				backgroundColor: colors.background.primary,
				borderRadius: borderRadius.lg,
				borderWidth: 1,
				borderColor: colors.border.light,
				overflow: "hidden",
				...(isWeb && {
					transition: "box-shadow 0.2s, transform 0.15s",
					boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
					cursor: "pointer",
				}),
			}}
		>
			<View style={{ padding: spacing[4] }}>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[2.5],
						marginBottom: spacing[3],
					}}
				>
					<View
						style={{
							width: 36,
							height: 36,
							borderRadius: 10,
							backgroundColor: typeBg,
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<Caption weight="bold" style={{ fontSize: 15, color: typeColor }}>
							{orgInitial}
						</Caption>
					</View>
					<View style={{ flex: 1 }}>
						<Body weight="semibold" numberOfLines={1}>
							{need.organization.organizationName}
						</Body>
						<Caption color="tertiary" numberOfLines={1}>
							{need.city ?? need.organization.city ?? "India"}
						</Caption>
					</View>
				</View>

				<Body
					weight="bold"
					numberOfLines={2}
					style={{ fontSize: 16, marginBottom: spacing[1] }}
				>
					{need.title}
				</Body>
				<Caption
					color="tertiary"
					numberOfLines={isWeb ? 2 : 3}
					style={{ lineHeight: 19 }}
				>
					{need.description}
				</Caption>

				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						marginTop: spacing[3],
						gap: spacing[1.5],
					}}
				>
					<View
						style={{
							paddingHorizontal: spacing[2],
							paddingVertical: spacing[0.5],
							borderRadius: 999,
							backgroundColor: typeBg,
						}}
					>
						<Caption
							weight="medium"
							style={{ fontSize: 10.5, color: typeColor }}
						>
							{need.type === "WANT" ? "Need" : "Offer"}
						</Caption>
					</View>
					{need.urgency === "HIGH" && (
						<View
							style={{
								paddingHorizontal: spacing[2],
								paddingVertical: spacing[0.5],
								borderRadius: 999,
								backgroundColor: `${colors.error.main}12`,
							}}
						>
							<Caption
								weight="medium"
								style={{
									fontSize: 10.5,
									color: colors.error.main as string,
								}}
							>
								Urgent
							</Caption>
						</View>
					)}
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: spacing[1],
							marginLeft: "auto",
						}}
					>
						<MapPin size={11} color={colors.text.quaternary as string} />
						<Caption color="quaternary" style={{ fontSize: 10.5 }}>
							{formatProgress(need.fulfilledQuantity, need.quantity, need.unit)}
						</Caption>
					</View>
				</View>
			</View>

			<Pressable
				onPress={onRespond}
				style={({ pressed }) => ({
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "center",
					gap: spacing[1.5],
					paddingVertical: spacing[3],
					borderTopWidth: 1,
					borderTopColor: colors.border.light,
					backgroundColor: pressed
						? (colors.background.tertiary as string)
						: "transparent",
				})}
			>
				<Caption weight="semibold" color={typeColor} style={{ fontSize: 13 }}>
					{need.type === "WANT" ? "I can help" : "Claim this"}
				</Caption>
				<ChevronRight size={14} color={typeColor} />
			</Pressable>
		</View>
	);
}
