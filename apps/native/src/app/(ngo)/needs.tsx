import type { NeedType, OrgNeedQuery } from "@nabhya/shared";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { HeartHandshake } from "lucide-react-native";
import { useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { LoadMoreFooter } from "@/components/load-more-footer";
import { NeedFormSheet } from "@/components/need-form-sheet";
import { PledgesSheet } from "@/components/pledges-sheet";
import {
	Banner,
	EmptyState,
	ErrorState,
	FilterChips,
	GridCell,
	LoadingState,
	Screen,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import { humanizeStatus, StatusPill } from "@/components/status-pill";
import { TextAction } from "@/components/text-action";
import { Button } from "@/components/ui/button";
import { confirm, toast } from "@/components/ui/overlay";
import { Body, Caption, Label } from "@/components/ui/typography";
import { useDeleteNeed } from "@/hooks/use-needs";
import { useMe } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { useGridColumns } from "@/hooks/useMedia";
import { apiErrorMessage, orgNeedsApi, queryKeys } from "@/lib/api";
import { formatProgress, formatRelative } from "@/lib/format";
import { verticalScrollbar } from "@/lib/scroll";
import type { OrgNeedListItem } from "@/lib/types";

type TypeFilter = "ALL" | NeedType;

const FILTERS: Array<{ value: TypeFilter; label: string }> = [
	{ value: "ALL", label: "All" },
	{ value: "WANT", label: "We need" },
	{ value: "OFFER", label: "We're giving" },
];

const PAGE_SIZE = 20;

/**
 * The org's needs, page by page. Shares the `["org","needs"]` prefix with
 * `useOrgNeeds` so every needs mutation invalidates it too; the `paged` marker
 * keeps its cache shape apart from the page-1 query the dashboard reads.
 */
function useOrgNeedPages(filters: Partial<OrgNeedQuery>) {
	return useInfiniteQuery({
		queryKey: queryKeys.orgNeeds({ ...filters, paged: true }),
		queryFn: ({ pageParam }) =>
			orgNeedsApi.list({ ...filters, page: pageParam, limit: PAGE_SIZE }),
		initialPageParam: 1,
		getNextPageParam: (last) =>
			last.meta.hasMore ? last.meta.page + 1 : undefined,
	});
}

export default function NgoNeeds() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const [filter, setFilter] = useState<TypeFilter>("ALL");
	const [sheetOpen, setSheetOpen] = useState(false);
	const [editing, setEditing] = useState<OrgNeedListItem | null>(null);
	const [reviewing, setReviewing] = useState<OrgNeedListItem | null>(null);
	const { data: me } = useMe();

	const query = useOrgNeedPages(filter === "ALL" ? {} : { type: filter });
	const deleteNeed = useDeleteNeed();
	const columns = useGridColumns();

	const isVerified = me?.organization?.verificationStatus === "VERIFIED";
	const items = query.data?.pages.flatMap((page) => page.items) ?? [];
	const total = query.data?.pages[0]?.meta.total ?? items.length;

	const loadMore = () => {
		if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
	};

	const confirmDelete = async (need: OrgNeedListItem) => {
		const ok = await confirm({
			title: "Remove this post?",
			message: `"${need.title}" will be removed. A post with accepted pledges is closed instead of deleted, so the people who pledged keep their record of it.`,
			confirmLabel: "Remove",
		});
		if (!ok) return;
		deleteNeed.mutate(need.id, {
			onSuccess: () => toast.success("Post removed."),
			onError: (error) => toast.error(apiErrorMessage(error)),
		});
	};

	const openCreate = () => setSheetOpen(true);

	return (
		<Screen>
			<ScreenHeader
				title="Needs"
				subtitle={
					total > 0 ? `${total} post${total === 1 ? "" : "s"}` : undefined
				}
				action={
					isVerified ? (
						<Button size="sm" onPress={openCreate}>
							New need
						</Button>
					) : undefined
				}
			/>

			{!isVerified && (
				<View style={{ marginBottom: spacing[4] }}>
					<Banner
						tone="warning"
						title="Verification needed to post"
						description="Needs and offers go into every volunteer's feed, so they unlock once your documents are approved."
						onPress={() => router.push("/(ngo)/verification")}
					/>
				</View>
			)}

			<FilterChips options={FILTERS} value={filter} onChange={setFilter} />

			{query.isLoading ? (
				<LoadingState label="Loading your posts" />
			) : query.isError ? (
				<ErrorState
					message={apiErrorMessage(query.error)}
					onRetry={() => query.refetch()}
				/>
			) : (
				<FlatList
					key={`grid-${columns}`}
					numColumns={columns}
					columnWrapperStyle={columns > 1 ? { gap: spacing[3] } : undefined}
					data={items}
					keyExtractor={(item) => item.id}
					{...verticalScrollbar}
					contentContainerStyle={{ paddingBottom: spacing[10] }}
					ItemSeparatorComponent={() => <View style={{ height: spacing[3] }} />}
					onEndReached={loadMore}
					onEndReachedThreshold={0.5}
					refreshControl={
						<RefreshControl
							refreshing={query.isRefetching && !query.isFetchingNextPage}
							onRefresh={() => query.refetch()}
							tintColor={colors.text.quaternary as string}
						/>
					}
					ListEmptyComponent={
						<EmptyState
							icon={HeartHandshake}
							title={
								filter === "ALL"
									? "Nothing posted yet"
									: filter === "WANT"
										? "No requests yet"
										: "No offers yet"
							}
							description={
								isVerified
									? "Ask for what your programme needs, or list surplus you can pass on. Each post shows here with its pledges."
									: "Once you're verified you'll be able to post here."
							}
							action={
								isVerified ? (
									<Button onPress={openCreate}>
										{filter === "OFFER" ? "Offer something" : "Post a need"}
									</Button>
								) : undefined
							}
						/>
					}
					ListFooterComponent={
						<LoadMoreFooter
							hasMore={!!query.hasNextPage}
							loading={query.isFetchingNextPage}
							onLoadMore={loadMore}
							count={items.length}
							noun="posts"
						/>
					}
					renderItem={({ item }) => (
						<GridCell>
							<NeedRow
								need={item}
								onReview={() => setReviewing(item)}
								onEdit={() => setEditing(item)}
								onDelete={() => confirmDelete(item)}
							/>
						</GridCell>
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
		</Screen>
	);
}

/**
 * One post. Tapping the card opens its responses — that is the decision this
 * screen exists for. Edit and Remove sit quietly in the footer.
 */
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
	const pending = need.pendingPledges ?? 0;

	return (
		<Surface onPress={onReview}>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[2],
					marginBottom: spacing[2.5],
				}}
			>
				<StatusPill
					label={need.type === "WANT" ? "We need" : "We're giving"}
					tone={need.type === "WANT" ? "info" : "success"}
				/>
				{need.urgency === "HIGH" && <StatusPill label="Urgent" tone="error" />}
				{need.status !== "OPEN" && (
					<StatusPill label={humanizeStatus(need.status)} tone="neutral" />
				)}
				<View style={{ flex: 1 }} />
				<Caption color="quaternary">{formatRelative(need.createdAt)}</Caption>
			</View>

			<Body weight="bold" numberOfLines={1}>
				{need.title}
			</Body>
			<Caption
				color="tertiary"
				numberOfLines={2}
				style={{ marginTop: spacing[0.5] }}
			>
				{need.description}
			</Caption>

			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					gap: spacing[3],
					marginTop: spacing[3],
					paddingTop: spacing[3],
					borderTopWidth: 1,
					borderTopColor: colors.border.hairline,
				}}
			>
				<View style={{ flex: 1, minWidth: 0 }}>
					<Label numberOfLines={1}>
						{formatProgress(need.fulfilledQuantity, need.quantity, need.unit)}
					</Label>
					<Caption
						weight={pending > 0 ? "medium" : "normal"}
						color={pending > 0 ? (colors.warning.ink as string) : "quaternary"}
						numberOfLines={1}
					>
						{pending > 0
							? `${pending} pledge${pending === 1 ? "" : "s"} to review`
							: "Tap to see responses"}
					</Caption>
				</View>
				<View style={{ flexDirection: "row", gap: spacing[3] }}>
					<TextAction
						label="Edit"
						onPress={onEdit}
						accessibilityLabel={`Edit ${need.title}`}
					/>
					<TextAction
						label="Remove"
						tone="danger"
						onPress={onDelete}
						accessibilityLabel={`Remove ${need.title}`}
					/>
				</View>
			</View>
		</Surface>
	);
}
