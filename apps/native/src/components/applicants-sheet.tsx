import type { ApplicationStatus, BulkResult } from "@nabhya/shared";
import { Users } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { Tick } from "@/components/admin/data-table";
import { ContactActions } from "@/components/contact-actions";
import { Field, useFieldInputStyle } from "@/components/form-field";
import { InitialAvatar } from "@/components/initial-avatar";
import { LoadMoreFooter } from "@/components/load-more-footer";
import { useFormButtonGrow } from "@/components/ngo/form-footer";
import { EventSummary } from "@/components/ngo/record-summary";
import { usePagedQuery } from "@/components/paged-list";
import {
	EmptyState,
	ErrorState,
	FilterChips,
	SectionTitle,
	SkeletonList,
	Surface,
} from "@/components/screen-shell";
import {
	applicationTone,
	humanizeStatus,
	StatusPill,
} from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { confirm, toast } from "@/components/ui/overlay";
import { Pressable } from "@/components/ui/pressable";
import { Body, BodySmall, Caption, Label } from "@/components/ui/typography";
import {
	useBulkAttendance,
	useIssueCertificate,
	useMarkAttendance,
	useRevokeCertificate,
} from "@/hooks/use-engagement";
import {
	useBulkReviewApplications,
	useOrgEvent,
	useReviewApplication,
} from "@/hooks/use-events";
import { useOrgAccess } from "@/hooks/use-org-access";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage, orgEventsApi, queryKeys } from "@/lib/api";
import { focusable } from "@/lib/focus";
import { formatRelative } from "@/lib/format";
import type { EventApplicant, OrgEventListItem } from "@/lib/types";

type StatusFilter = "ALL" | ApplicationStatus;

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
	{ value: "PENDING", label: "Pending" },
	{ value: "ACCEPTED", label: "Accepted" },
	{ value: "REJECTED", label: "Rejected" },
	{ value: "ALL", label: "All" },
];

type BulkAction = "ACCEPT" | "REJECT" | "MARK_ATTENDED" | "ISSUE_CERTIFICATE";

/** Which applicants a filter's selection can act on. */
const SELECTABLE: Partial<Record<StatusFilter, ApplicationStatus>> = {
	PENDING: "PENDING",
	ACCEPTED: "ACCEPTED",
};

/**
 * One event as a record: the event itself, then everyone who applied to it -
 * decide, then, after the event, mark attendance and issue certificates.
 *
 * ## A drawer, not a dialog
 *
 * This was a centred `Sheet` titled "Applicants" whose only fact about the
 * event was "100 places left". Reviewing is not leaving the events list - the
 * organiser works down it - so on desktop it is a right-hand `Drawer` (`xl`,
 * like the admin dossiers) with the list still visible behind it, and it opens
 * on the event's summary (`EventSummary`: state, when, where, how full, Edit)
 * before the people. On a phone `Drawer` is a sheet, as before. The rows are
 * rendered inline rather than in a `SheetFlatList`, because the drawer's body
 * is already the scroller; paging is the footer's explicit "Load more".
 *
 * ## Counts on the chips
 *
 * The server returns every state's count with each page (`counts`, across the
 * event, whatever the filter), so "Pending 3 / Accepted 2" is legible before a
 * chip is pressed and an empty filter is not a tap to find out.
 *
 * ## Selection
 *
 * Reviewing fifty applicants used to be fifty Accept taps, and certifying
 * thirty volunteers about ninety (mark attended, issue, confirm). The Pending
 * and Accepted filters take a tick per row and a select-all, and the pinned
 * footer acts on the selection through the server's bulk endpoints, which
 * apply each row through the single-row path and report per-row outcomes.
 * Rows that fail stay ticked with the reason on them, so "18 of 20" names the
 * two. Filters are four peers, so they stay chips.
 *
 * ## Notes travel with one person
 *
 * The note lives on the row it is for, never in one field "sent with your
 * next decision" - which sent a note meant for one applicant to whoever was
 * clicked next.
 *
 * ## Who may do what
 *
 * Every control asks `useOrgAccess()`: review is `people.review`, attendance
 * `people.attendance`, issuing `certs.issue`, revoking `certs.revoke`.
 */
export function ApplicantsDrawer({
	event,
	onClose,
	onEdit,
}: {
	event: OrgEventListItem | null;
	onClose: () => void;
	/**
	 * Opens the editor. The screen closes this drawer first and opens the form
	 * after it - sequentially, never a drawer inside a drawer.
	 */
	onEdit?: (event: OrgEventListItem) => void;
}) {
	const { spacing } = useTheme();
	const eventId = event?.id ?? null;
	const remainingPlaces = event
		? Math.max(event.volunteersNeeded - event.acceptedCount, 0)
		: 0;
	const [filter, setFilterState] = useState<StatusFilter>("PENDING");
	const [selected, setSelected] = useState<Set<string>>(new Set());
	// Per-row reasons from the last bulk action, shown on the row itself.
	const [failures, setFailures] = useState<Record<string, string>>({});

	const params = filter === "ALL" ? {} : { status: filter };
	const { query, items, first, loadMore } = usePagedQuery({
		queryKey: queryKeys.orgEventApplicants(eventId ?? "", params),
		fetchPage: (page) =>
			orgEventsApi.applicants(eventId as string, {
				...params,
				page,
				limit: 20,
			}),
		enabled: !!eventId,
	});
	const detail = useOrgEvent(eventId ?? undefined);
	const review = useReviewApplication(eventId ?? "");
	const bulkReview = useBulkReviewApplications(eventId ?? "");
	const bulkAttendance = useBulkAttendance(eventId ?? "");

	const access = useOrgAccess();
	const blocked = {
		review: access.blocked("people.review"),
		attendance: access.blocked("people.attendance"),
		issue: access.blocked("certs.issue"),
		revoke: access.blocked("certs.revoke"),
	};

	const counts = first?.counts;
	const chipOptions = withCounts(FILTERS, (value) =>
		counts ? (value === "ALL" ? counts.all : counts[value]) : undefined,
	);

	const selectableStatus = SELECTABLE[filter];
	const selectable = selectableStatus
		? items.filter((item) => item.status === selectableStatus)
		: [];
	const allSelected =
		selectable.length > 0 && selectable.every((item) => selected.has(item.id));

	const clearSelection = () => {
		setSelected(new Set());
		setFailures({});
	};

	const setFilter = (next: StatusFilter) => {
		setFilterState(next);
		clearSelection();
	};

	const close = () => {
		setFilterState("PENDING");
		clearSelection();
		onClose();
	};

	const toggle = (id: string) =>
		setSelected((current) => {
			const next = new Set(current);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});

	const toggleAll = () =>
		setSelected(
			allSelected ? new Set() : new Set(selectable.map((item) => item.id)),
		);

	const decide = async (
		applicant: EventApplicant,
		status: "ACCEPTED" | "REJECTED",
		note: string,
	) => {
		const who = applicant.volunteer.fullName ?? "The volunteer";
		if (status === "REJECTED") {
			// A decision the volunteer is notified of and cannot be taken back
			// from here, so it is confirmed by name.
			const ok = await confirm({
				title: `Reject ${who}?`,
				message: note
					? "They'll be told it's a no this time, with your note."
					: "They'll be told it's a no this time.",
				confirmLabel: "Reject",
				cancelLabel: "Keep pending",
			});
			if (!ok) return;
		}
		review.mutate(
			{
				applicationId: applicant.id,
				input: { status, reviewNote: note.trim() || undefined },
			},
			{
				onSuccess: () =>
					toast.success(
						status === "ACCEPTED"
							? `${who} accepted. They have been notified.`
							: `${who} declined. They have been notified.`,
					),
				onError: (error) => toast.error(apiErrorMessage(error)),
			},
		);
	};

	const report = (result: BulkResult, verb: string) => {
		setFailures(Object.fromEntries(result.failed.map((f) => [f.id, f.reason])));
		// Keep the failures ticked so a retry is one press away.
		setSelected(new Set(result.failed.map((f) => f.id)));
		if (result.failed.length === 0) {
			toast.success(`${result.done.length} ${verb}.`);
		} else {
			toast.error(
				`${result.done.length} ${verb}. ${result.failed.length} couldn't be - the reason is on each row still ticked.`,
			);
		}
	};

	const runBulk = async (action: BulkAction) => {
		const ids = [...selected];
		const n = ids.length;
		const people = `${n} ${n === 1 ? "applicant" : "applicants"}`;

		if (action === "REJECT") {
			const ok = await confirm({
				title: `Reject ${people}?`,
				message: "Each of them is told it's a no this time.",
				confirmLabel: `Reject ${n}`,
				cancelLabel: "Keep pending",
			});
			if (!ok) return;
		}
		if (action === "ISSUE_CERTIFICATE") {
			const ok = await confirm({
				title: `Issue ${n} ${n === 1 ? "certificate" : "certificates"}?`,
				message:
					"Each volunteer is notified and gets a verifiable certificate for the hours recorded on their row (the whole event if none). A certificate can be revoked later, never deleted.",
				confirmLabel: "Issue",
			});
			if (!ok) return;
		}

		const onError = (error: unknown) => toast.error(apiErrorMessage(error));
		if (action === "ACCEPT" || action === "REJECT") {
			bulkReview.mutate(
				{ ids, status: action === "ACCEPT" ? "ACCEPTED" : "REJECTED" },
				{
					onSuccess: (result) =>
						report(result, action === "ACCEPT" ? "accepted" : "declined"),
					onError,
				},
			);
		} else {
			bulkAttendance.mutate(
				{ ids, action },
				{
					onSuccess: (result) =>
						report(
							result,
							action === "MARK_ATTENDED"
								? "marked attended"
								: "certificates issued",
						),
					onError,
				},
			);
		}
	};

	const bulkBusy = bulkReview.isPending || bulkAttendance.isPending;

	const footer =
		selected.size > 0 ? (
			<BulkBar
				count={selected.size}
				mode={filter === "ACCEPTED" ? "attendance" : "review"}
				blocked={blocked}
				placesLeft={remainingPlaces}
				busy={bulkBusy}
				pending={
					bulkReview.isPending
						? bulkReview.variables?.status === "ACCEPTED"
							? "ACCEPT"
							: "REJECT"
						: bulkAttendance.isPending
							? (bulkAttendance.variables?.action ?? null)
							: null
				}
				onRun={runBulk}
				onClear={clearSelection}
			/>
		) : undefined;

	let list: React.ReactNode;
	if (query.isLoading) {
		list = <SkeletonList variant="card" count={3} />;
	} else if (query.isError) {
		list = (
			<ErrorState
				message={apiErrorMessage(query.error)}
				onRetry={() => query.refetch()}
			/>
		);
	} else if (items.length === 0) {
		list = (
			<EmptyState
				icon={Users}
				title={
					event?.status === "DRAFT"
						? "Not taking applications yet"
						: (event?.status === "COMPLETED" ||
									event?.status === "CANCELLED") &&
								(counts?.all ?? 0) === 0
							? "No applications on record"
							: filter === "PENDING"
								? "No one waiting"
								: "No applicants here"
				}
				description={
					// A draft is invisible to volunteers; "new applications land
					// here" promised something that cannot happen until it is
					// published.
					event?.status === "DRAFT"
						? "Volunteers can't see a draft. Publish it and applications land here."
						: (event?.status === "COMPLETED" ||
									event?.status === "CANCELLED") &&
								(counts?.all ?? 0) === 0
							? "This event is over and took no applications through Nabhya."
							: filter === "PENDING"
								? (counts?.all ?? 0) > 0
									? "Every application has a decision. The other filters hold them."
									: "New applications land here. The events list shows a count too."
								: "Nothing matches this filter yet."
				}
			/>
		);
	} else {
		list = (
			<View style={{ gap: spacing[3] }}>
				{items.map((item) => (
					<ApplicantRow
						key={item.id}
						applicant={item}
						eventId={eventId ?? ""}
						canAccept={remainingPlaces > 0}
						blocked={blocked}
						selectable={item.status === selectableStatus}
						selected={selected.has(item.id)}
						onToggleSelect={() => toggle(item.id)}
						failure={failures[item.id] ?? null}
						deciding={
							review.isPending && review.variables?.applicationId === item.id
								? review.variables.input.status
								: null
						}
						onDecide={(status, note) => decide(item, status, note)}
					/>
				))}
				<LoadMoreFooter
					hasMore={!!query.hasNextPage}
					loading={query.isFetchingNextPage}
					onLoadMore={loadMore}
					count={items.length}
					noun="applicants"
				/>
			</View>
		);
	}

	return (
		<Drawer
			visible={!!event}
			onClose={close}
			title={event?.title ?? "Event"}
			subtitle="Event and applicants"
			xl
			footer={footer}
		>
			{event && (
				<EventSummary
					event={event}
					detail={detail.data}
					onEdit={onEdit ? () => onEdit(event) : undefined}
				/>
			)}

			<View style={{ marginTop: spacing[6] }}>
				<SectionTitle>Applicants</SectionTitle>
				<FilterChips
					label="Filter applicants"
					options={chipOptions}
					value={filter}
					onChange={setFilter}
				/>
				{selectable.length > 1 ? (
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: spacing[3],
							paddingHorizontal: spacing[4],
							marginTop: -spacing[2],
							marginBottom: spacing[3],
						}}
					>
						<Tick
							checked={allSelected}
							partial={!allSelected && selected.size > 0}
							onPress={toggleAll}
							label={
								allSelected ? "Clear selection" : "Select every applicant shown"
							}
						/>
						<Caption color="tertiary">
							{selected.size > 0
								? `${selected.size} of ${selectable.length} selected`
								: `Select all ${selectable.length} shown`}
						</Caption>
					</View>
				) : null}
				{list}
			</View>
		</Drawer>
	);
}

/**
 * Filter chips with each option's count - "Pending 3". A count the server
 * has not sent yet is left off rather than shown as 0. Shared with the pledge
 * drawer.
 */
export function withCounts<T extends string>(
	options: Array<{ value: T; label: string }>,
	countOf: (value: T) => number | undefined,
): Array<{ value: T; label: string; count?: number }> {
	return options.map((option) => {
		const count = countOf(option.value);
		return count === undefined ? option : { ...option, count };
	});
}

type Blocked = Record<
	"review" | "attendance" | "issue" | "revoke",
	string | null
>;

/**
 * The pinned action row for a selection. Pending selections are decided;
 * accepted ones are marked present or certified. A role that cannot take an
 * action sees it disabled with the reason, not hidden.
 */
function BulkBar({
	count,
	mode,
	blocked,
	placesLeft,
	busy,
	pending,
	onRun,
	onClear,
}: {
	count: number;
	mode: "review" | "attendance";
	blocked: Blocked;
	placesLeft: number;
	busy: boolean;
	pending: BulkAction | null;
	onRun: (action: BulkAction) => void;
	onClear: () => void;
}) {
	const { spacing } = useTheme();
	const grow = useFormButtonGrow();

	const reason =
		mode === "review"
			? blocked.review
			: (blocked.attendance ?? blocked.issue ?? null);
	const acceptNote =
		mode === "review" && !blocked.review && count > placesLeft
			? placesLeft === 0
				? "No places left - only Reject is open."
				: `Only ${placesLeft} place${placesLeft === 1 ? "" : "s"} left - the rest will be reported back.`
			: null;

	return (
		<View style={{ gap: spacing[2] }}>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
				}}
			>
				<Label weight="semibold">{count} selected</Label>
				<Button variant="link" size="sm" onPress={onClear} disabled={busy}>
					Clear
				</Button>
			</View>
			{mode === "review" ? (
				<View style={{ flexDirection: "row", gap: spacing[2] }}>
					<Button
						style={grow}
						disabled={busy || !!blocked.review || placesLeft === 0}
						loading={pending === "ACCEPT"}
						onPress={() => onRun("ACCEPT")}
					>
						{`Accept ${count}`}
					</Button>
					<Button
						variant="outline"
						style={grow}
						disabled={busy || !!blocked.review}
						loading={pending === "REJECT"}
						onPress={() => onRun("REJECT")}
					>
						{`Reject ${count}`}
					</Button>
				</View>
			) : (
				<View style={{ flexDirection: "row", gap: spacing[2] }}>
					<Button
						variant="outline"
						style={grow}
						disabled={busy || !!blocked.attendance}
						loading={pending === "MARK_ATTENDED"}
						onPress={() => onRun("MARK_ATTENDED")}
					>
						Mark attended
					</Button>
					<Button
						style={grow}
						disabled={busy || !!blocked.issue}
						loading={pending === "ISSUE_CERTIFICATE"}
						onPress={() => onRun("ISSUE_CERTIFICATE")}
					>
						Issue certificates
					</Button>
				</View>
			)}
			{reason || acceptNote ? (
				<Caption color="tertiary">{reason ?? acceptNote}</Caption>
			) : null}
		</View>
	);
}

function ApplicantRow({
	applicant,
	eventId,
	canAccept,
	blocked,
	selectable,
	selected,
	onToggleSelect,
	failure,
	deciding,
	onDecide,
}: {
	applicant: EventApplicant;
	eventId: string;
	canAccept: boolean;
	blocked: Blocked;
	/** Whether this row can join the current filter's selection. */
	selectable: boolean;
	selected: boolean;
	onToggleSelect: () => void;
	/** Why the last bulk action failed on this row, if it did. */
	failure: string | null;
	/** Which decision is in flight for *this* row, if any. */
	deciding: "ACCEPTED" | "REJECTED" | null;
	onDecide: (status: "ACCEPTED" | "REJECTED", note: string) => void;
}) {
	const { colors, spacing } = useTheme();
	const grow = useFormButtonGrow();
	const inputStyle = useFieldInputStyle();
	const [note, setNote] = useState("");
	const [noteOpen, setNoteOpen] = useState(false);
	const isPending = applicant.status === "PENDING";
	const busy = deciding !== null;
	const name = applicant.volunteer.fullName ?? "Unnamed volunteer";
	const verified = applicant.volunteer.verificationStatus === "VERIFIED";
	// City only: contact details wait for acceptance (`ContactActions`).
	const meta = [applicant.volunteer.city, verified ? "ID verified" : null]
		.filter(Boolean)
		.join(" · ");

	return (
		<Surface>
			<View
				style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}
			>
				{selectable ? (
					<Tick
						checked={selected}
						onPress={onToggleSelect}
						label={selected ? `Deselect ${name}` : `Select ${name}`}
					/>
				) : null}
				<InitialAvatar name={applicant.volunteer.fullName} />
				<View style={{ flex: 1, minWidth: 0 }}>
					<Body weight="bold" numberOfLines={1}>
						{name}
					</Body>
					<Caption
						color={verified ? (colors.success.ink as string) : "tertiary"}
						numberOfLines={1}
					>
						{meta}
					</Caption>
				</View>
				<StatusPill
					label={humanizeStatus(applicant.status)}
					tone={applicationTone(applicant.status)}
				/>
			</View>

			{failure ? (
				<Caption
					color={colors.error.ink as string}
					style={{ marginTop: spacing[2] }}
				>
					{failure}
				</Caption>
			) : null}

			{applicant.message && (
				<View
					style={{
						marginTop: spacing[3],
						paddingLeft: spacing[3],
						borderLeftWidth: 2,
						borderLeftColor: colors.border.dark,
					}}
				>
					<BodySmall color="secondary">“{applicant.message}”</BodySmall>
				</View>
			)}

			<Caption color="quaternary" style={{ marginTop: spacing[2] }}>
				Applied {formatRelative(applicant.appliedAt)}
				{applicant.reviewNote ? ` · Your note: ${applicant.reviewNote}` : ""}
			</Caption>

			{applicant.status === "ACCEPTED" && (
				<>
					<ContactActions
						name={name}
						phone={applicant.volunteer.phone}
						email={applicant.volunteer.email}
					/>
					<AttendanceControls
						applicant={applicant}
						eventId={eventId}
						blocked={blocked}
					/>
				</>
			)}

			{isPending && (
				<>
					{blocked.review ? (
						<Caption color="tertiary" style={{ marginTop: spacing[4] }}>
							{blocked.review}
						</Caption>
					) : noteOpen ? (
						<Field
							label={`Note to ${name}`}
							optional
							hint="Sent with your decision. Where to meet, what to bring, or why not this time."
							style={{ marginTop: spacing[4], marginBottom: 0 }}
						>
							<Input
								placeholder="e.g. Meet at Gate 3 by 8am, wear closed shoes"
								value={note}
								onChangeText={setNote}
								style={inputStyle}
								autoFocus
							/>
						</Field>
					) : (
						<Button
							variant="link"
							size="sm"
							onPress={() => setNoteOpen(true)}
							style={{ alignSelf: "flex-start", marginTop: spacing[2] }}
							accessibilityLabel={`Add a note for ${name}`}
						>
							Add a note
						</Button>
					)}
					<View
						style={{
							flexDirection: "row",
							gap: spacing[2],
							marginTop: spacing[3],
						}}
					>
						<Button
							style={grow}
							disabled={busy || !canAccept || !!blocked.review}
							loading={deciding === "ACCEPTED"}
							onPress={() => onDecide("ACCEPTED", note)}
							accessibilityLabel={`Accept ${name}`}
						>
							Accept
						</Button>
						<Button
							variant="outline"
							style={grow}
							disabled={busy || !!blocked.review}
							loading={deciding === "REJECTED"}
							onPress={() => onDecide("REJECTED", note)}
							accessibilityLabel={`Reject ${name}`}
						>
							Reject
						</Button>
					</View>
				</>
			)}
		</Surface>
	);
}

/**
 * Post-event controls for an accepted volunteer.
 *
 * Attendance is deliberately an explicit confirmation rather than something
 * inferred from the event's end date, and the server refuses to issue a
 * certificate without it. It is a checkbox, not a button that relabels itself
 * ("Attended ✓"), because it is a state you set and can see - and un-ticking
 * now says so.
 */
function AttendanceControls({
	applicant,
	eventId,
	blocked,
}: {
	applicant: EventApplicant;
	eventId: string;
	blocked: Blocked;
}) {
	const { colors, spacing } = useTheme();
	const inputStyle = useFieldInputStyle();
	const [note, setNote] = useState("");
	const [showNote, setShowNote] = useState(false);

	const attendance = useMarkAttendance(eventId);
	const issue = useIssueCertificate(eventId);
	const revoke = useRevokeCertificate();

	const attended = !!applicant.attendedAt;
	const certificate = applicant.certificate;
	const busy = attendance.isPending || issue.isPending || revoke.isPending;
	const name = applicant.volunteer.fullName ?? "this volunteer";

	// Issue #8. The certificate prints these hours and is rendered once, at
	// issue, so they are editable only until then. Blank means the whole event.
	const recorded = applicant.hoursServed ? Number(applicant.hoursServed) : null;
	const [hours, setHours] = useState(recorded === null ? "" : String(recorded));
	const parsedHours = hours.trim() === "" ? null : Number(hours);
	const hoursValid =
		parsedHours === null ||
		(Number.isFinite(parsedHours) &&
			parsedHours >= 0.5 &&
			parsedHours <= 500 &&
			Number.isInteger(parsedHours * 2));
	const hoursChanged = parsedHours !== recorded;

	const saveHours = () => {
		if (!hoursValid) return;
		attendance.mutate(
			{ applicationId: applicant.id, attended: true, hours: parsedHours },
			{
				onSuccess: () =>
					toast.success(
						parsedHours === null
							? "Hours reset to the whole event."
							: `${parsedHours} hours recorded.`,
					),
				onError: (error) => toast.error(apiErrorMessage(error)),
			},
		);
	};

	const confirmRevoke = async () => {
		if (!certificate) return;
		// The record survives revocation, so a link already shared with an
		// employer resolves to "revoked" rather than disappearing.
		const ok = await confirm({
			title: "Revoke this certificate?",
			message: `${certificate.code} will show as revoked to anyone who verifies it, including anyone the volunteer has already sent it to. This cannot be undone.`,
			confirmLabel: "Revoke",
		});
		if (!ok) return;
		revoke.mutate(
			{ id: certificate.id, reason: "Revoked by the organization" },
			{
				onSuccess: () => toast.success("Certificate revoked."),
				onError: (error) => toast.error(apiErrorMessage(error)),
			},
		);
	};

	const toggleAttendance = () => {
		const next = !attended;
		attendance.mutate(
			{ applicationId: applicant.id, attended: next },
			{
				onSuccess: () =>
					toast.success(
						next
							? `${name} marked attended.`
							: `Attendance removed for ${name}.`,
					),
				onError: (error) => toast.error(apiErrorMessage(error)),
			},
		);
	};

	const issueCertificate = () => {
		issue.mutate(
			{ applicationId: applicant.id, note: note.trim() || undefined },
			{
				onSuccess: () => {
					setNote("");
					setShowNote(false);
					toast.success("Certificate issued. The volunteer has been notified.");
				},
				onError: (error) => toast.error(apiErrorMessage(error)),
			},
		);
	};

	return (
		<View
			style={{
				marginTop: spacing[3],
				paddingTop: spacing[3],
				borderTopWidth: 1,
				borderTopColor: colors.border.hairline,
				gap: spacing[2],
			}}
		>
			{certificate ? (
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						justifyContent: "space-between",
						gap: spacing[3],
					}}
				>
					<View style={{ flex: 1 }}>
						<Caption
							weight="medium"
							color={
								certificate.revokedAt
									? (colors.error.ink as string)
									: (colors.success.ink as string)
							}
						>
							{certificate.revokedAt
								? "Certificate revoked"
								: `Certificate ${certificate.code}`}
						</Caption>
						<Caption color="quaternary">
							{recorded === null
								? "Attended · whole event"
								: `Attended · ${recorded} h`}
						</Caption>
					</View>
					{/* A role that cannot revoke loses the control, not just its use. */}
					{!certificate.revokedAt && !blocked.revoke && (
						<Button
							variant="outline"
							size="sm"
							onPress={confirmRevoke}
							disabled={busy}
							loading={revoke.isPending}
						>
							Revoke
						</Button>
					)}
				</View>
			) : (
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[3],
						flexWrap: "wrap",
					}}
				>
					<Pressable
						onPress={toggleAttendance}
						disabled={busy || !!blocked.attendance}
						accessibilityRole="checkbox"
						accessibilityState={{
							checked: attended,
							disabled: busy || !!blocked.attendance,
						}}
						accessibilityLabel={`${name} attended`}
						{...focusable}
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: spacing[2],
							minHeight: 44,
							opacity: blocked.attendance ? 0.5 : 1,
						}}
					>
						<Tick checked={attended} label={`${name} attended`} />
						<Label>Attended</Label>
					</Pressable>
					{attended && (
						<Button
							size="sm"
							onPress={() => setShowNote((v) => !v)}
							disabled={busy || !!blocked.issue}
						>
							Issue certificate
						</Button>
					)}
					{!attended && !blocked.attendance && (
						<Caption color="quaternary" style={{ flex: 1 }}>
							Tick after the event to issue a certificate.
						</Caption>
					)}
				</View>
			)}

			{!certificate && (blocked.attendance || (attended && blocked.issue)) ? (
				<Caption color="tertiary">
					{blocked.attendance ?? blocked.issue}
				</Caption>
			) : null}

			{attended && !certificate && !blocked.attendance && (
				<View
					style={{
						flexDirection: "row",
						alignItems: "flex-end",
						gap: spacing[3],
						marginTop: spacing[1],
					}}
				>
					<Field
						label="Hours served"
						optional
						hint={
							hoursValid
								? "Leave blank for the whole event. Printed on the certificate."
								: "Use half-hour steps between 0.5 and 500."
						}
						style={{ flex: 1, marginBottom: 0 }}
					>
						<Input
							placeholder="Whole event"
							value={hours}
							onChangeText={(value) => setHours(value.replace(/[^\d.]/g, ""))}
							keyboardType="decimal-pad"
							maxLength={5}
							accessibilityLabel={`Hours ${name} served`}
							style={[inputStyle, { maxWidth: 140 }]}
						/>
					</Field>
					{hoursChanged && (
						<Button
							size="sm"
							variant="outline"
							onPress={saveHours}
							disabled={busy || !hoursValid}
							loading={attendance.isPending}
							style={{ marginBottom: spacing[6] }}
						>
							Save hours
						</Button>
					)}
				</View>
			)}

			{showNote && !certificate && !blocked.issue && (
				<View style={{ marginTop: spacing[2] }}>
					<Field
						label="Note on the certificate"
						optional
						hint="e.g. led the registration desk"
						style={{ marginBottom: spacing[3] }}
					>
						<Input
							placeholder="Their role, anything worth recording"
							value={note}
							onChangeText={setNote}
							style={inputStyle}
						/>
					</Field>
					<Button
						onPress={issueCertificate}
						disabled={busy || hoursChanged}
						loading={issue.isPending}
					>
						Confirm and issue
					</Button>
					{hoursChanged && (
						<Caption
							color="tertiary"
							style={{ marginTop: spacing[2], textAlign: "center" }}
						>
							Save the hours first - they go on the certificate.
						</Caption>
					)}
				</View>
			)}
		</View>
	);
}
