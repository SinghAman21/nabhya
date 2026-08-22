import { useRouter } from "expo-router";
import { View } from "react-native";
import {
	ListGroup,
	ListRow,
	SectionTitle,
	Surface,
} from "@/components/screen-shell";
import { Caption, Label } from "@/components/ui/typography";
import { usePublicEvents } from "@/hooks/use-events";
import { usePublicNeeds } from "@/hooks/use-needs";
import { useTheme } from "@/hooks/useTheme";
import { formatRelative } from "@/lib/format";
import { useFeedStore } from "@/store/feed-store";

/**
 * The second column on desktop Discover.
 *
 * Its job is to surface what the feed's current filter and scroll position hide —
 * so both sections are **server-filtered**, not a slice of the page already on
 * screen. `publicNeedQuerySchema` takes `urgency` and `publicEventQuerySchema`
 * takes `when`, so both of these are real queries rather than a client-side
 * reinterpretation of the feed.
 *
 * Deliberately not here: "trending". There is no metric for it — no view counts,
 * no pledge velocity, no follower counts anywhere in the schema. Trending would
 * have to be defined server-side first (pledges in the last 7 days, say);
 * inventing it client-side would be a ranked list of nothing.
 */

const RAIL_LIMIT = 4;

export function DiscoverRail() {
	const { spacing } = useTheme();

	return (
		<View style={{ gap: spacing[6] }}>
			<UrgentNow />
			<HappeningSoon />
		</View>
	);
}

/* -------------------------------------------------------------------------- */

function UrgentNow() {
	const router = useRouter();
	const city = useFeedStore((s) => s.city);
	const query = usePublicNeeds({
		urgency: "HIGH",
		limit: RAIL_LIMIT,
		...(city ? { city } : {}),
	});
	const needs = query.data?.items ?? [];

	if (needs.length === 0) return null;

	return (
		<View>
			<SectionTitle>Urgent now</SectionTitle>
			<ListGroup>
				{needs.map((need) => (
					<ListRow
						key={need.id}
						label={need.title}
						hint={need.organization.organizationName}
						onPress={() => router.push(`/ngos/${need.organization.id}`)}
					/>
				))}
			</ListGroup>
		</View>
	);
}

/* -------------------------------------------------------------------------- */

/**
 * Events in the rail rather than interleaved into the feed. This is not a
 * compromise — it is what lets events appear on Discover at all without a merged
 * cursor, since two paginated endpoints cannot be interleaved client-side.
 */
function HappeningSoon() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const city = useFeedStore((s) => s.city);
	const query = usePublicEvents({
		when: "upcoming",
		limit: RAIL_LIMIT,
		...(city ? { city } : {}),
	});
	const events = query.data?.items ?? [];

	if (events.length === 0) return null;

	return (
		<View>
			<SectionTitle>Happening soon</SectionTitle>
			<Surface padded={false} style={{ overflow: "hidden" }}>
				{events.map((event, index) => {
					const slotsLeft = Math.max(
						0,
						event.volunteersNeeded - event.acceptedCount,
					);

					return (
						<View key={event.id}>
							{index > 0 && (
								<View
									style={{
										height: 1,
										marginLeft: spacing[4],
										backgroundColor: colors.border.hairline,
									}}
								/>
							)}
							<ListRow
								label={event.title}
								hint={`${event.organization.organizationName} · ${formatRelative(
									event.startAt,
								)}`}
								onPress={() => router.push(`/events/${event.id}`)}
								value={
									<View style={{ alignItems: "flex-end" }}>
										<Label weight="bold">{slotsLeft}</Label>
										<Caption color="quaternary">
											{slotsLeft === 1 ? "slot" : "slots"}
										</Caption>
									</View>
								}
							/>
						</View>
					);
				})}
			</Surface>
		</View>
	);
}
