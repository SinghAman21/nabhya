import { formatMinor } from "@nabhya/shared";
import { useRouter } from "expo-router";
import { Waypoints } from "lucide-react-native";
import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import {
	EmptyState,
	ErrorState,
	FilterChips,
	ListGroup,
	LoadingState,
	Screen,
	ScreenHeader,
} from "@/components/screen-shell";
import {
	applicationTone,
	humanizeStatus,
	type PillTone,
	pledgeTone,
	StatusPill,
} from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { Caption, Label } from "@/components/ui/typography";
import {
	useMarkNotificationsRead,
	useMyCertificates,
	useMyDonations,
	useNotifications,
} from "@/hooks/use-engagement";
import { useMyApplications } from "@/hooks/use-events";
import { useMyPledges } from "@/hooks/use-needs";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import { focusable } from "@/lib/focus";
import { formatDateRange, formatRelative } from "@/lib/format";

/*
 * Everything the volunteer has done, in one timeline.
 *
 * This replaces two tabs — "Donations" (items | money) and the "My
 * applications" half of "Events" — plus the notifications screen, which were
 * four separate lists of the same thing: what I did, and what happened to it.
 * A volunteer's question is never "show me my pledges"; it is "I gave 20
 * blankets, did it land, and where is my certificate".
 *
 * Known limit: five endpoints, five first pages, merged and sorted here. That is
 * correct for the volumes one volunteer generates and wrong in general — a true
 * merged cursor is server work, tracked as step 1 in `ui-redesign.md`.
 */

type Filter = "ALL" | "GIVING" | "EVENTS" | "ALERTS";

const FILTERS: Array<{ value: Filter; label: string }> = [
	{ value: "ALL", label: "All" },
	{ value: "GIVING", label: "Giving" },
	{ value: "EVENTS", label: "Events" },
	{ value: "ALERTS", label: "Alerts" },
];

type EntryKind =
	| "pledge"
	| "donation"
	| "application"
	| "certificate"
	| "alert";

interface Entry {
	id: string;
	kind: EntryKind;
	group: Filter;
	/** Sort key. ISO string. */
	at: string;
	title: string;
	detail: string;
	status?: { label: string; tone: PillTone };
	/** What happens next, when the volunteer is waiting on someone else. */
	next?: string;
	unread?: boolean;
	href?: string;
}

export default function Activity() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const [filter, setFilter] = useState<Filter>("ALL");

	const pledges = useMyPledges({ limit: 20 });
	const donations = useMyDonations({ limit: 20 });
	const applications = useMyApplications({ limit: 20 });
	const certificates = useMyCertificates({ limit: 20 });
	const alerts = useNotifications({ limit: 20 });
	const markRead = useMarkNotificationsRead();

	const sources = [pledges, donations, applications, certificates, alerts];
	const isLoading = sources.some((source) => source.isLoading);
	const isRefetching = sources.some((source) => source.isRefetching);
	const error = sources.find((source) => source.isError)?.error;

	const entries = useMemo<Entry[]>(() => {
		const all: Entry[] = [];

		for (const pledge of pledges.data?.items ?? []) {
			const amount = pledge.quantity
				? `${pledge.quantity}${pledge.need.unit ? ` ${pledge.need.unit}` : ""}`
				: "an offer";
			all.push({
				id: `pledge-${pledge.id}`,
				kind: "pledge",
				group: "GIVING",
				at: pledge.createdAt,
				title: pledge.need.title,
				detail: `Pledged ${amount} to ${pledge.organization.organizationName}`,
				status: {
					label: humanizeStatus(pledge.status),
					tone: pledgeTone(pledge.status),
				},
				...(pledge.status === "PENDING"
					? { next: "Waiting for the NGO to review" }
					: {}),
				...(pledge.status === "ACCEPTED"
					? { next: "Accepted — arrange handover with the NGO" }
					: {}),
			});
		}

		for (const donation of donations.data?.items ?? []) {
			all.push({
				id: `donation-${donation.id}`,
				kind: "donation",
				group: "GIVING",
				at: donation.completedAt ?? donation.createdAt,
				title: formatMinor(donation.amountMinor, donation.currency),
				detail: `Donated to ${donation.organization.organizationName}`,
				status: {
					label: humanizeStatus(donation.status),
					tone:
						donation.status === "COMPLETED"
							? "success"
							: donation.status === "FAILED"
								? "error"
								: "warning",
				},
				href: "/(volunteer)/donations",
			});
		}

		for (const application of applications.data?.items ?? []) {
			all.push({
				id: `application-${application.id}`,
				kind: "application",
				group: "EVENTS",
				at: application.appliedAt,
				title: application.event.title,
				detail: `${application.organization.organizationName} · ${formatDateRange(
					application.event.startAt,
					application.event.endAt,
				)}`,
				status: {
					label: humanizeStatus(application.status),
					tone: applicationTone(application.status),
				},
				...(application.status === "PENDING"
					? { next: "Waiting for the NGO to review" }
					: {}),
				...(application.status === "ACCEPTED"
					? { next: "You're in — turn up and get marked present" }
					: {}),
				href: `/events/${application.event.id}`,
			});
		}

		for (const certificate of certificates.data?.items ?? []) {
			all.push({
				id: `certificate-${certificate.id}`,
				kind: "certificate",
				group: "EVENTS",
				at: certificate.issuedAt,
				title: `Certificate for ${certificate.event.title}`,
				detail: `${certificate.organization.organizationName} · ${certificate.code}`,
				status: certificate.revokedAt
					? { label: "Revoked", tone: "error" }
					: { label: "Issued", tone: "success" },
				href: `/certificates/${certificate.code}`,
			});
		}

		for (const alert of alerts.data?.items ?? []) {
			all.push({
				id: `alert-${alert.id}`,
				kind: "alert",
				group: "ALERTS",
				at: alert.createdAt,
				title: alert.title,
				detail: alert.body ?? "",
				unread: !alert.readAt,
			});
		}

		return all.sort((a, b) => b.at.localeCompare(a.at));
	}, [
		pledges.data,
		donations.data,
		applications.data,
		certificates.data,
		alerts.data,
	]);

	const visible =
		filter === "ALL"
			? entries
			: entries.filter((entry) => entry.group === filter);

	const days = useMemo(() => groupByDay(visible), [visible]);
	const unread = entries.filter((entry) => entry.unread).length;

	const refetchAll = () => {
		for (const source of sources) source.refetch();
	};

	return (
		<Screen>
			<ScreenHeader
				title="Activity"
				subtitle={
					unread > 0
						? `${unread} unread`
						: `${entries.length} ${entries.length === 1 ? "update" : "updates"}`
				}
				{...(unread > 0
					? {
							action: (
								<Pressable
									onPress={() => markRead.mutate({})}
									accessibilityRole="button"
									hitSlop={8}
									{...focusable}
								>
									<Caption weight="medium" color={colors.primary.ink}>
										Mark read
									</Caption>
								</Pressable>
							),
						}
					: {})}
			/>

			<FilterChips options={FILTERS} value={filter} onChange={setFilter} />

			{isLoading ? (
				<LoadingState label="Loading your activity" />
			) : error ? (
				<ErrorState message={apiErrorMessage(error)} onRetry={refetchAll} />
			) : visible.length === 0 ? (
				<EmptyState
					icon={Waypoints}
					title={
						filter === "ALL" ? "Nothing here yet" : "Nothing under this filter"
					}
					description={
						filter === "ALL"
							? "Pledge an item or apply to an event from Home. Every step — reviewed, accepted, certificate issued — lands here."
							: filter === "ALERTS"
								? "Updates from NGOs about your pledges and applications arrive here."
								: "Try another filter, or see everything under All."
					}
					action={
						filter === "ALL" ? (
							<Button
								size="sm"
								variant="outline"
								onPress={() => router.push("/(volunteer)")}
							>
								See what's needed
							</Button>
						) : (
							<Button
								size="sm"
								variant="outline"
								onPress={() => setFilter("ALL")}
							>
								Show all activity
							</Button>
						)
					}
				/>
			) : (
				<ScrollView
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{
						paddingBottom: spacing[10],
						gap: spacing[6],
					}}
					refreshControl={
						<RefreshControl
							refreshing={isRefetching}
							onRefresh={refetchAll}
							tintColor={colors.text.quaternary as string}
						/>
					}
				>
					{days.map((day) => (
						<View key={day.label}>
							<Caption
								color="quaternary"
								style={{ marginBottom: spacing[2.5] }}
							>
								{day.label}
							</Caption>
							<ListGroup>
								{day.entries.map((entry) => (
									<TimelineRow
										key={entry.id}
										entry={entry}
										{...(entry.href
											? {
													onPress: () => router.push(entry.href as never),
												}
											: {})}
									/>
								))}
							</ListGroup>
						</View>
					))}
				</ScrollView>
			)}
		</Screen>
	);
}

/* -------------------------------------------------------------------------- */
/* Row                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * One event in the timeline. The status pill says where it stands; `next` says
 * what the volunteer is waiting on, which is the part that was missing entirely
 * — a pledge could sit at PENDING forever with nothing on screen explaining
 * that the NGO, not the volunteer, owes the next move.
 */
function TimelineRow({
	entry,
	onPress,
}: {
	entry: Entry;
	onPress?: () => void;
}) {
	const { colors, spacing } = useTheme();

	const body = (
		<View
			style={{
				flexDirection: "row",
				alignItems: "flex-start",
				gap: spacing[3],
				paddingHorizontal: spacing[4],
				paddingVertical: spacing[3.5],
			}}
		>
			{/* Unread marker sits in the gutter so titles stay on one baseline. */}
			<View style={{ width: 7, paddingTop: 7 }}>
				{entry.unread && (
					<View
						style={{
							width: 7,
							height: 7,
							borderRadius: 4,
							backgroundColor: colors.primary.main,
						}}
					/>
				)}
			</View>

			<View style={{ flex: 1, gap: spacing[0.5] }}>
				<Label weight="semibold" numberOfLines={2}>
					{entry.title}
				</Label>
				{entry.detail !== "" && (
					<Caption color="tertiary" numberOfLines={2}>
						{entry.detail}
					</Caption>
				)}
				{entry.next && (
					<Caption color={colors.warning.ink} numberOfLines={2}>
						{entry.next}
					</Caption>
				)}
			</View>

			<View style={{ alignItems: "flex-end", gap: spacing[1.5] }}>
				{entry.status && (
					<StatusPill label={entry.status.label} tone={entry.status.tone} />
				)}
				<Caption color="quaternary">{formatRelative(entry.at)}</Caption>
			</View>
		</View>
	);

	if (!onPress) return body;

	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={`${entry.title}. ${entry.detail}`}
			{...focusable}
			style={(state) => {
				const { pressed, hovered } = state as {
					pressed: boolean;
					hovered?: boolean;
				};
				return {
					backgroundColor:
						pressed || hovered ? colors.background.subtle : "transparent",
				};
			}}
		>
			{body}
		</Pressable>
	);
}

/* -------------------------------------------------------------------------- */
/* Grouping                                                                   */
/* -------------------------------------------------------------------------- */

const DAY_LABEL = new Intl.DateTimeFormat("en-IN", {
	day: "numeric",
	month: "short",
	year: "numeric",
});

/** Today / Yesterday / a date — so a scroll reads as a history, not a list. */
function groupByDay(
	entries: Entry[],
): Array<{ label: string; entries: Entry[] }> {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const yesterday = new Date(today.getTime() - 86_400_000);

	const groups: Array<{ label: string; entries: Entry[] }> = [];
	const index = new Map<string, number>();

	for (const entry of entries) {
		const date = new Date(entry.at);
		date.setHours(0, 0, 0, 0);

		const label =
			date.getTime() === today.getTime()
				? "Today"
				: date.getTime() === yesterday.getTime()
					? "Yesterday"
					: DAY_LABEL.format(date);

		const existing = index.get(label);
		if (existing === undefined) {
			index.set(label, groups.length);
			groups.push({ label, entries: [entry] });
		} else {
			groups[existing]?.entries.push(entry);
		}
	}

	return groups;
}
