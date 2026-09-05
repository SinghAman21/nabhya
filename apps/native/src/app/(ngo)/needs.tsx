import type { NeedType } from "@nabhya/shared";
import { HeartHandshake, Plus } from "lucide-react-native";
import { useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, View } from "react-native";
import { NeedFormSheet } from "@/components/need-form-sheet";
import { PledgesSheet } from "@/components/pledges-sheet";
import {
	EmptyState,
	ErrorState,
	FilterChips,
	LoadingState,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import {
	humanizeStatus,
	StatusPill,
	urgencyTone,
} from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Body, Caption } from "@/components/ui/typography";
import { useDeleteNeed, useOrgNeeds } from "@/hooks/use-needs";
import { useMe } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import { formatProgress, formatRelative } from "@/lib/format";
import type { OrgNeedListItem } from "@/lib/types";

type TypeFilter = "ALL" | NeedType;

const FILTERS: Array<{ value: TypeFilter; label: string }> = [
	{ value: "ALL", label: "All" },
	{ value: "WANT", label: "We need" },
	{ value: "OFFER", label: "We're giving" },
];

export default function NgoNeeds() {
	const { colors, spacing } = useTheme();
	const [filter, setFilter] = useState<TypeFilter>("ALL");
	const [sheetOpen, setSheetOpen] = useState(false);
	const [editing, setEditing] = useState<OrgNeedListItem | null>(null);
	const [reviewing, setReviewing] = useState<OrgNeedListItem | null>(null);
	const { data: me } = useMe();

	const query = useOrgNeeds(filter === "ALL" ? {} : { type: filter });
	const deleteNeed = useDeleteNeed();

	const isVerified = me?.organization?.verificationStatus === "VERIFIED";
	const items = query.data?.items ?? [];

	const confirmDelete = (need: OrgNeedListItem) => {
		Alert.alert(
			"Remove post",
			`"${need.title}" will be removed. Posts with accepted pledges are closed instead of deleted.`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Remove",
					style: "destructive",
					onPress: () =>
						deleteNeed.mutate(need.id, {
							onError: (error) =>
								Alert.alert("Could not remove", apiErrorMessage(error)),
						}),
				},
			],
		);
	};

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
				title="Needs"
				subtitle="Post what you need, or what you can give away."
				action={
					isVerified ? (
						<Pressable
							onPress={() => setSheetOpen(true)}
							style={{
								width: 44,
								height: 44,
								borderRadius: 22,
								alignItems: "center",
								justifyContent: "center",
								backgroundColor: colors.primary.main,
							}}
						>
							<Plus size={22} color={colors.primary.contrast as string} />
						</Pressable>
					) : undefined
				}
			/>

			{!isVerified && (
				<Surface
					style={{
						marginBottom: spacing[4],
						backgroundColor: colors.warning.bg,
						borderColor: colors.warning.main,
					}}
				>
					<Body weight="bold" color={colors.warning.dark as string}>
						Verification pending
					</Body>
					<Caption color="secondary">
						Your organization needs to be verified before you can publish posts.
					</Caption>
				</Surface>
			)}

			<FilterChips options={FILTERS} value={filter} onChange={setFilter} />

			{query.isLoading ? (
				<LoadingState label="Loading your posts…" />
			) : query.isError ? (
				<ErrorState
					message={apiErrorMessage(query.error)}
					onRetry={() => query.refetch()}
				/>
			) : (
				<FlatList
					data={items}
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
							title="Nothing posted yet"
							description={
								isVerified
									? "Tell volunteers what your organization needs, or list surplus you can pass on."
									: "Once you're verified you'll be able to post here."
							}
							action={
								isVerified ? (
									<Button onPress={() => setSheetOpen(true)}>
										Create your first post
									</Button>
								) : undefined
							}
						/>
					}
					renderItem={({ item }) => (
						<NeedRow
							need={item}
							onReview={() => setReviewing(item)}
							onEdit={() => setEditing(item)}
							onDelete={() => confirmDelete(item)}
						/>
					)}
				/>
			)}

			<PledgesSheet need={reviewing} onClose={() => setReviewing(null)} />

			<NeedFormSheet
				visible={sheetOpen || !!editing}
				need={editing}
				onClose={() => {
					setSheetOpen(false);
					setEditing(null);
				}}
				defaultCity={me?.organization?.city}
				defaultState={me?.organization?.state}
			/>
		</View>
	);
}

function NeedRow({
	need,
	onReview,
	onEdit,
	onDelete,
}: {
	need: OrgNeedListItem;
	onReview: () => void;
	onEdit: () => void;
	onDelete: () => void;
}) {
	const { colors, spacing } = useTheme();

	return (
		<Surface onPress={onReview}>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[2],
					marginBottom: spacing[2],
				}}
			>
				<StatusPill
					label={need.type === "WANT" ? "We need" : "We're giving"}
					tone={need.type === "WANT" ? "info" : "success"}
				/>
				<StatusPill
					label={
						need.urgency === "HIGH" ? "Urgent" : humanizeStatus(need.urgency)
					}
					tone={urgencyTone(need.urgency)}
				/>
				{need.status !== "OPEN" && (
					<StatusPill label={humanizeStatus(need.status)} tone="neutral" />
				)}
			</View>

			<Body weight="bold" numberOfLines={1}>
				{need.title}
			</Body>
			<Caption color="tertiary" numberOfLines={2} style={{ marginTop: 2 }}>
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
				<Caption color="quaternary">{formatRelative(need.createdAt)}</Caption>
			</View>

			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					marginTop: spacing[3],
					paddingTop: spacing[3],
					borderTopWidth: 1,
					borderTopColor: colors.border.light,
				}}
			>
				<Caption
					weight={need.pendingPledges > 0 ? "medium" : "normal"}
					color={
						need.pendingPledges > 0
							? (colors.primary.main as string)
							: "quaternary"
					}
				>
					{need.pendingPledges > 0
						? `${need.pendingPledges} awaiting review`
						: "View responses"}
				</Caption>
				<View style={{ flexDirection: "row", gap: spacing[4] }}>
					<Pressable onPress={onEdit} hitSlop={8}>
						<Caption weight="medium" color="secondary">
							Edit
						</Caption>
					</Pressable>
					<Pressable onPress={onDelete} hitSlop={8}>
						<Caption weight="medium" color={colors.error.main as string}>
							Remove
						</Caption>
					</Pressable>
				</View>
			</View>
		</Surface>
	);
}
