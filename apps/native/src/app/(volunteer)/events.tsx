import { useRouter } from "expo-router";
import { CalendarCheck } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { EventFeed } from "@/components/event-feed";
import { PAGE_SIZE, PagedList, usePagedQuery } from "@/components/paged-list";
import {
	EmptyState,
	FilterChips,
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
import type { ApplicationListItem } from "@/lib/types";

type Tab = "browse" | "applications";

const TABS: Array<{ value: Tab; label: string }> = [
	{ value: "browse", label: "Browse" },
	{ value: "applications", label: "My applications" },
];

/**
 * Events for a volunteer: the public list to browse, and the ones they have
 * applied to. Not on the tab bar — reached from Activity and Profile — so the
 * header carries a back button.
 */
export default function VolunteerEvents() {
	const [tab, setTab] = useState<Tab>("browse");

	return (
		<Screen>
			<ScreenHeader back title="Events" />

			<FilterChips options={TABS} value={tab} onChange={setTab} />

			{tab === "browse" ? (
				<EventFeed />
			) : (
				<MyApplications onBrowse={() => setTab("browse")} />
			)}
		</Screen>
	);
}

function MyApplications({ onBrowse }: { onBrowse: () => void }) {
	const router = useRouter();

	const { query, items, loadMore } = usePagedQuery({
		queryKey: queryKeys.myApplications({ limit: PAGE_SIZE }),
		fetchPage: (page) => eventsApi.myApplications({ page, limit: PAGE_SIZE }),
	});

	return (
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
					description="Apply to an event and you can follow its status here — pending, accepted, or not this time."
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

	const next =
		application.status === "PENDING"
			? "Waiting for the NGO to review"
			: application.status === "ACCEPTED"
				? "You're in — turn up and get marked present"
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
				<Caption color={colors.warning.ink} style={{ marginTop: spacing[2] }}>
					{next}
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
