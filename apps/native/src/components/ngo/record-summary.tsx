import type { NeedStatus, NeedType, NeedUrgency } from "@nabhya/shared";
import {
	CalendarDays,
	Clock,
	type LucideIcon,
	MapPin,
	Package,
} from "lucide-react-native";
import { View } from "react-native";
import { Surface } from "@/components/screen-shell";
import {
	eventStatusTone,
	humanizeStatus,
	StatusPill,
} from "@/components/status-pill";
import { TextAction } from "@/components/text-action";
import { Caption, H5, Label } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { formatDate, formatDateRange, formatProgress } from "@/lib/format";
import type {
	OrgEventDetail,
	OrgEventListItem,
	OrgNeedListItem,
} from "@/lib/types";

/**
 * The record half of the NGO's review drawers - an event above its
 * applicants, a need above its pledges - plus the kicker the needs card uses.
 *
 * Both follow the feed card's near-monochrome rule (root `AGENTS.md`, under
 * `components/feed/card/`): direction is a word, urgency is a 5pt dot and a
 * word, and the brand colour is spent once, on the progress bar. The cards
 * this replaced said "We need" in a blue block and "Urgent" in a red one,
 * which on a page of twenty posts is forty coloured rectangles saying two
 * things the reader already knows from the title.
 */

/* -------------------------------------------------------------------------- */
/* Kicker                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * "Needs help · Urgent · Closed" as type. The same three facts `CardKicker`
 * carries on the feed, from an org-side row rather than a `FeedItem`.
 */
export function NeedKicker({
	type,
	urgency,
	status,
	trailing,
}: {
	type: NeedType;
	urgency: NeedUrgency;
	status: NeedStatus;
	/** Right-aligned on the same line - the post's age, on a card. */
	trailing?: string;
}) {
	const { spacing } = useTheme();
	const urgent = urgency === "HIGH" && status === "OPEN";
	const parts = [
		type === "WANT" ? "Needs help" : "Giving away",
		status === "OPEN" ? null : humanizeStatus(status),
	].filter(Boolean) as string[];

	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				flexWrap: "wrap",
				gap: spacing[1.5],
			}}
		>
			{urgent && <UrgentMark />}
			{parts.map((part, index) => (
				<View
					key={part}
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[1.5],
					}}
				>
					{(index > 0 || urgent) && <Dot />}
					<Caption color="tertiary" weight="medium">
						{part}
					</Caption>
				</View>
			))}
			{trailing ? (
				<>
					<View style={{ flex: 1 }} />
					<Caption color="quaternary">{trailing}</Caption>
				</>
			) : null}
		</View>
	);
}

/** The feed's urgency mark: one 5pt dot in `error.main`, the word in ink. */
export function UrgentMark() {
	const { colors, spacing } = useTheme();
	return (
		<View
			style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}
		>
			<View
				style={{
					width: 5,
					height: 5,
					borderRadius: 999,
					backgroundColor: colors.error.main,
				}}
			/>
			<Caption weight="semibold" color={colors.error.ink as string}>
				Urgent
			</Caption>
		</View>
	);
}

function Dot() {
	const { colors } = useTheme();
	return (
		<View
			style={{
				width: 3,
				height: 3,
				borderRadius: 999,
				backgroundColor: colors.text.disabled,
			}}
		/>
	);
}

/* -------------------------------------------------------------------------- */
/* Pieces                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A full-width meter. 6pt on a `border.medium` track, brand while filling and
 * success once full - the one colour on the record.
 */
export function Meter({
	value,
	max,
	label,
}: {
	value: number;
	max: number;
	/** Read by a screen reader as the bar's name. */
	label: string;
}) {
	const { colors } = useTheme();
	const ratio = max > 0 ? Math.min(value / max, 1) : 0;
	return (
		<View
			accessible
			accessibilityRole="progressbar"
			accessibilityLabel={label}
			accessibilityValue={{ min: 0, max, now: Math.min(value, max) }}
			style={{
				height: 6,
				borderRadius: 3,
				backgroundColor: colors.border.medium,
				overflow: "hidden",
			}}
		>
			<View
				style={{
					width: `${ratio * 100}%`,
					height: "100%",
					borderRadius: 3,
					backgroundColor:
						ratio >= 1 ? colors.success.main : colors.primary.main,
				}}
			/>
		</View>
	);
}

function FactLine({
	icon: Icon,
	text,
	color,
}: {
	icon: LucideIcon;
	text: string;
	color?: string;
}) {
	const { colors, spacing } = useTheme();
	return (
		<View
			style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}
		>
			<Icon
				size={16}
				strokeWidth={2}
				color={color ?? (colors.text.quaternary as string)}
			/>
			<Caption
				color={color ?? "secondary"}
				weight={color ? "semibold" : "normal"}
				style={{ flex: 1, minWidth: 0 }}
			>
				{text}
			</Caption>
		</View>
	);
}

/** The header row both summaries share: state on the left, Edit on the right. */
function SummaryHead({
	children,
	onEdit,
	editLabel = "Edit",
	name,
}: {
	children: React.ReactNode;
	onEdit?: () => void;
	editLabel?: string;
	name: string;
}) {
	const { spacing } = useTheme();
	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: spacing[3],
				minHeight: 24,
			}}
		>
			<View
				style={{
					flex: 1,
					minWidth: 0,
					flexDirection: "row",
					alignItems: "center",
					flexWrap: "wrap",
					gap: spacing[2],
				}}
			>
				{children}
			</View>
			{onEdit && (
				<TextAction
					label={editLabel}
					tone={editLabel === "Edit" ? "default" : "brand"}
					onPress={onEdit}
					accessibilityLabel={`${editLabel} ${name}`}
				/>
			)}
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Event                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * An event as its organiser reviews it: state and Edit, the title, when,
 * where, and how full - "12 of 20 confirmed" over a full-width bar, with the
 * places left beside it because that is what bounds the next Accept.
 */
export function EventSummary({
	event,
	detail,
	onEdit,
}: {
	event: OrgEventListItem;
	/** The full record, for venue and address; the list row lacks both. */
	detail?: OrgEventDetail | null;
	/** Omitted when the viewer's role cannot change this event. */
	onEdit?: () => void;
}) {
	const { colors, spacing } = useTheme();
	const left = Math.max(event.volunteersNeeded - event.acceptedCount, 0);
	// De-duplicated, case-blind: an event whose venue and address are the
	// same string printed "Ward Community Ground, Ward Community Ground".
	const place = [detail?.venue, detail?.address, event.city]
		.map((part) => part?.trim() ?? "")
		.filter(
			(part, index, all) =>
				part.length > 0 &&
				all.findIndex((other) => other.toLowerCase() === part.toLowerCase()) ===
					index,
		)
		.join(", ");
	// Finished events take no one, so "raise the count" and "places left" are
	// advice for an event that is over.
	const finished = event.status === "COMPLETED" || event.status === "CANCELLED";

	return (
		<Surface>
			<SummaryHead
				name={event.title}
				onEdit={onEdit}
				editLabel={event.status === "DRAFT" ? "Edit & publish" : "Edit"}
			>
				<StatusPill
					label={humanizeStatus(event.status)}
					tone={eventStatusTone(event.status)}
				/>
				{event.isUrgent && <UrgentMark />}
			</SummaryHead>

			<H5 style={{ marginTop: spacing[3] }}>{event.title}</H5>

			<View style={{ gap: spacing[1.5], marginTop: spacing[2] }}>
				<FactLine
					icon={CalendarDays}
					text={formatDateRange(event.startAt, event.endAt)}
				/>
				{place ? <FactLine icon={MapPin} text={place} /> : null}
			</View>

			<View
				style={{
					marginTop: spacing[4],
					paddingTop: spacing[4],
					borderTopWidth: 1,
					borderTopColor: colors.border.hairline,
					gap: spacing[2],
				}}
			>
				<View
					style={{
						flexDirection: "row",
						alignItems: "baseline",
						justifyContent: "space-between",
						gap: spacing[3],
					}}
				>
					<Label weight="semibold" style={{ flexShrink: 1 }}>
						{event.acceptedCount} of {event.volunteersNeeded} volunteers
						confirmed
					</Label>
					<Caption
						weight={left === 0 && !finished ? "medium" : "normal"}
						color={
							left === 0 && !finished
								? (colors.warning.ink as string)
								: "tertiary"
						}
					>
						{finished
							? humanizeStatus(event.status)
							: left === 0
								? "Full"
								: `${left} place${left === 1 ? "" : "s"} left`}
					</Caption>
				</View>
				<Meter
					value={event.acceptedCount}
					max={event.volunteersNeeded}
					label={`${event.acceptedCount} of ${event.volunteersNeeded} volunteers confirmed`}
				/>
				{left === 0 && !finished && (
					<Caption color="tertiary">
						Raise the volunteer count to accept more.
					</Caption>
				)}
			</View>
		</Surface>
	);
}

/* -------------------------------------------------------------------------- */
/* Need                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * A need as its NGO reviews it: direction, urgency and state as the kicker,
 * the title and details, then the quantity as a sentence over a full-width bar
 * ("40 blankets still needed", "12 of 52" muted) and the closing date.
 */
export function NeedSummary({
	need,
	onEdit,
}: {
	need: OrgNeedListItem;
	onEdit?: () => void;
}) {
	const { colors, spacing } = useTheme();
	const unit = need.unit ? ` ${need.unit}` : "";
	const target = need.quantity ?? 0;
	const remaining = Math.max(target - need.fulfilledQuantity, 0);
	const expires = need.expiresAt ? new Date(need.expiresAt) : null;
	const expired = !!expires && expires.getTime() < Date.now();

	return (
		<Surface>
			<SummaryHead name={need.title} onEdit={onEdit}>
				<NeedKicker
					type={need.type}
					urgency={need.urgency}
					status={need.status}
				/>
			</SummaryHead>

			<H5 style={{ marginTop: spacing[3] }}>{need.title}</H5>
			{need.description ? (
				<Caption
					color="secondary"
					numberOfLines={4}
					style={{ marginTop: spacing[1] }}
				>
					{need.description}
				</Caption>
			) : null}

			<View
				style={{
					marginTop: spacing[4],
					paddingTop: spacing[4],
					borderTopWidth: 1,
					borderTopColor: colors.border.hairline,
					gap: spacing[2],
				}}
			>
				{target > 0 ? (
					<>
						<View
							style={{
								flexDirection: "row",
								alignItems: "baseline",
								justifyContent: "space-between",
								gap: spacing[3],
							}}
						>
							<Label weight="semibold" style={{ flexShrink: 1 }}>
								{remaining === 0
									? `Target met - ${target}${unit}`
									: `${remaining}${unit} still ${need.type === "WANT" ? "needed" : "to give"}`}
							</Label>
							<Caption color="quaternary">
								{need.fulfilledQuantity} of {target}
							</Caption>
						</View>
						<Meter
							value={need.fulfilledQuantity}
							max={target}
							label={formatProgress(
								need.fulfilledQuantity,
								need.quantity,
								need.unit,
							)}
						/>
					</>
				) : (
					<FactLine
						icon={Package}
						text={`${formatProgress(need.fulfilledQuantity, null, need.unit)} - no target set`}
					/>
				)}
				<View style={{ gap: spacing[1.5], marginTop: spacing[1] }}>
					{need.city ? <FactLine icon={MapPin} text={need.city} /> : null}
					<FactLine
						icon={Clock}
						text={
							expires
								? expired
									? `Closed ${formatDate(need.expiresAt)}`
									: `Open until ${formatDate(need.expiresAt)}`
								: "No closing date"
						}
						color={expired ? (colors.error.ink as string) : undefined}
					/>
				</View>
			</View>
		</Surface>
	);
}
