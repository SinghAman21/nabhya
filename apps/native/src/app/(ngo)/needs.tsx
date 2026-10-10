import type {
	NeedStatus,
	NeedType,
	OrgNeedQuery,
	OrgNeedSort,
} from "@nabhya/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import { HeartHandshake } from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { ConsoleList } from "@/components/admin/console-list";
import type { TableColumn, TableSort } from "@/components/admin/data-table";
import { AdminScreen } from "@/components/admin/list-chrome";
import { SelectMenu, type SelectOption } from "@/components/admin/select-menu";
import { Toolbar, useTableView } from "@/components/admin/toolbar";
import { NeedFormSheet } from "@/components/need-form-sheet";
import { PendingCount, RowActions } from "@/components/ngo/table-cells";
import { PagedList, usePagedQuery } from "@/components/paged-list";
import { PledgesSheet } from "@/components/pledges-sheet";
import {
	Banner,
	EmptyState,
	FilterChips,
	Screen,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import { humanizeStatus, StatusPill } from "@/components/status-pill";
import { TextAction } from "@/components/text-action";
import { Button } from "@/components/ui/button";
import { confirm, toast } from "@/components/ui/overlay";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption, Label } from "@/components/ui/typography";
import { useDeleteNeed, usePublicNeed } from "@/hooks/use-needs";
import { useOrgAccess } from "@/hooks/use-org-access";
import { useMe } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { useGridColumns, useMedia } from "@/hooks/useMedia";
import { apiErrorMessage, orgNeedsApi, queryKeys } from "@/lib/api";
import { focusable } from "@/lib/focus";
import { formatDate, formatProgress, formatRelative } from "@/lib/format";
import type { OrgNeedListItem } from "@/lib/types";

type TypeFilter = "ALL" | NeedType;
type StatusFilter = "ANY" | NeedStatus;

const FILTERS: Array<SelectOption<TypeFilter>> = [
	{ value: "ALL", label: "All" },
	{ value: "WANT", label: "We need", hint: "Asking for something" },
	{ value: "OFFER", label: "We're giving", hint: "Surplus you can pass on" },
];

/**
 * Desktop only - the endpoint has always taken `status`, and on a page of
 * forty posts "which are still open" is the second question after "which
 * kind". A separate axis from type, so a second select rather than more chips.
 */
const STATUSES: Array<SelectOption<StatusFilter>> = [
	{ value: "ANY", label: "Any" },
	{ value: "OPEN", label: "Open", hint: "Taking pledges" },
	{ value: "FULFILLED", label: "Fulfilled" },
	{ value: "CLOSED", label: "Closed" },
];

/**
 * The organisation's needs and offers.
 *
 * Phones keep the cards. Desktop gets the console's table (`AdminScreen` +
 * `ConsoleList`): how far along each post is, and how many pledges are
 * waiting on a decision, are numbers to compare down a column, and a sortable
 * header answers "what needs me" without reading every card. Sorting is a
 * server round trip (`orgNeedQuerySchema`), because the list pages at 20.
 * See `(ngo)/events.tsx`, which has the same two shapes.
 */
export default function NgoNeeds() {
	const { spacing } = useTheme();
	const router = useRouter();
	const { isDesktop } = useMedia();
	const [filter, setFilter] = useState<TypeFilter>("ALL");
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("ANY");
	const [sort, setSort] = useState<TableSort<OrgNeedSort>>({
		sort: "createdAt",
		dir: "desc",
	});
	const [view, setView] = useTableView("ngo-needs");
	const [sheetOpen, setSheetOpen] = useState(false);
	const [editing, setEditing] = useState<OrgNeedListItem | null>(null);
	const [reviewing, setReviewing] = useState<OrgNeedListItem | null>(null);
	const { data: me } = useMe();
	const access = useOrgAccess();

	const filters: Partial<OrgNeedQuery> = {
		...(filter === "ALL" ? {} : { type: filter }),
		// Never set on a phone, which has no status control.
		...(statusFilter === "ANY" ? {} : { status: statusFilter }),
		sort: sort.sort,
		dir: sort.dir,
	};
	// Under the `["org","needs"]` prefix, so every needs mutation refreshes it.
	const { query, items, first, loadMore } = usePagedQuery({
		queryKey: queryKeys.orgNeeds(filters),
		fetchPage: (page) => orgNeedsApi.list({ ...filters, page, limit: 20 }),
	});
	const deleteNeed = useDeleteNeed();
	const columns = useGridColumns();

	const total = first?.meta.total ?? items.length;

	// `?review=<needId>` - a "new pledge" notification opens that post's
	// responses. Falls back to the need's public record (pledges only exist on
	// a verified NGO's needs, so it is always visible) when the row is past
	// the first page. Cleared once used.
	const { review } = useLocalSearchParams<{ review?: string }>();
	const reviewRow = review ? items.find((item) => item.id === review) : null;
	const reviewDetail = usePublicNeed(review && !reviewRow ? review : undefined);
	useEffect(() => {
		if (!review) return;
		const detail = reviewDetail.data;
		const target: OrgNeedListItem | null =
			reviewRow ?? (detail ? { ...detail, pendingPledges: 0 } : null);
		if (!target) return;
		setReviewing(target);
		router.setParams({ review: undefined });
	}, [review, reviewRow, reviewDetail.data, router]);
	// The sheet's progress line reads the row as it is now: accepting a
	// pledge refetches the list.
	const reviewingLive =
		(reviewing && items.find((item) => item.id === reviewing.id)) ?? reviewing;
	// Posting is public and needs verification; editing and removing a post
	// that already exists only need the role.
	const createBlocked = access.blocked("content.publish", { public: true });
	const canEdit = !access.blocked("content.publish");
	const canRemove = !access.blocked("content.delete");

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

	const subtitle =
		total > 0 ? `${total} post${total === 1 ? "" : "s"}` : undefined;
	const newNeed = (
		<Button size="sm" onPress={openCreate} disabled={!!createBlocked}>
			New need
		</Button>
	);

	const banner = createBlocked ? (
		<View style={{ marginBottom: spacing[4] }}>
			{access.isVerified || access.isSuspended ? (
				<Banner tone="info" title="View only" description={createBlocked} />
			) : (
				<Banner
					tone="warning"
					title="Verification needed to post"
					description="Needs and offers go into every volunteer's feed, so they unlock once your documents are approved."
					onPress={() => router.push("/(ngo)/verification")}
				/>
			)}
		</View>
	) : null;

	const renderCard = (item: OrgNeedListItem) => (
		<NeedRow
			need={item}
			onReview={() => setReviewing(item)}
			onEdit={canEdit ? () => setEditing(item) : undefined}
			onDelete={canRemove ? () => confirmDelete(item) : undefined}
		/>
	);

	const filtered = statusFilter !== "ANY";
	const empty = (
		<EmptyState
			icon={HeartHandshake}
			title={
				filtered
					? `No ${statusFilter.toLowerCase()} posts`
					: filter === "ALL"
						? "Nothing posted yet"
						: filter === "WANT"
							? "No requests yet"
							: "No offers yet"
			}
			description={
				createBlocked || filtered
					? "Posts your team makes will show here with their pledges."
					: "Ask for what your programme needs, or list surplus you can pass on. Each post shows here with its pledges."
			}
			action={
				createBlocked || filtered ? undefined : (
					<Button onPress={openCreate}>
						{filter === "OFFER" ? "Offer something" : "Post a need"}
					</Button>
				)
			}
		/>
	);

	const sheets = (
		<>
			<PledgesSheet need={reviewingLive} onClose={() => setReviewing(null)} />

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
		</>
	);

	if (isDesktop) {
		return (
			<AdminScreen
				title="Needs"
				subtitle={subtitle}
				action={newNeed}
				toolbar={
					<Toolbar view={view} onViewChange={setView}>
						<SelectMenu
							label="Type"
							value={filter}
							options={FILTERS}
							onChange={setFilter}
						/>
						<SelectMenu
							label="Status"
							value={statusFilter}
							options={STATUSES}
							onChange={setStatusFilter}
							minWidth={180}
						/>
					</Toolbar>
				}
				onNearEnd={loadMore}
				refreshing={query.isRefetching && !query.isFetchingNextPage}
				onRefresh={() => query.refetch()}
			>
				{banner}
				<ConsoleList
					query={query}
					items={items}
					total={total}
					loadMore={loadMore}
					noun="post"
					view={view}
					columns={needColumns({
						onEdit: canEdit ? setEditing : undefined,
						onDelete: canRemove ? confirmDelete : undefined,
					})}
					rowKey={(need) => need.id}
					// Opens the pledges, as the card does.
					onRowPress={(need) => setReviewing(need)}
					sort={sort}
					onSortChange={setSort}
					loadingLabel="Loading your posts"
					renderCard={renderCard}
					empty={empty}
				/>
				{sheets}
			</AdminScreen>
		);
	}

	return (
		<Screen>
			<ScreenHeader title="Needs" subtitle={subtitle} action={newNeed} />

			{banner}

			<FilterChips options={FILTERS} value={filter} onChange={setFilter} />

			<PagedList
				query={query}
				items={items}
				loadMore={loadMore}
				loadingLabel="Loading your posts"
				numColumns={columns}
				noun="posts"
				keyExtractor={(item) => item.id}
				renderItem={renderCard}
				empty={empty}
			/>

			{sheets}
		</Screen>
	);
}

/**
 * The desktop table's columns: the post flexes, and progress, pledges waiting,
 * urgency and age are fixed, sortable columns. Type and a non-open status are
 * pills - the only colour in the row, as in the console.
 */
function needColumns({
	onEdit,
	onDelete,
}: {
	/** Undefined when the viewer's role cannot change posts. */
	onEdit?: (need: OrgNeedListItem) => void;
	onDelete?: (need: OrgNeedListItem) => void;
}): Array<TableColumn<OrgNeedListItem>> {
	return [
		{
			key: "title",
			header: "Post",
			sortKey: "title",
			minWidth: 240,
			render: (need) => (
				<View style={{ minWidth: 0, alignSelf: "stretch" }}>
					<Body weight="medium" numberOfLines={1}>
						{need.title}
					</Body>
					<Caption color="quaternary" numberOfLines={1}>
						{need.description}
					</Caption>
				</View>
			),
		},
		{
			key: "type",
			header: "Type",
			width: 120,
			render: (need) => (
				<StatusPill
					label={need.type === "WANT" ? "We need" : "We're giving"}
					tone={need.type === "WANT" ? "info" : "success"}
				/>
			),
		},
		{
			key: "status",
			header: "Status",
			sortKey: "status",
			width: 104,
			render: (need) =>
				need.status === "OPEN" ? (
					<Caption color="quaternary">Open</Caption>
				) : (
					<StatusPill label={humanizeStatus(need.status)} tone="neutral" />
				),
		},
		{
			key: "progress",
			header: "Progress",
			sortKey: "fulfilled",
			width: 150,
			align: "end",
			render: (need) => (
				<Caption color="tertiary" numberOfLines={1}>
					{formatProgress(need.fulfilledQuantity, need.quantity, need.unit)}
				</Caption>
			),
		},
		{
			key: "pending",
			header: "To review",
			sortKey: "pending",
			width: 96,
			align: "end",
			render: (need) => <PendingCount count={need.pendingPledges} />,
		},
		{
			key: "urgency",
			header: "Urgency",
			sortKey: "urgency",
			width: 96,
			wideOnly: true,
			render: (need) =>
				need.urgency === "HIGH" ? (
					<StatusPill label="Urgent" tone="error" />
				) : (
					<Caption color="quaternary">{humanizeStatus(need.urgency)}</Caption>
				),
		},
		{
			key: "posted",
			header: "Posted",
			sortKey: "createdAt",
			width: 104,
			align: "end",
			render: (need) => (
				<Caption color="quaternary">{formatDate(need.createdAt)}</Caption>
			),
		},
		{
			key: "actions",
			header: "",
			width: 120,
			align: "end",
			render: (need) => (
				<RowActions
					name={need.title}
					{...(onEdit ? { onEdit: () => onEdit(need) } : {})}
					{...(onDelete ? { onDelete: () => onDelete(need) } : {})}
				/>
			),
		},
	];
}

/**
 * One post. Tapping the card opens its responses - that is the decision this
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
	/** Omitted when the viewer's team role cannot change the post. */
	onEdit?: () => void;
	onDelete?: () => void;
}) {
	const { colors, spacing } = useTheme();
	const pending = need.pendingPledges ?? 0;

	return (
		<Surface
			onPress={onReview}
			footer={
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
					<Pressable
						onPress={onReview}
						accessibilityRole="button"
						accessibilityLabel={`See responses to ${need.title}`}
						{...focusable}
						style={{ flex: 1, minWidth: 0 }}
					>
						<Label numberOfLines={1}>
							{formatProgress(need.fulfilledQuantity, need.quantity, need.unit)}
						</Label>
						<Caption
							weight={pending > 0 ? "medium" : "normal"}
							color={
								pending > 0 ? (colors.warning.ink as string) : "quaternary"
							}
							numberOfLines={1}
						>
							{pending > 0
								? `${pending} pledge${pending === 1 ? "" : "s"} to review`
								: "Tap to see responses"}
						</Caption>
					</Pressable>
					<View style={{ flexDirection: "row", gap: spacing[3] }}>
						{onEdit && (
							<TextAction
								label="Edit"
								onPress={onEdit}
								accessibilityLabel={`Edit ${need.title}`}
							/>
						)}
						{onDelete && (
							<TextAction
								label="Remove"
								tone="danger"
								onPress={onDelete}
								accessibilityLabel={`Remove ${need.title}`}
							/>
						)}
					</View>
				</View>
			}
		>
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
		</Surface>
	);
}
