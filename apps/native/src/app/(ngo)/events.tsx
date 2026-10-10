import type { EventStatus, OrgEventQuery, OrgEventSort } from "@nabhya/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CalendarDays } from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { ConsoleList } from "@/components/admin/console-list";
import type { TableColumn, TableSort } from "@/components/admin/data-table";
import { AdminScreen } from "@/components/admin/list-chrome";
import { SelectMenu, type SelectOption } from "@/components/admin/select-menu";
import { Toolbar, useTableView } from "@/components/admin/toolbar";
import { ApplicantsSheet } from "@/components/applicants-sheet";
import { EventFormSheet } from "@/components/event-form-sheet";
import { PendingCount, RowActions } from "@/components/ngo/table-cells";
import { PagedList, usePagedQuery } from "@/components/paged-list";
import {
	Banner,
	EmptyState,
	FilterChips,
	Screen,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import {
	eventStatusTone,
	humanizeStatus,
	StatusPill,
} from "@/components/status-pill";
import { TextAction } from "@/components/text-action";
import { Button } from "@/components/ui/button";
import { confirm, toast } from "@/components/ui/overlay";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption, Label } from "@/components/ui/typography";
import { useDeleteEvent, useOrgEvent } from "@/hooks/use-events";
import { useOrgAccess } from "@/hooks/use-org-access";
import { useMe } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { useGridColumns, useMedia } from "@/hooks/useMedia";
import { apiErrorMessage, orgEventsApi, queryKeys } from "@/lib/api";
import { focusable } from "@/lib/focus";
import { formatDateRange } from "@/lib/format";
import type { OrgEventListItem } from "@/lib/types";

type StatusFilter = "ALL" | EventStatus;

const FILTERS: Array<SelectOption<StatusFilter>> = [
	{ value: "ALL", label: "All" },
	{ value: "PUBLISHED", label: "Published", hint: "Open to volunteers" },
	{ value: "DRAFT", label: "Drafts", hint: "Only your team can see these" },
	{ value: "COMPLETED", label: "Past", hint: "Attendance and certificates" },
	{ value: "CANCELLED", label: "Cancelled" },
];

/**
 * The organisation's events.
 *
 * Two shapes, chosen by the window rather than by a setting:
 *
 * - **Phone: the cards.** One event per card with its fill bar, tapped to open
 *   the applicants - a phone is used to act on one event, not to compare them.
 * - **Desktop: the console's table** (`AdminScreen` + `ConsoleList`, the same
 *   pieces the superadmin uses). An NGO running twenty events wants to answer
 *   "which one has people waiting" and "which is short of volunteers", and a
 *   card puts that number at a different place in every box. A column puts it
 *   in one place, and a sortable header puts the answer at the top. The status
 *   filter is a `SelectMenu`, not a chip row, for the reason `toolbar.tsx`
 *   gives; the page is the one scroller, so the header row sticks under it.
 *
 * Sorting is a server round trip (`sort`/`dir` on `orgEventQuerySchema`): the
 * list pages at 20, so a browser re-sort would order a page, not the list. The
 * phone sends the same default the server would apply, so both shapes share a
 * cache entry until someone on desktop presses a header.
 */
export default function NgoEvents() {
	const { spacing } = useTheme();
	const router = useRouter();
	const { isDesktop } = useMedia();
	const [filter, setFilter] = useState<StatusFilter>("ALL");
	const [sort, setSort] = useState<TableSort<OrgEventSort>>({
		sort: "startAt",
		dir: "desc",
	});
	const [view, setView] = useTableView("ngo-events");
	const [formOpen, setFormOpen] = useState(false);
	const [editing, setEditing] = useState<OrgEventListItem | null>(null);
	const [reviewing, setReviewing] = useState<OrgEventListItem | null>(null);
	const { data: me } = useMe();
	const access = useOrgAccess();

	const filters: Partial<OrgEventQuery> = {
		...(filter === "ALL" ? {} : { status: filter }),
		sort: sort.sort,
		dir: sort.dir,
	};
	// Under the `["org","events"]` prefix, so every event mutation refreshes it.
	const { query, items, first, loadMore } = usePagedQuery({
		queryKey: queryKeys.orgEvents(filters),
		fetchPage: (page) => orgEventsApi.list({ ...filters, page, limit: 20 }),
	});
	const deleteEvent = useDeleteEvent();
	const columns = useGridColumns();

	const total = first?.meta.total ?? items.length;

	// `?review=<eventId>` - a "new applicant" notification opens that event's
	// applicants straight away. The row may be past the first page, so fall
	// back to the event's own record. The param is cleared once used, so
	// closing the sheet does not reopen it.
	const { review } = useLocalSearchParams<{ review?: string }>();
	const reviewRow = review ? items.find((item) => item.id === review) : null;
	const reviewDetail = useOrgEvent(review && !reviewRow ? review : undefined);
	useEffect(() => {
		if (!review) return;
		const detail = reviewDetail.data;
		const target: OrgEventListItem | null =
			reviewRow ??
			(detail
				? {
						id: detail.id,
						title: detail.title,
						city: detail.city,
						state: detail.state,
						startAt: detail.startAt,
						endAt: detail.endAt,
						status: detail.status,
						isUrgent: detail.isUrgent,
						volunteersNeeded: detail.volunteersNeeded,
						acceptedCount: detail.acceptedCount,
						coverImage: null,
						createdAt: detail.startAt,
						pendingApplications: 0,
					}
				: null);
		if (!target) return;
		setReviewing(target);
		router.setParams({ review: undefined });
	}, [review, reviewRow, reviewDetail.data, router]);
	// The sheet's "places left" reads the row as it is now, not as it was when
	// the sheet opened - accepting someone refetches the list.
	const reviewingLive =
		(reviewing && items.find((item) => item.id === reviewing.id)) ?? reviewing;
	// Mirrors `EventsService`: drafts are open to everyone but viewers, and
	// anything live - publishing it, or editing it once published - needs
	// content.publish (plus verification to go public).
	const canDraft = !access.isSuspended && access.role !== "VIEWER";
	const publishBlocked = access.blocked("content.publish", { public: true });
	const canEditLive = !access.blocked("content.publish");
	const canRemove = !access.blocked("content.delete");
	const canEdit = (event: OrgEventListItem) =>
		event.status === "DRAFT" ? canDraft : canEditLive;

	const confirmDelete = async (event: OrgEventListItem) => {
		// An event with accepted volunteers is cancelled, not deleted - the
		// server keeps it so their applications and certificates survive - so
		// the wording and the button both have to say which one is happening.
		const cancelling = event.acceptedCount > 0;
		const ok = await confirm({
			title: cancelling ? "Cancel this event?" : "Delete this event?",
			message: cancelling
				? `${event.acceptedCount} volunteer${event.acceptedCount === 1 ? " has" : "s have"} already been accepted, so "${event.title}" will be cancelled rather than deleted. They will be notified.`
				: `"${event.title}" will be deleted. This cannot be undone.`,
			confirmLabel: cancelling ? "Cancel event" : "Delete",
		});
		if (!ok) return;
		deleteEvent.mutate(event.id, {
			onSuccess: () =>
				toast.success(cancelling ? "Event cancelled." : "Event deleted."),
			onError: (error) => toast.error(apiErrorMessage(error)),
		});
	};

	const openCreate = () => setFormOpen(true);

	const subtitle =
		total > 0 ? `${total} event${total === 1 ? "" : "s"}` : undefined;
	const newEvent = (
		<Button size="sm" onPress={openCreate} disabled={!canDraft}>
			New event
		</Button>
	);

	const banner = publishBlocked ? (
		<View style={{ marginBottom: spacing[4] }}>
			{!access.isVerified && !access.isSuspended ? (
				<Banner
					tone="warning"
					title="Drafts only until you're verified"
					description="You can plan events now. Publishing them to volunteers unlocks once your documents are approved."
					onPress={() => router.push("/(ngo)/verification")}
				/>
			) : (
				<Banner
					tone="info"
					title={canDraft ? "Drafts only" : "View only"}
					description={publishBlocked}
				/>
			)}
		</View>
	) : null;

	const renderCard = (item: OrgEventListItem) => (
		<EventRow
			event={item}
			onReview={() => setReviewing(item)}
			onEdit={canEdit(item) ? () => setEditing(item) : undefined}
			onDelete={canRemove ? () => confirmDelete(item) : undefined}
		/>
	);

	const empty = (
		<EmptyState
			icon={CalendarDays}
			title={
				filter === "DRAFT"
					? "No drafts"
					: filter === "COMPLETED"
						? "No past events yet"
						: filter === "PUBLISHED"
							? "Nothing published yet"
							: filter === "CANCELLED"
								? "Nothing cancelled"
								: "No events yet"
			}
			description={
				filter === "COMPLETED"
					? "Events move here once they finish. You can still mark attendance and issue certificates."
					: "Each event lists here with how many places are filled and who is waiting for a decision."
			}
			action={
				filter === "COMPLETED" ||
				filter === "CANCELLED" ||
				!canDraft ? undefined : (
					<Button onPress={openCreate}>Create an event</Button>
				)
			}
		/>
	);

	const sheets = (
		<>
			<EventFormSheet
				visible={formOpen || !!editing}
				event={editing}
				onClose={() => {
					setFormOpen(false);
					setEditing(null);
				}}
				defaultCity={me?.organization?.city}
				defaultState={me?.organization?.state}
				publishBlockedReason={publishBlocked}
			/>

			<ApplicantsSheet
				eventId={reviewingLive?.id ?? null}
				eventTitle={reviewingLive?.title ?? ""}
				remainingPlaces={
					reviewingLive
						? reviewingLive.volunteersNeeded - reviewingLive.acceptedCount
						: 0
				}
				onClose={() => setReviewing(null)}
			/>
		</>
	);

	if (isDesktop) {
		return (
			<AdminScreen
				title="Events"
				subtitle={subtitle}
				action={newEvent}
				toolbar={
					<Toolbar view={view} onViewChange={setView}>
						<SelectMenu
							label="Status"
							value={filter}
							options={FILTERS}
							onChange={setFilter}
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
					noun="event"
					view={view}
					columns={eventColumns({
						canEdit,
						canRemove,
						onEdit: setEditing,
						onDelete: confirmDelete,
					})}
					rowKey={(event) => event.id}
					// The row opens its applicants, as the card does - that is the
					// decision this screen exists for.
					onRowPress={(event) => setReviewing(event)}
					sort={sort}
					onSortChange={setSort}
					loadingLabel="Loading your events"
					renderCard={renderCard}
					empty={empty}
				/>
				{sheets}
			</AdminScreen>
		);
	}

	return (
		<Screen>
			<ScreenHeader title="Events" subtitle={subtitle} action={newEvent} />

			{banner}

			<FilterChips options={FILTERS} value={filter} onChange={setFilter} />

			<PagedList
				query={query}
				items={items}
				loadMore={loadMore}
				loadingLabel="Loading your events"
				numColumns={columns}
				noun="events"
				keyExtractor={(item) => item.id}
				renderItem={renderCard}
				empty={empty}
			/>

			{sheets}
		</Screen>
	);
}

/**
 * The desktop table's columns. The identity column flexes; everything you
 * compare down the page - when, how full, how many waiting - is a fixed,
 * sortable column. Edit and Remove stay on the row, as on the card, and are
 * dropped (not disabled) for a role that cannot use them.
 */
function eventColumns({
	canEdit,
	canRemove,
	onEdit,
	onDelete,
}: {
	canEdit: (event: OrgEventListItem) => boolean;
	canRemove: boolean;
	onEdit: (event: OrgEventListItem) => void;
	onDelete: (event: OrgEventListItem) => void;
}): Array<TableColumn<OrgEventListItem>> {
	return [
		{
			key: "title",
			header: "Event",
			sortKey: "title",
			minWidth: 220,
			render: (event) => (
				<View style={{ minWidth: 0, alignSelf: "stretch" }}>
					<Body weight="medium" numberOfLines={1}>
						{event.title}
					</Body>
					{event.city && (
						<Caption color="quaternary" numberOfLines={1}>
							{event.city}
						</Caption>
					)}
				</View>
			),
		},
		{
			key: "status",
			header: "Status",
			sortKey: "status",
			width: 116,
			render: (event) => (
				<StatusPill
					label={humanizeStatus(event.status)}
					tone={eventStatusTone(event.status)}
				/>
			),
		},
		{
			key: "when",
			header: "When",
			sortKey: "startAt",
			width: 190,
			render: (event) => (
				<Caption color="tertiary" numberOfLines={2}>
					{formatDateRange(event.startAt, event.endAt)}
				</Caption>
			),
		},
		{
			key: "filled",
			header: "Volunteers",
			sortKey: "accepted",
			width: 104,
			align: "end",
			render: (event) => (
				<Caption color="tertiary">
					{event.acceptedCount} of {event.volunteersNeeded}
				</Caption>
			),
		},
		{
			key: "pending",
			header: "To review",
			sortKey: "pending",
			width: 96,
			align: "end",
			render: (event) => <PendingCount count={event.pendingApplications} />,
		},
		{
			key: "actions",
			header: "",
			width: 150,
			align: "end",
			render: (event) => (
				<RowActions
					onEdit={canEdit(event) ? () => onEdit(event) : undefined}
					editLabel={event.status === "DRAFT" ? "Edit & publish" : "Edit"}
					editTone={event.status === "DRAFT" ? "brand" : "default"}
					onDelete={canRemove ? () => onDelete(event) : undefined}
					name={event.title}
				/>
			),
		},
	];
}

/**
 * One event. Tapping the card opens its applicants - the decision this screen
 * exists for. The fact that matters is one line: places filled, and how many
 * people are waiting.
 */
function EventRow({
	event,
	onReview,
	onEdit,
	onDelete,
}: {
	event: OrgEventListItem;
	onReview: () => void;
	/** Omitted when the viewer's team role cannot change this event. */
	onEdit?: () => void;
	onDelete?: () => void;
}) {
	const { colors, spacing } = useTheme();
	const filled = event.volunteersNeeded
		? Math.min(event.acceptedCount / event.volunteersNeeded, 1)
		: 0;
	const pending = event.pendingApplications ?? 0;

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
						accessibilityLabel={`See applicants for ${event.title}`}
						{...focusable}
						style={{ flex: 1, minWidth: 0 }}
					>
						<Label numberOfLines={1}>
							{event.acceptedCount} of {event.volunteersNeeded} volunteers
						</Label>
						<Caption
							weight={pending > 0 ? "medium" : "normal"}
							color={
								pending > 0 ? (colors.warning.ink as string) : "quaternary"
							}
							numberOfLines={1}
						>
							{pending > 0
								? `${pending} applicant${pending === 1 ? "" : "s"} waiting`
								: "Tap to see applicants"}
						</Caption>
					</Pressable>
					<View style={{ flexDirection: "row", gap: spacing[3] }}>
						{onEdit && (
							<TextAction
								label={event.status === "DRAFT" ? "Edit & publish" : "Edit"}
								tone={event.status === "DRAFT" ? "brand" : "default"}
								onPress={onEdit}
								accessibilityLabel={`Edit ${event.title}`}
							/>
						)}
						{onDelete && (
							<TextAction
								label="Remove"
								tone="danger"
								onPress={onDelete}
								accessibilityLabel={`Remove ${event.title}`}
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
					label={humanizeStatus(event.status)}
					tone={eventStatusTone(event.status)}
				/>
				{pending > 0 && (
					<StatusPill label={`${pending} to review`} tone="warning" />
				)}
			</View>

			<Body weight="bold" numberOfLines={1}>
				{event.title}
			</Body>
			<Caption color="tertiary" style={{ marginTop: spacing[0.5] }}>
				{formatDateRange(event.startAt, event.endAt)}
				{event.city ? ` · ${event.city}` : ""}
			</Caption>

			<View
				accessible
				accessibilityRole="progressbar"
				accessibilityLabel={`${event.acceptedCount} of ${event.volunteersNeeded} volunteers confirmed`}
				accessibilityValue={{
					min: 0,
					max: event.volunteersNeeded,
					now: event.acceptedCount,
				}}
				style={{
					height: 4,
					borderRadius: 2,
					marginTop: spacing[3],
					backgroundColor: colors.background.tertiary,
					overflow: "hidden",
				}}
			>
				<View
					style={{
						width: `${filled * 100}%`,
						height: "100%",
						backgroundColor:
							filled >= 1 ? colors.success.main : colors.primary.main,
					}}
				/>
			</View>
		</Surface>
	);
}
