import type { EventStatus } from "@nabhya/shared";
import { CalendarDays, Plus } from "lucide-react-native";
import { useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { ApplicantsSheet } from "@/components/applicants-sheet";
import { EventFormSheet } from "@/components/event-form-sheet";
import {
	EmptyState,
	ErrorState,
	FilterChips,
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
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption } from "@/components/ui/typography";
import { useDeleteEvent, useOrgEvents } from "@/hooks/use-events";
import { useMe } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/useTheme";
import { Alert } from "@/lib/alert";
import { apiErrorMessage } from "@/lib/api";
import { formatDateRange } from "@/lib/format";
import type { OrgEventListItem } from "@/lib/types";

type StatusFilter = "ALL" | EventStatus;

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
	{ value: "ALL", label: "All" },
	{ value: "PUBLISHED", label: "Published" },
	{ value: "DRAFT", label: "Drafts" },
	{ value: "COMPLETED", label: "Past" },
];

export default function NgoEvents() {
	const { colors, spacing } = useTheme();
	const [filter, setFilter] = useState<StatusFilter>("ALL");
	const [formOpen, setFormOpen] = useState(false);
	const [editing, setEditing] = useState<OrgEventListItem | null>(null);
	const [reviewing, setReviewing] = useState<OrgEventListItem | null>(null);
	const { data: me } = useMe();

	const query = useOrgEvents(filter === "ALL" ? {} : { status: filter });
	const deleteEvent = useDeleteEvent();

	const isVerified = me?.organization?.verificationStatus === "VERIFIED";

	const confirmDelete = (event: OrgEventListItem) => {
		Alert.alert(
			"Remove event",
			event.acceptedCount > 0
				? `${event.acceptedCount} volunteer${event.acceptedCount === 1 ? " has" : "s have"} already been accepted, so this event will be cancelled rather than deleted.`
				: `"${event.title}" will be deleted.`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: event.acceptedCount > 0 ? "Cancel event" : "Delete",
					style: "destructive",
					onPress: () =>
						deleteEvent.mutate(event.id, {
							onError: (error) =>
								Alert.alert("Could not remove", apiErrorMessage(error)),
						}),
				},
			],
		);
	};

	return (
		<Screen>
			<ScreenHeader
				title="Events"
				subtitle="Create volunteering events and review who applies."
				action={
					<Pressable
						onPress={() => setFormOpen(true)}
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
						You can draft events now — publishing to the public page unlocks
						once your organization is verified.
					</Caption>
				</Surface>
			)}

			<FilterChips options={FILTERS} value={filter} onChange={setFilter} />

			{query.isLoading ? (
				<LoadingState label="Loading your events…" />
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
							icon={CalendarDays}
							title="No events yet"
							description="Create an event and volunteers will be able to find and apply to it."
							action={
								<Button onPress={() => setFormOpen(true)}>
									Create your first event
								</Button>
							}
						/>
					}
					renderItem={({ item }) => (
						<EventRow
							event={item}
							onReview={() => setReviewing(item)}
							onEdit={() => setEditing(item)}
							onDelete={() => confirmDelete(item)}
						/>
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
					label={humanizeStatus(event.status)}
					tone={eventStatusTone(event.status)}
				/>
				{event.pendingApplications > 0 && (
					<StatusPill
						label={`${event.pendingApplications} to review`}
						tone="warning"
					/>
				)}
			</View>

			<Body weight="bold" numberOfLines={1}>
				{event.title}
			</Body>
			<Caption color="tertiary" style={{ marginTop: 2 }}>
				{formatDateRange(event.startAt, event.endAt)}
				{event.city ? ` · ${event.city}` : ""}
			</Caption>

			<View style={{ marginTop: spacing[3] }}>
				<View
					style={{
						height: 6,
						borderRadius: 3,
						backgroundColor: colors.background.tertiary,
						overflow: "hidden",
					}}
				>
					<View
						style={{
							width: `${filled * 100}%`,
							height: "100%",
							backgroundColor: colors.primary.main,
						}}
					/>
				</View>
				<Caption color="secondary" style={{ marginTop: spacing[1.5] }}>
					{event.acceptedCount} of {event.volunteersNeeded} volunteers confirmed
				</Caption>
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
				<Caption weight="medium" color={colors.primary.main as string}>
					View applicants
				</Caption>
				<View style={{ flexDirection: "row", gap: spacing[4] }}>
					<Pressable onPress={onEdit} hitSlop={8}>
						<Caption weight="medium" color="secondary">
							{event.status === "DRAFT" ? "Edit & publish" : "Edit"}
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
