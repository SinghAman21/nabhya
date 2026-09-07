import type { EventStatus, OrgEventQuery } from "@nabhya/shared";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { CalendarDays } from "lucide-react-native";
import { useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { ApplicantsSheet } from "@/components/applicants-sheet";
import { EventFormSheet } from "@/components/event-form-sheet";
import { LoadMoreFooter } from "@/components/load-more-footer";
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
import {
	eventStatusTone,
	humanizeStatus,
	StatusPill,
} from "@/components/status-pill";
import { TextAction } from "@/components/text-action";
import { Button } from "@/components/ui/button";
import { confirm, toast } from "@/components/ui/overlay";
import { Body, Caption, Label } from "@/components/ui/typography";
import { useDeleteEvent } from "@/hooks/use-events";
import { useMe } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { useGridColumns } from "@/hooks/useMedia";
import { apiErrorMessage, orgEventsApi, queryKeys } from "@/lib/api";
import { formatDateRange } from "@/lib/format";
import { verticalScrollbar } from "@/lib/scroll";
import type { OrgEventListItem } from "@/lib/types";

type StatusFilter = "ALL" | EventStatus;

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
	{ value: "ALL", label: "All" },
	{ value: "PUBLISHED", label: "Published" },
	{ value: "DRAFT", label: "Drafts" },
	{ value: "COMPLETED", label: "Past" },
];

const PAGE_SIZE = 20;

/**
 * The org's events, page by page. Shares the `["org","events"]` prefix with
 * `useOrgEvents` so every event mutation invalidates it too; the `paged`
 * marker keeps its cache shape apart from the page-1 query the dashboard reads.
 */
function useOrgEventPages(filters: Partial<OrgEventQuery>) {
	return useInfiniteQuery({
		queryKey: queryKeys.orgEvents({ ...filters, paged: true }),
		queryFn: ({ pageParam }) =>
			orgEventsApi.list({ ...filters, page: pageParam, limit: PAGE_SIZE }),
		initialPageParam: 1,
		getNextPageParam: (last) =>
			last.meta.hasMore ? last.meta.page + 1 : undefined,
	});
}

export default function NgoEvents() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const [filter, setFilter] = useState<StatusFilter>("ALL");
	const [formOpen, setFormOpen] = useState(false);
	const [editing, setEditing] = useState<OrgEventListItem | null>(null);
	const [reviewing, setReviewing] = useState<OrgEventListItem | null>(null);
	const { data: me } = useMe();

	const query = useOrgEventPages(filter === "ALL" ? {} : { status: filter });
	const deleteEvent = useDeleteEvent();
	const columns = useGridColumns();

	const isVerified = me?.organization?.verificationStatus === "VERIFIED";
	const items = query.data?.pages.flatMap((page) => page.items) ?? [];
	const total = query.data?.pages[0]?.meta.total ?? items.length;

	const loadMore = () => {
		if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
	};

	const confirmDelete = async (event: OrgEventListItem) => {
		// An event with accepted volunteers is cancelled, not deleted — the
		// server keeps it so their applications and certificates survive — so
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

	return (
		<Screen>
			<ScreenHeader
				title="Events"
				subtitle={
					total > 0 ? `${total} event${total === 1 ? "" : "s"}` : undefined
				}
				action={
					<Button size="sm" onPress={openCreate}>
						New event
					</Button>
				}
			/>

			{!isVerified && (
				<View style={{ marginBottom: spacing[4] }}>
					<Banner
						tone="warning"
						title="Drafts only until you're verified"
						description="You can plan events now. Publishing them to volunteers unlocks once your documents are approved."
						onPress={() => router.push("/(ngo)/verification")}
					/>
				</View>
			)}

			<FilterChips options={FILTERS} value={filter} onChange={setFilter} />

			{query.isLoading ? (
				<LoadingState label="Loading your events" />
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
							icon={CalendarDays}
							title={
								filter === "DRAFT"
									? "No drafts"
									: filter === "COMPLETED"
										? "No past events yet"
										: filter === "PUBLISHED"
											? "Nothing published yet"
											: "No events yet"
							}
							description={
								filter === "COMPLETED"
									? "Events move here once they finish. You can still mark attendance and issue certificates."
									: "Each event lists here with how many places are filled and who is waiting for a decision."
							}
							action={
								filter === "COMPLETED" ? undefined : (
									<Button onPress={openCreate}>Create an event</Button>
								)
							}
						/>
					}
					ListFooterComponent={
						<LoadMoreFooter
							hasMore={!!query.hasNextPage}
							loading={query.isFetchingNextPage}
							onLoadMore={loadMore}
							count={items.length}
							noun="events"
						/>
					}
					renderItem={({ item }) => (
						<GridCell>
							<EventRow
								event={item}
								onReview={() => setReviewing(item)}
								onEdit={() => setEditing(item)}
								onDelete={() => confirmDelete(item)}
							/>
						</GridCell>
					)}
				/>
			)}

			<EventFormSheet
				visible={formOpen || !!editing}
				event={editing}
				onClose={() => {
					setFormOpen(false);
					setEditing(null);
				}}
				defaultCity={me?.organization?.city}
				defaultState={me?.organization?.state}
			/>

			<ApplicantsSheet
				eventId={reviewing?.id ?? null}
				eventTitle={reviewing?.title ?? ""}
				remainingPlaces={
					reviewing ? reviewing.volunteersNeeded - reviewing.acceptedCount : 0
				}
				onClose={() => setReviewing(null)}
			/>
		</Screen>
	);
}

/**
 * One event. Tapping the card opens its applicants — the decision this screen
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
	onEdit: () => void;
	onDelete: () => void;
}) {
	const { colors, spacing } = useTheme();
	const filled = event.volunteersNeeded
		? Math.min(event.acceptedCount / event.volunteersNeeded, 1)
		: 0;
	const pending = event.pendingApplications ?? 0;

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
						{event.acceptedCount} of {event.volunteersNeeded} volunteers
					</Label>
					<Caption
						weight={pending > 0 ? "medium" : "normal"}
						color={pending > 0 ? (colors.warning.ink as string) : "quaternary"}
						numberOfLines={1}
					>
						{pending > 0
							? `${pending} applicant${pending === 1 ? "" : "s"} waiting`
							: "Tap to see applicants"}
					</Caption>
				</View>
				<View style={{ flexDirection: "row", gap: spacing[3] }}>
					<TextAction
						label={event.status === "DRAFT" ? "Edit & publish" : "Edit"}
						tone={event.status === "DRAFT" ? "brand" : "default"}
						onPress={onEdit}
						accessibilityLabel={`Edit ${event.title}`}
					/>
					<TextAction
						label="Remove"
						tone="danger"
						onPress={onDelete}
						accessibilityLabel={`Remove ${event.title}`}
					/>
				</View>
			</View>
		</Surface>
	);
}
