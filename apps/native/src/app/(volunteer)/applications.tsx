import { useRouter } from "expo-router";
import { CalendarCheck } from "lucide-react-native";
import { View } from "react-native";
import { PAGE_SIZE, PagedList, usePagedQuery } from "@/components/paged-list";
import {
	EmptyState,
	Screen,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import {
	applicationTone,
	humanizeStatus,
	StatusPill,
} from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Caption, H5 } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { eventsApi, queryKeys } from "@/lib/api";
import { formatDateRange } from "@/lib/format";
import { READING_COLUMN } from "@/lib/reading-column";
import type { ApplicationListItem } from "@/lib/types";

/**
 * Every event the volunteer has applied to, paged - the full list behind
 * Activity's first page. Not on the tab bar: reached from Profile and from
 * Activity's Events filter, so the header carries a back button.
 *
 * This was `(volunteer)/events.tsx`, which resolved to `/events` - the same
 * URL as the public `events/index.tsx` - so every "/events" push was
 * ambiguous and nothing linked here at all. Browsing events is the public
 * page's job; this screen is only the volunteer's own applications.
 */
export default function MyApplications() {
	const router = useRouter();
	const onBrowse = () => router.push("/events");

	const { query, items, loadMore } = usePagedQuery({
		queryKey: queryKeys.myApplications({ limit: PAGE_SIZE }),
		fetchPage: (page) => eventsApi.myApplications({ page, limit: PAGE_SIZE }),
	});

	return (
		<Screen style={READING_COLUMN}>
			<ScreenHeader
				back
				title="Applications"
				action={
					<Button size="sm" variant="outline" onPress={onBrowse}>
						Find events
					</Button>
				}
			/>
			<PagedList
				query={query}
				items={items}
				loadMore={loadMore}
				loadingLabel="Loading your applications"
				keyExtractor={(item) => item.id}
				empty={
					<EmptyState
						icon={CalendarCheck}
						title="No applications yet"
						description="Apply to an event and you can follow its status here - pending, accepted, or not this time."
						action={
							<Button size="sm" variant="outline" onPress={onBrowse}>
								Browse events
							</Button>
						}
					/>
				}
				renderItem={(item) => (
					<ApplicationCard
						application={item}
						onPress={() => router.push(`/events/${item.event.id}`)}
					/>
				)}
			/>
		</Screen>
	);
}

function ApplicationCard({
	application,
	onPress,
}: {
	application: ApplicationListItem;
	onPress: () => void;
}) {
	const { colors, spacing } = useTheme();

	// Amber for "still waiting", green for "you're in". Both used to be amber,
	// which made an acceptance read as a problem.
	const next =
		application.status === "PENDING"
			? { text: "Waiting for the NGO to review", ink: colors.warning.ink }
			: application.status === "ACCEPTED"
				? {
						text: "You're in - the organiser will message you the details",
						ink: colors.success.ink,
					}
				: null;

	return (
		<Surface onPress={onPress}>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					gap: spacing[3],
					marginBottom: spacing[1],
				}}
			>
				<Caption color="tertiary" numberOfLines={1} style={{ flex: 1 }}>
					{application.organization.organizationName}
				</Caption>
				<StatusPill
					label={humanizeStatus(application.status)}
					tone={applicationTone(application.status)}
				/>
			</View>

			<H5 numberOfLines={2}>{application.event.title}</H5>
			<Caption color="tertiary" style={{ marginTop: spacing[0.5] }}>
				{formatDateRange(application.event.startAt, application.event.endAt)}
				{application.event.city ? ` · ${application.event.city}` : ""}
			</Caption>

			{next && (
				<Caption color={next.ink} style={{ marginTop: spacing[2] }}>
					{next.text}
				</Caption>
			)}

			{application.reviewNote && (
				<Caption color="secondary" style={{ marginTop: spacing[2] }}>
					“{application.reviewNote}”
				</Caption>
			)}
		</Surface>
	);
}
