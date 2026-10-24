import type { AdminActivityItem, AdminActivityKind } from "@nabhya/shared";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { LoadMoreButton } from "@/components/paged-list";
import { ErrorState, LoadingState, Surface } from "@/components/screen-shell";
import { humanizeStatus, StatusPill } from "@/components/status-pill";
import { Body, Caption } from "@/components/ui/typography";
import {
	useAdminOrganizationActivityPaged,
	useAdminUserActivityPaged,
} from "@/hooks/use-admin-lists";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import { SelectMenu } from "./select-menu";

/**
 * The dossier timelines.
 *
 * Both admin detail drawers end with "what has this record been doing" - the
 * NGO's events/needs/posts/documents and the volunteer's applications/pledges/
 * documents - served by `GET /api/admin/organizations/:id/activity` and
 * `GET /api/admin/users/:id/activity`. One flat paginated list; the grouping
 * (by day, via `groupKey`) and the kind filter both happen here, so the
 * contract never changes when a reviewer wants a new cut.
 *
 * **Drawer-safe, deliberately.** A dossier is a `Drawer` that already scrolls,
 * so this renders eager rows plus a `LoadMoreButton` - never a `FlatList` or a
 * nested scroller. Same reason the kind filter is a `SelectMenu` and not a chip
 * row: eleven kinds in chips would push the first row a screen down.
 */

const ORG_KINDS: AdminActivityKind[] = [
	"EVENT",
	"NEED",
	"ANNOUNCEMENT",
	"REPORT",
	"DOCUMENT",
	"APPLICATION",
	"PLEDGE",
	"DONATION",
	"REVIEW",
	"POST",
];

const USER_KINDS: AdminActivityKind[] = [
	"APPLICATION",
	"PLEDGE",
	"DONATION",
	"REVIEW",
	"CERTIFICATE",
	"DOCUMENT",
	"POST",
];

export function OrgActivityTimeline({
	organizationId,
}: {
	organizationId: string;
}) {
	const [kind, setKind] = useState<AdminActivityKind | "ALL">("ALL");
	const timeline = useAdminOrganizationActivityPaged(organizationId, {
		...(kind === "ALL" ? {} : { kind }),
	});
	return (
		<TimelineBody
			query={timeline.query}
			items={timeline.items}
			total={timeline.total}
			loadMore={timeline.loadMore}
			kinds={ORG_KINDS}
			kind={kind}
			onKindChange={setKind}
			emptyHint="Nothing recorded for this organization yet."
		/>
	);
}

export function UserActivityTimeline({ userId }: { userId: string }) {
	const [kind, setKind] = useState<AdminActivityKind | "ALL">("ALL");
	const timeline = useAdminUserActivityPaged(userId, {
		...(kind === "ALL" ? {} : { kind }),
	});
	return (
		<TimelineBody
			query={timeline.query}
			items={timeline.items}
			total={timeline.total}
			loadMore={timeline.loadMore}
			kinds={USER_KINDS}
			kind={kind}
			onKindChange={setKind}
			emptyHint="No activity recorded for this account yet."
		/>
	);
}

function TimelineBody({
	query,
	items,
	total,
	loadMore,
	kinds,
	kind,
	onKindChange,
	emptyHint,
}: {
	query: {
		isLoading: boolean;
		isError: boolean;
		error?: unknown;
		refetch: () => void;
	};
	items: AdminActivityItem[];
	total: number;
	loadMore: () => void;
	kinds: AdminActivityKind[];
	kind: AdminActivityKind | "ALL";
	onKindChange: (next: AdminActivityKind | "ALL") => void;
	emptyHint: string;
}) {
	const { colors, spacing } = useTheme();
	const [menuOpen, setMenuOpen] = useState(false);

	const groups = useMemo(() => groupByDay(items), [items]);
	const options = [
		{ value: "ALL" as const, label: "All activity" },
		...kinds.map((entry) => ({
			value: entry as AdminActivityKind | "ALL",
			label: humanizeStatus(entry),
		})),
	];

	return (
		<View
			style={{
				gap: spacing[3],
				// The timeline is the last thing in the dossier, so an open panel
				// over a short (or empty) list would run past the end of the
				// drawer's scroll content and be clipped. Reserve its height while
				// it is open: 36pt per option, its padding, and the trigger.
				minHeight: menuOpen ? 40 + options.length * 36 + spacing[2] : 0,
			}}
		>
			{/* Raised above the groups below it: on the web every View is its
			    own stacking context, so without this the date headings painted
			    straight through the open panel. */}
			<View
				style={{
					flexDirection: "row",
					flexWrap: "wrap",
					alignItems: "center",
					gap: spacing[2],
					zIndex: menuOpen ? 20 : 1,
				}}
			>
				<SelectMenu<AdminActivityKind | "ALL">
					label="Type"
					value={kind}
					onChange={onKindChange}
					onOpenChange={setMenuOpen}
					options={options}
				/>
				{total > 0 && (
					<Caption color="quaternary">
						{total} {total === 1 ? "item" : "items"}
					</Caption>
				)}
			</View>

			{query.isLoading ? (
				<Surface>
					<LoadingState />
				</Surface>
			) : query.isError && items.length === 0 ? (
				<Surface>
					<ErrorState
						message={apiErrorMessage(query.error)}
						onRetry={() => query.refetch()}
					/>
				</Surface>
			) : items.length === 0 ? (
				<Surface>
					<Caption color="tertiary">{emptyHint}</Caption>
				</Surface>
			) : (
				<View style={{ gap: spacing[4] }}>
					{groups.map((group) => (
						<View key={group.key} style={{ gap: spacing[2] }}>
							{/* The day gets a row of its own, ruled off, so it reads as
							    a heading over the cards rather than as a caption that
							    belongs to the one above. */}
							<View
								accessibilityRole="header"
								style={{
									flexDirection: "row",
									alignItems: "center",
									gap: spacing[2],
								}}
							>
								<Caption weight="semibold" color="tertiary">
									{group.label}
								</Caption>
								<View
									style={{
										flex: 1,
										height: 1,
										backgroundColor: colors.border.hairline,
									}}
								/>
							</View>
							<View style={{ gap: spacing[2] }}>
								{group.items.map((item) => (
									<ActivityCard key={`${item.kind}:${item.id}`} item={item} />
								))}
							</View>
						</View>
					))}
					<LoadMoreButton query={query as never} loadMore={loadMore} />
				</View>
			)}
		</View>
	);
}

function groupByDay(items: AdminActivityItem[]) {
	const order: string[] = [];
	const map = new Map<string, { label: string; items: AdminActivityItem[] }>();
	for (const item of items) {
		const entry = map.get(item.groupKey);
		if (entry) {
			entry.items.push(item);
		} else {
			map.set(item.groupKey, {
				label: dayLabel(item.groupKey, item.groupLabel),
				items: [item],
			});
			order.push(item.groupKey);
		}
	}
	return order.map((key) => {
		const group = map.get(key);
		if (!group) throw new Error(`Missing activity group for ${key}`);
		return { key, ...group };
	});
}

/**
 * The server buckets by UTC day and sends the bucket as its label
 * ("2026-10-17"), which is a key, not something to read. Format it as a day -
 * in UTC, so the label cannot slide to the previous date west of Greenwich.
 */
const DAY_LABEL = new Intl.DateTimeFormat("en-IN", {
	weekday: "short",
	day: "numeric",
	month: "short",
	year: "numeric",
	timeZone: "UTC",
});

function dayLabel(key: string, fallback: string) {
	const date = /^\d{4}-\d{2}-\d{2}$/.test(key)
		? new Date(`${key}T00:00:00Z`)
		: null;
	if (!date || Number.isNaN(date.getTime())) return fallback;
	return DAY_LABEL.format(date);
}

const TIME_OF_DAY = new Intl.DateTimeFormat("en-IN", {
	hour: "numeric",
	minute: "2-digit",
});

/**
 * One timeline row.
 *
 * Title + status on the first line, description below, then the "who / what /
 * when" line. The kind rides as a neutral pill - kinds are told apart by the
 * words, not by colour, so forty consecutive NEED rows stay readable.
 */
export function ActivityCard({ item }: { item: AdminActivityItem }) {
	const { spacing } = useTheme();

	const actor = item.actor?.name ?? item.actor?.email ?? null;
	const rupees = item.amountMinor != null ? item.amountMinor / 100 : null;

	return (
		<Surface>
			<View
				style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}
			>
				<Body weight="semibold" style={{ flex: 1 }} numberOfLines={2}>
					{item.title}
				</Body>
				{item.status ? (
					<StatusPill label={humanizeStatus(item.status)} tone="neutral" />
				) : null}
			</View>

			{item.description ? (
				<Body
					color="secondary"
					numberOfLines={3}
					style={{ marginTop: spacing[1] }}
				>
					{item.description}
				</Body>
			) : null}

			<View
				style={{
					flexDirection: "row",
					flexWrap: "wrap",
					alignItems: "center",
					gap: spacing[2],
					marginTop: spacing[2],
				}}
			>
				<StatusPill label={humanizeStatus(item.kind)} tone="neutral" />
				<Caption color="quaternary">
					{/* The day is the group heading above, so the row says only how
					    long ago and at what time. */}
					{formatRelative(item.occurredAt)} ·{" "}
					{TIME_OF_DAY.format(new Date(item.occurredAt))}
				</Caption>
			</View>

			{actor || item.organization || rupees != null || item.subject ? (
				<Caption color="tertiary" style={{ marginTop: spacing[1] }}>
					{[
						actor ? `By ${actor}` : null,
						item.subject ? item.subject.label : null,
						item.organization ? item.organization.organizationName : null,
						rupees != null
							? `₹${rupees.toLocaleString("en-IN")} ${item.currency ?? "INR"}`
							: null,
					]
						.filter(Boolean)
						.join(" · ")}
				</Caption>
			) : null}
		</Surface>
	);
}
