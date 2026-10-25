import { inviteTeamMemberSchema } from "@nabhya/shared";
import {
	ChevronDown,
	ChevronUp,
	Eye,
	KeyRound,
	MailPlus,
	UserPlus,
	Users,
} from "lucide-react-native";
import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { DataTable, type TableColumn } from "@/components/admin/data-table";
import { SwitchRow } from "@/components/composer/switch-row";
import { Field, FieldError, useFieldInputStyle } from "@/components/form-field";
import { InitialAvatar } from "@/components/initial-avatar";
import { RoleMatrix } from "@/components/ngo/role-matrix";
import {
	EmptyState,
	ErrorState,
	FilterChips,
	ListRow,
	LoadingState,
	Screen,
	ScreenHeader,
	SectionTitle,
	Surface,
} from "@/components/screen-shell";
import { type PillTone, StatusPill } from "@/components/status-pill";
import { TextAction } from "@/components/text-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirm, toast } from "@/components/ui/overlay";
import { Sheet, SheetOption } from "@/components/ui/sheet";
import { Body, Caption, H3 } from "@/components/ui/typography";
import {
	useConfirmOwnershipTransfer,
	useCreateTeamInvite,
	useLeaveTeam,
	useOrgTeam,
	useRemoveAdmin,
	useRequestOwnershipTransfer,
	useResendTeamInvite,
	useRevokeTeamInvite,
	useTeamInvites,
	useUpdateAdmin,
} from "@/hooks/use-directory";
import { useOrgAccess } from "@/hooks/use-org-access";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";

import { apiErrorMessage } from "@/lib/api";
import { copyText } from "@/lib/clipboard";
import { formatDate } from "@/lib/format";
import { verticalScrollbar } from "@/lib/scroll";
import { TEAM_ROLE_COPY, TEAM_ROLE_LABELS } from "@/lib/team-roles";
import type { OrgTeamMember, TeamInvite, TeamStatusFilter } from "@/lib/types";

const ROLES = ["ADMIN", "MANAGER", "MEMBER", "VIEWER"] as const;

/**
 * One filter, not a chip row plus an "Include people who left" switch. The
 * switch never worked: the server's team query defaults `status` to ACTIVE, so
 * `includeLeft` alone still returned only active rows. Asking for LEFT by name
 * (with `includeLeft`, which lifts the server's own LEFT exclusion) is the one
 * combination that does return them. REMOVED rows have no chip - nothing on
 * this screen can act on one.
 */
type MemberFilter = TeamStatusFilter | "LEFT";

const STATUS_OPTIONS: Array<{ value: MemberFilter; label: string }> = [
	{ value: "ACTIVE", label: "Active" },
	{ value: "SUSPENDED", label: "Suspended" },
	{ value: "LEFT", label: "Left" },
];

const EMPTY_COPY: Record<MemberFilter, { title: string; description: string }> =
	{
		ACTIVE: {
			title: "Just you so far",
			description:
				"Invite colleagues, coordinators or accountants with the minimum access they need.",
		},
		SUSPENDED: {
			title: "No suspended teammates",
			description:
				"Suspended teammates will appear here until they are reactivated.",
		},
		LEFT: {
			title: "Nobody has left",
			description: "Teammates who leave the team will be listed here.",
		},
	};

/**
 * Organisation team management: members, pending invites, and ownership.
 * The team endpoint returns the whole team (no paging), so a ScrollView is
 * enough here - see the paged-list note in apps/native/AGENTS.md.
 *
 * Members and invites are cards on a phone and the console's `DataTable` on
 * desktop, as the other NGO lists are. A team is a set of records compared
 * down a column - who is an admin, whose invite is about to expire - and a
 * full-width card per person spent 120pt of height on a name, an email and a
 * pill. The table has no scroller of its own and this page's `ScrollView` is
 * the only one, so its header sticks at the top of that.
 */
export default function OrgTeam() {
	const { colors, spacing } = useTheme();
	const { isDesktop } = useMedia();
	const [status, setStatus] = useState<MemberFilter>("ACTIVE");
	const [showRoleGuide, setShowRoleGuide] = useState(false);
	const [showConfirmTransfer, setShowConfirmTransfer] = useState(false);
	const [inviting, setInviting] = useState(false);
	const [managing, setManaging] = useState<OrgTeamMember | null>(null);
	const [transferring, setTransferring] = useState(false);

	// Every control here mirrors a server permission, so nobody is offered a
	// button that 403s: inviting (and seeing invites) is `team.invite`,
	// changing someone is `team.changeRole`, and ownership is the owner's.
	const access = useOrgAccess();
	const canInvite = !access.blocked("team.invite");
	const canManage = !access.blocked("team.changeRole");
	const isOwner = access.isOwner;
	// Only an active admin can receive ownership (`requestOwnershipTransfer`).
	const canReceiveOwnership = access.role === "ADMIN";

	const teamQuery = useOrgTeam(
		status === "LEFT" ? { status, includeLeft: true } : { status },
	);
	const invitesQuery = useTeamInvites(canInvite);
	const items = teamQuery.data ?? [];
	const invites = invitesQuery.data ?? [];
	const loading = teamQuery.isLoading || (canInvite && invitesQuery.isLoading);
	const refreshing = teamQuery.isRefetching || invitesQuery.isRefetching;

	const refetch = () => {
		void teamQuery.refetch();
		// `refetch` ignores `enabled`, so guard it the same way.
		if (canInvite) void invitesQuery.refetch();
	};

	const memberCount =
		status === "ACTIVE"
			? // A legacy owner has no team row, so an empty list is the owner
				// alone - "0 active members" contradicted "Just you so far" below.
				items.length === 0
				? "Just you"
				: `${items.length} active ${items.length === 1 ? "member" : "members"}`
			: status === "SUSPENDED"
				? `${items.length} suspended`
				: `${items.length} left`;
	const empty = EMPTY_COPY[status];

	return (
		<Screen>
			<ScreenHeader
				// A rail destination on desktop; a pushed page on a phone.
				back={!isDesktop}
				title="Team"
				subtitle={
					canInvite ? `${memberCount} · ${invites.length} pending` : memberCount
				}
				action={
					canInvite ? (
						<Button size="sm" onPress={() => setInviting(true)}>
							Invite
						</Button>
					) : undefined
				}
			/>

			{loading ? (
				<LoadingState />
			) : teamQuery.isError ? (
				<ErrorState
					message={apiErrorMessage(teamQuery.error)}
					onRetry={refetch}
				/>
			) : (
				<ScrollView
					{...verticalScrollbar}
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={refetch}
							tintColor={colors.text.quaternary as string}
						/>
					}
					contentContainerStyle={{
						gap: spacing[5],
						paddingBottom: spacing[10],
					}}
				>
					{/* The header's Invite is the one way in; a second button here
					    was a third invite control on one screen. */}
					<View>
						<SectionTitle>Members</SectionTitle>
						{!canInvite && !access.isLoading ? (
							<Caption color="tertiary">
								Only owners and admins can invite. Ask an owner or admin.
							</Caption>
						) : null}
					</View>
					{/* Filters only once there is something to filter. */}
					{items.length > 0 || status !== "ACTIVE" ? (
						<FilterChips
							inline
							options={STATUS_OPTIONS}
							value={status}
							onChange={setStatus}
						/>
					) : null}
					{items.length === 0 ? (
						<EmptyState
							icon={Users}
							title={empty.title}
							// No button: the header's Invite is the one way in, and a
							// second orange "Invite someone" sat 260pt below it.
							description={empty.description}
						/>
					) : isDesktop ? (
						<DataTable
							columns={memberColumns(canManage, setManaging)}
							rows={items}
							rowKey={(member) => member.id}
							{...(canManage ? { onRowPress: setManaging } : {})}
							rowLabel={(member) =>
								`Manage ${member.user.fullName ?? member.user.email}`
							}
						/>
					) : (
						<View style={{ gap: spacing[3] }}>
							{items.map((item) => (
								<MemberRow
									key={item.id}
									member={item}
									canManage={canManage}
									onPress={canManage ? () => setManaging(item) : undefined}
								/>
							))}
						</View>
					)}

					{/* Listing invites is `team.invite` too; for anyone else the
					    endpoint 403s, which used to render as an error block. */}
					{canInvite ? (
						<View>
							<SectionTitle>Pending invites</SectionTitle>
							{invitesQuery.isError ? (
								<ErrorState
									message={apiErrorMessage(invitesQuery.error)}
									onRetry={() => void invitesQuery.refetch()}
								/>
							) : invites.length === 0 ? (
								<Surface>
									<View style={{ gap: spacing[2] }}>
										<MailPlus
											size={22}
											color={colors.text.tertiary as string}
										/>
										<Body weight="bold">No pending invites</Body>
										<Caption color="tertiary">
											Invites for new or existing users will appear here with a
											link to copy, resend or revoke.
										</Caption>
									</View>
								</Surface>
							) : isDesktop ? (
								<DataTable
									columns={INVITE_COLUMNS}
									rows={invites}
									rowKey={(invite) => invite.id}
								/>
							) : (
								<View style={{ gap: spacing[3] }}>
									{invites.map((invite) => (
										<InviteRow key={invite.id} invite={invite} />
									))}
								</View>
							)}
						</View>
					) : null}

					{/* Reference, not reading: it was an always-open card of five
					    roles at the foot of the page, which made Team the heaviest
					    screen in the app for the one time anyone needs it. The
					    role picker in the invite and member sheets already explains
					    the role being chosen, so the full table waits behind a row. */}
					<Surface padded={false} style={{ overflow: "hidden" }}>
						<ListRow
							label="What can each role do?"
							onPress={() => setShowRoleGuide((open) => !open)}
							accessibilityLabel={
								showRoleGuide
									? "Hide what each role can do"
									: "What can each role do?"
							}
							value={
								showRoleGuide ? (
									<ChevronUp size={18} color={colors.text.tertiary as string} />
								) : (
									<ChevronDown
										size={18}
										color={colors.text.tertiary as string}
									/>
								)
							}
						/>
						{showRoleGuide ? (
							<View
								style={{
									gap: spacing[3],
									paddingHorizontal: spacing[4],
									paddingBottom: spacing[4],
								}}
							>
								<RoleMatrix />
								<Caption color="quaternary">
									A designation ("Field lead - Pune") is only the label shown
									beside a name; the role is what grants access.
								</Caption>
							</View>
						) : null}
					</Surface>

					<OwnershipSection
						isOwner={isOwner}
						onTransfer={() => setTransferring(true)}
					/>
					{/* Only an admin can receive ownership, and nothing client-side
					    says a transfer is waiting for them - the token travels by
					    hand. So the paste-a-token form stays one small link away
					    rather than a full card every admin scrolls past forever. */}
					{canReceiveOwnership ? (
						showConfirmTransfer ? (
							<ConfirmTransferCard
								onCancel={() => setShowConfirmTransfer(false)}
							/>
						) : (
							<View style={{ alignItems: "flex-start" }}>
								<Button
									size="sm"
									variant="link"
									onPress={() => setShowConfirmTransfer(true)}
								>
									Received an ownership transfer token?
								</Button>
							</View>
						)
					) : null}
				</ScrollView>
			)}

			<InviteSheet visible={inviting} onClose={() => setInviting(false)} />
			<MemberSheet member={managing} onClose={() => setManaging(null)} />
			<TransferSheet
				visible={transferring}
				onClose={() => setTransferring(false)}
			/>
		</Screen>
	);
}

function memberPill(member: OrgTeamMember): {
	label: string;
	tone: PillTone;
} {
	if (member.isOwner || member.role === "OWNER")
		return { label: TEAM_ROLE_LABELS.OWNER, tone: "info" };
	const status = member.status ?? "ACTIVE";
	if (status === "SUSPENDED") return { label: "Suspended", tone: "warning" };
	if (status === "LEFT") return { label: "Left", tone: "neutral" };
	if (status === "REMOVED") return { label: "Removed", tone: "neutral" };
	return { label: TEAM_ROLE_LABELS[member.role ?? "ADMIN"], tone: "neutral" };
}

function memberName(member: OrgTeamMember) {
	return member.user.fullName ?? member.user.email;
}

/** Reactivating a suspended teammate - the card's button and the table's cell. */
function useReactivate(member: OrgTeamMember) {
	const update = useUpdateAdmin();
	const name = memberName(member);
	const reactivate = () => {
		update.mutate(
			{ id: member.id, input: { status: "ACTIVE" } },
			{
				onSuccess: () => toast.success(`${name} reactivated.`),
				onError: (e) => toast.error(apiErrorMessage(e)),
			},
		);
	};
	return { reactivate, pending: update.isPending };
}

/**
 * The members table. Identity flexes; role, designation and date are fixed
 * columns. The row opens the member sheet for a role that can change people,
 * and a suspended row carries Reactivate in place, as the card does.
 */
function memberColumns(
	canManage: boolean,
	onManage: (member: OrgTeamMember) => void,
): Array<TableColumn<OrgTeamMember>> {
	return [
		{
			key: "member",
			header: "Member",
			minWidth: 240,
			render: (member) => (
				<View style={{ minWidth: 0, alignSelf: "stretch" }}>
					<Body weight="medium" numberOfLines={1}>
						{memberName(member)}
					</Body>
					<Caption color="quaternary" numberOfLines={1}>
						{member.user.email}
					</Caption>
				</View>
			),
		},
		{
			key: "role",
			header: "Role",
			width: 130,
			render: (member) => {
				const pill = memberPill(member);
				return <StatusPill label={pill.label} tone={pill.tone} />;
			},
		},
		{
			key: "designation",
			header: "Designation",
			width: 200,
			wideOnly: true,
			render: (member) => (
				<Caption
					color={member.designation ? "tertiary" : "quaternary"}
					numberOfLines={1}
				>
					{member.designation ?? "-"}
					{member.isPublic ? " · Public" : ""}
				</Caption>
			),
		},
		{
			key: "since",
			header: "Since",
			width: 130,
			render: (member) => (
				<Caption color="tertiary" numberOfLines={1}>
					{(member.status === "LEFT" || member.status === "REMOVED") &&
					member.leftAt
						? `Left ${formatDate(member.leftAt)}`
						: formatDate(member.joinedAt)}
				</Caption>
			),
		},
		{
			key: "actions",
			header: "",
			width: 120,
			align: "end",
			render: (member) =>
				!canManage ? null : (member.status ?? "ACTIVE") === "SUSPENDED" ? (
					<ReactivateCell member={member} />
				) : member.isOwner || member.role === "OWNER" ? null : (
					<TextAction
						label="Manage"
						onPress={() => onManage(member)}
						accessibilityLabel={`Manage ${memberName(member)}`}
					/>
				),
		},
	];
}

function ReactivateCell({ member }: { member: OrgTeamMember }) {
	const { reactivate, pending } = useReactivate(member);
	return (
		<TextAction
			label={pending ? "Reactivating…" : "Reactivate"}
			tone="brand"
			disabled={pending}
			onPress={reactivate}
			accessibilityLabel={`Reactivate ${memberName(member)}`}
		/>
	);
}

function MemberRow({
	member,
	canManage,
	onPress,
}: {
	member: OrgTeamMember;
	/** `team.changeRole` - reactivating is a status change, so it needs it too. */
	canManage: boolean;
	onPress?: () => void;
}) {
	const { spacing } = useTheme();
	const { reactivate, pending } = useReactivate(member);
	const pill = memberPill(member);
	const name = memberName(member);
	const suspended = (member.status ?? "ACTIVE") === "SUSPENDED";
	const left = member.status === "LEFT" || member.status === "REMOVED";

	return (
		<Surface
			onPress={onPress}
			footer={
				suspended && canManage ? (
					<View style={{ alignItems: "flex-start", marginTop: spacing[3] }}>
						<Button
							size="sm"
							variant="outline"
							loading={pending}
							accessibilityLabel={`Reactivate ${name}`}
							onPress={reactivate}
						>
							Reactivate
						</Button>
					</View>
				) : undefined
			}
		>
			<View style={{ gap: spacing[3] }}>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[3],
					}}
				>
					<InitialAvatar name={name} />
					<View style={{ flex: 1, minWidth: 0 }}>
						<Body weight="bold" numberOfLines={1}>
							{name}
						</Body>
						<Caption color="tertiary" numberOfLines={1}>
							{member.user.email}
						</Caption>
					</View>
					<StatusPill label={pill.label} tone={pill.tone} />
				</View>
				<Caption color="tertiary" numberOfLines={2}>
					{member.designation ?? "No designation"} ·{" "}
					{left && member.leftAt
						? `Left ${formatDate(member.leftAt)}`
						: `Joined ${formatDate(member.joinedAt)}`}
					{member.isPublic ? " · Public" : ""}
				</Caption>
			</View>
		</Surface>
	);
}

async function copyLink(
	value: string | null | undefined,
	emptyMessage: string,
) {
	if (!value) {
		toast.info(emptyMessage);
		return;
	}
	const ok = await copyText(value);
	if (ok) toast.success("Copied to clipboard.");
	else toast.error("Couldn't copy automatically. Long-press to copy it.");
}

function isRateLimited(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"response" in error &&
		(error as { response?: { status?: number } }).response?.status === 429
	);
}

/** Copy, resend and revoke for one invite - the card's buttons and the table's cell. */
function useInviteActions(invite: TeamInvite) {
	const resend = useResendTeamInvite();
	const revoke = useRevokeTeamInvite();
	const [sharedUrl, setSharedUrl] = useState<string | undefined>(
		invite.inviteUrl,
	);
	const link = invite.inviteUrl ?? sharedUrl;

	const onResend = () => {
		resend.mutate(invite.id, {
			onSuccess: (refreshed) => {
				if (refreshed.inviteUrl) setSharedUrl(refreshed.inviteUrl);
				toast.success(`Invite resent to ${invite.email}.`);
			},
			onError: (e) => {
				if (isRateLimited(e)) {
					toast.error("Resend limit reached (3 per day). Try again tomorrow.");
				} else {
					toast.error(apiErrorMessage(e));
				}
			},
		});
	};

	const onRevoke = async () => {
		const ok = await confirm({
			title: "Revoke invite?",
			message: `${invite.email} won't be able to use this link.`,
			confirmLabel: "Revoke",
		});
		if (!ok) return;
		revoke.mutate(invite.id, {
			onSuccess: () => toast.success(`Invite to ${invite.email} revoked.`),
			onError: (e) => toast.error(apiErrorMessage(e)),
		});
	};

	return {
		link,
		onResend,
		onRevoke,
		resending: resend.isPending,
		revoking: revoke.isPending,
	};
}

/**
 * The invites table. Expiry is its own column because it is the one fact that
 * forces a decision - resend or let it lapse.
 */
const INVITE_COLUMNS: Array<TableColumn<TeamInvite>> = [
	{
		key: "email",
		header: "Invited",
		minWidth: 240,
		render: (invite) => (
			<Body weight="medium" numberOfLines={1}>
				{invite.email}
			</Body>
		),
	},
	{
		key: "role",
		header: "Role",
		width: 130,
		render: (invite) => (
			<Caption color="tertiary">{TEAM_ROLE_LABELS[invite.role]}</Caption>
		),
	},
	{
		key: "expires",
		header: "Expires",
		width: 130,
		render: (invite) => (
			<Caption color="tertiary">{formatDate(invite.expiresAt)}</Caption>
		),
	},
	{
		key: "sent",
		header: "Resent",
		width: 150,
		wideOnly: true,
		render: (invite) =>
			(invite.resentCount ?? 0) > 0 ? (
				<Caption color="tertiary" numberOfLines={1}>
					{invite.resentCount}x
					{invite.lastSentAt ? ` · ${formatDate(invite.lastSentAt)}` : ""}
				</Caption>
			) : (
				<Caption color="quaternary">-</Caption>
			),
	},
	{
		key: "actions",
		header: "",
		width: 250,
		align: "end",
		render: (invite) => <InviteCell invite={invite} />,
	},
];

function InviteCell({ invite }: { invite: TeamInvite }) {
	const { spacing } = useTheme();
	const { link, onResend, onRevoke, resending, revoking } =
		useInviteActions(invite);
	return (
		<View style={{ flexDirection: "row", gap: spacing[3] }}>
			<TextAction
				label="Copy link"
				disabled={!link}
				onPress={() => copyLink(link, "Link appears after resend.")}
				accessibilityLabel={
					link
						? `Copy invite link for ${invite.email}`
						: `Invite link for ${invite.email} appears after a resend`
				}
			/>
			<TextAction
				label={resending ? "Resending…" : "Resend"}
				disabled={resending}
				onPress={onResend}
				accessibilityLabel={`Resend the invite to ${invite.email}`}
			/>
			<TextAction
				label="Revoke"
				tone="danger"
				disabled={revoking}
				onPress={onRevoke}
				accessibilityLabel={`Revoke the invite to ${invite.email}`}
			/>
		</View>
	);
}

function InviteRow({ invite }: { invite: TeamInvite }) {
	const { colors, spacing } = useTheme();
	const { link, onResend, onRevoke, resending, revoking } =
		useInviteActions(invite);

	return (
		<Surface>
			<View style={{ gap: spacing[3] }}>
				<View
					style={{
						flexDirection: "row",
						gap: spacing[3],
						alignItems: "center",
					}}
				>
					<UserPlus size={22} color={colors.text.tertiary as string} />
					<View style={{ flex: 1, minWidth: 0 }}>
						<Body weight="bold" numberOfLines={1}>
							{invite.email}
						</Body>
						<Caption color="tertiary" numberOfLines={1}>
							{TEAM_ROLE_LABELS[invite.role]} · expires{" "}
							{formatDate(invite.expiresAt)}
						</Caption>
						{(invite.resentCount ?? 0) > 0 ? (
							<Caption color="tertiary" numberOfLines={1}>
								Resent {invite.resentCount}{" "}
								{invite.resentCount === 1 ? "time" : "times"}
								{invite.lastSentAt
									? ` · last sent ${formatDate(invite.lastSentAt)}`
									: ""}
							</Caption>
						) : null}
					</View>
					<StatusPill label="Pending" tone="warning" />
				</View>
				{!link ? (
					<Caption color="tertiary">Link appears after resend.</Caption>
				) : null}
				<View
					style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}
				>
					<Button
						size="sm"
						variant="outline"
						disabled={!link}
						accessibilityLabel={
							link
								? `Copy invite link for ${invite.email}`
								: `Invite link for ${invite.email} not available yet`
						}
						onPress={() => copyLink(link, "Link appears after resend.")}
					>
						Copy link
					</Button>
					<Button
						size="sm"
						variant="outline"
						loading={resending}
						onPress={onResend}
					>
						Resend
					</Button>
					<Button
						size="sm"
						variant="ghost"
						loading={revoking}
						onPress={onRevoke}
					>
						Revoke
					</Button>
				</View>
			</View>
		</Surface>
	);
}

function MemberSheet({
	member,
	onClose,
}: {
	member: OrgTeamMember | null;
	onClose: () => void;
}) {
	if (!member) {
		return (
			<Sheet visible={false} onClose={onClose} title="Team member">
				<View />
			</Sheet>
		);
	}
	return <MemberSheetInner key={member.id} member={member} onClose={onClose} />;
}

function MemberSheetInner({
	member,
	onClose,
}: {
	member: OrgTeamMember;
	onClose: () => void;
}) {
	const { spacing } = useTheme();
	const inputStyle = useFieldInputStyle();
	const access = useOrgAccess();
	const memberRole = member.role ?? (member.isOwner ? "OWNER" : "ADMIN");
	const isOwner = member.isOwner || memberRole === "OWNER";
	const canManageAdminRole = access.role === "OWNER";
	const isAdminMember = memberRole === "ADMIN";
	const canRemoveMember = canManageAdminRole || !isAdminMember;
	const status = member.status ?? "ACTIVE";
	const suspended = status === "SUSPENDED";
	const left = status === "LEFT" || status === "REMOVED";
	const initialRole = memberRole !== "OWNER" ? memberRole : "ADMIN";
	const [designation, setDesignation] = useState(member.designation ?? "");
	const [role, setRole] = useState<(typeof ROLES)[number]>(
		initialRole as (typeof ROLES)[number],
	);
	const [isPublic, setPublic] = useState(!!member.isPublic);
	const [error, setError] = useState<string | null>(null);
	const update = useUpdateAdmin();
	const remove = useRemoveAdmin();

	const save = () => {
		setError(null);
		update.mutate(
			{
				id: member.id,
				// Owner rows reject role/status changes server-side, so only
				// designation and visibility are sent for them.
				input: isOwner
					? { designation: designation.trim(), isPublic }
					: { designation: designation.trim(), role, isPublic },
			},
			{
				onSuccess: () => {
					toast.success("Team member updated.");
					onClose();
				},
				onError: (e) => setError(apiErrorMessage(e)),
			},
		);
	};

	const toggleSuspend = async () => {
		const name = member.user.fullName ?? member.user.email;
		const ok = await confirm({
			title: suspended ? "Reactivate teammate?" : "Suspend teammate?",
			message: suspended
				? `${name} will regain access immediately.`
				: `${name} will lose access until reactivated.`,
			confirmLabel: suspended ? "Reactivate" : "Suspend",
			destructive: !suspended,
		});
		if (!ok) return;
		update.mutate(
			{ id: member.id, input: { status: suspended ? "ACTIVE" : "SUSPENDED" } },
			{
				onSuccess: () => {
					toast.success(
						suspended ? `${name} reactivated.` : `${name} suspended.`,
					);
					onClose();
				},
				onError: (e) => setError(apiErrorMessage(e)),
			},
		);
	};

	const confirmRemove = async () => {
		const name = member.user.fullName ?? member.user.email;
		const ok = await confirm({
			title: "Remove from team?",
			message: `${name} will lose access immediately.`,
			confirmLabel: "Remove",
		});
		if (!ok) return;
		remove.mutate(member.id, {
			onSuccess: () => {
				toast.success(`${name} removed.`);
				onClose();
			},
			onError: (e) => setError(apiErrorMessage(e)),
		});
	};

	const busy = update.isPending || remove.isPending;

	return (
		<Sheet
			visible
			onClose={onClose}
			title={member.user.fullName ?? member.user.email}
			subtitle={member.user.email}
			footer={
				<View style={{ gap: spacing[2] }}>
					<FieldError message={error} />
					<Button
						onPress={save}
						loading={update.isPending}
						disabled={busy || left}
					>
						Save changes
					</Button>
					{!isOwner && !left ? (
						<Button
							variant="outline"
							onPress={toggleSuspend}
							loading={update.isPending}
							disabled={busy}
						>
							{suspended ? "Reactivate teammate" : "Suspend teammate"}
						</Button>
					) : null}
					{!isOwner && !left && canRemoveMember ? (
						<Button
							variant="destructive"
							onPress={confirmRemove}
							loading={remove.isPending}
							disabled={busy}
						>
							Remove from team
						</Button>
					) : null}
				</View>
			}
		>
			<View style={{ paddingTop: spacing[2], gap: spacing[4] }}>
				{isOwner ? (
					<Caption color="tertiary">
						Owners keep their role and status. To hand over ownership, use
						Transfer ownership below.
					</Caption>
				) : null}
				{left ? (
					<Caption color="tertiary">
						This person has left the team, so their access can't be changed.
					</Caption>
				) : null}
				<Field label="Access role">
					<RolePicker
						value={role}
						onChange={setRole}
						disabled={isOwner || (isAdminMember && !canManageAdminRole)}
						allowAdmin={canManageAdminRole}
					/>
				</Field>
				<Field label="Designation" optional>
					<Input
						placeholder="Field lead, Accountant, Trustee"
						value={designation}
						onChangeText={setDesignation}
						style={inputStyle}
					/>
				</Field>
				<SwitchRow
					icon={Eye}
					title="Show on your public profile"
					hint="With their designation, in the team section volunteers see."
					value={isPublic}
					onChange={setPublic}
				/>
			</View>
		</Sheet>
	);
}

function InviteSheet({
	visible,
	onClose,
}: {
	visible: boolean;
	onClose: () => void;
}) {
	const { spacing } = useTheme();
	const inputStyle = useFieldInputStyle();
	const access = useOrgAccess();
	const canInviteAdmin = access.role === "OWNER";
	const [email, setEmail] = useState("");
	const [designation, setDesignation] = useState("");
	const [role, setRole] = useState<(typeof ROLES)[number]>("MANAGER");
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [created, setCreated] = useState<TeamInvite | null>(null);
	const invite = useCreateTeamInvite();

	const close = () => {
		setEmail("");
		setDesignation("");
		setRole("MANAGER");
		setErrors({});
		setCreated(null);
		onClose();
	};

	const submit = () => {
		const parsed = inviteTeamMemberSchema.safeParse({
			email: email.trim(),
			role,
			designation,
		});
		if (!parsed.success) {
			const next: Record<string, string> = {};
			for (const issue of parsed.error.issues)
				next[String(issue.path[0] ?? "form")] = issue.message;
			setErrors(next);
			return;
		}
		setErrors({});
		// Send the input, not the parse: `optionalText` turns an empty
		// designation into `null`, which the server's copy of the same schema
		// (string | undefined on the way in) refuses - every invite without a
		// designation failed with "Validation failed".
		const trimmed = designation.trim();
		const input = {
			email: parsed.data.email,
			role: parsed.data.role,
			...(trimmed ? { designation: trimmed } : {}),
		};
		invite.mutate(input, {
			onSuccess: (createdInvite) => {
				setCreated(createdInvite);
				toast.success(`Invite created for ${createdInvite.email}.`);
			},
			onError: (e) => setErrors({ form: apiErrorMessage(e) }),
		});
	};

	const link = created?.inviteUrl ?? created?.token;

	return (
		<Sheet
			visible={visible}
			onClose={close}
			title="Invite teammate"
			subtitle={
				created
					? "Share this link with them to join."
					: "Works even if they have not signed up yet."
			}
			footer={
				created ? (
					<View style={{ gap: spacing[2] }}>
						<Button
							disabled={!link}
							accessibilityLabel={
								link
									? `Copy invite link for ${created.email}`
									: `Invite link for ${created.email} not available`
							}
							onPress={() => copyLink(link, "No link on this invite.")}
						>
							Copy invite link
						</Button>
						<Button variant="outline" onPress={close}>
							Done
						</Button>
					</View>
				) : (
					<View style={{ gap: spacing[2] }}>
						<FieldError message={errors.form} />
						<Button onPress={submit} loading={invite.isPending}>
							Create invite
						</Button>
					</View>
				)
			}
		>
			{created ? (
				<View style={{ paddingTop: spacing[2], gap: spacing[3] }}>
					<View style={{ gap: spacing[1] }}>
						<Body weight="bold" numberOfLines={1}>
							{created.email}
						</Body>
						<Caption color="tertiary">
							{TEAM_ROLE_LABELS[created.role]} · expires{" "}
							{formatDate(created.expiresAt)}
						</Caption>
					</View>
					{link ? (
						<Caption color="secondary" selectable>
							{link}
						</Caption>
					) : (
						<Caption color="tertiary">
							No link on this invite - resend it from Pending invites to get
							one.
						</Caption>
					)}
				</View>
			) : (
				<View style={{ paddingTop: spacing[2], gap: spacing[4] }}>
					<Field label="Email" error={errors.email}>
						<Input
							placeholder="priya@ngo.org"
							value={email}
							onChangeText={setEmail}
							keyboardType="email-address"
							autoCapitalize="none"
							autoCorrect={false}
							style={inputStyle}
						/>
					</Field>
					<Field label="Access role" error={errors.role}>
						<RolePicker
							value={role}
							onChange={setRole}
							allowAdmin={canInviteAdmin}
						/>
					</Field>
					<Field label="Designation" optional error={errors.designation}>
						<Input
							placeholder="Field Lead – Pune"
							value={designation}
							onChangeText={setDesignation}
							style={inputStyle}
						/>
					</Field>
				</View>
			)}
		</Sheet>
	);
}

function RolePicker({
	value,
	onChange,
	disabled = false,
	allowAdmin = true,
}: {
	value: (typeof ROLES)[number];
	onChange: (role: (typeof ROLES)[number]) => void;
	disabled?: boolean;
	allowAdmin?: boolean;
}) {
	const { spacing } = useTheme();
	const availableRoles = ROLES.filter(
		(role) => role !== "ADMIN" || allowAdmin || role === value,
	);
	return (
		<View style={{ gap: spacing[2] }}>
			<View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
				{availableRoles.map((role) => (
					<Button
						key={role}
						size="sm"
						variant={value === role ? "default" : "outline"}
						disabled={disabled || (role === "ADMIN" && !allowAdmin)}
						accessibilityRole="radio"
						accessibilityState={{ selected: value === role }}
						accessibilityLabel={`${TEAM_ROLE_LABELS[role]}. ${TEAM_ROLE_COPY[role]}`}
						onPress={() => onChange(role)}
					>
						{TEAM_ROLE_LABELS[role]}
					</Button>
				))}
			</View>
			<Caption color="tertiary">{TEAM_ROLE_COPY[value]}</Caption>
		</View>
	);
}

/**
 * Two acts that belong to different people: the owner hands over, everyone
 * else can leave. Both used to be shown to every role - a viewer was offered
 * "Transfer ownership", and an owner "Leave team", which the server refuses
 * until ownership has moved.
 */
function OwnershipSection({
	isOwner,
	onTransfer,
}: {
	isOwner: boolean;
	onTransfer: () => void;
}) {
	const { colors, spacing } = useTheme();
	const leave = useLeaveTeam();

	const onLeave = async () => {
		const ok = await confirm({
			title: "Leave the team?",
			message:
				"You'll lose access immediately. Owners must transfer ownership first.",
			confirmLabel: "Leave",
		});
		if (!ok) return;
		leave.mutate(undefined, {
			onSuccess: () => toast.success("You left the team."),
			onError: (e) => toast.error(apiErrorMessage(e)),
		});
	};

	return (
		<Surface>
			<View style={{ gap: spacing[3] }}>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[2],
					}}
				>
					<KeyRound size={18} color={colors.text.secondary as string} />
					<H3>Ownership & leaving</H3>
				</View>
				<Caption color="tertiary">
					{isOwner
						? "Only an active admin can receive ownership, and they must confirm before anything changes. To leave, hand ownership over first."
						: "Leaving removes your own access immediately. An owner or admin can invite you back."}
				</Caption>
				<View
					style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}
				>
					{isOwner ? (
						<Button variant="outline" onPress={onTransfer}>
							Transfer ownership
						</Button>
					) : (
						<Button
							variant="ghost"
							loading={leave.isPending}
							accessibilityLabel="Leave the team"
							onPress={onLeave}
						>
							Leave team
						</Button>
					)}
				</View>
			</View>
		</Surface>
	);
}

function TransferSheet({
	visible,
	onClose,
}: {
	visible: boolean;
	onClose: () => void;
}) {
	const { spacing } = useTheme();
	const request = useRequestOwnershipTransfer();
	// The transfer target must be an active admin, independent of the
	// members filter on the screen behind this sheet.
	const teamQuery = useOrgTeam();
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [created, setCreated] = useState<{
		name: string;
		token: string;
	} | null>(null);
	const [error, setError] = useState<string | null>(null);
	const admins = (teamQuery.data ?? []).filter(
		(member) =>
			!member.isOwner &&
			(member.role ?? "ADMIN") === "ADMIN" &&
			(member.status ?? "ACTIVE") === "ACTIVE",
	);
	const selected = admins.find((member) => member.id === selectedId) ?? null;
	const selectedName = selected
		? (selected.user.fullName ?? selected.user.email)
		: null;

	const close = () => {
		setSelectedId(null);
		setCreated(null);
		setError(null);
		onClose();
	};

	// Picking a name only selects it. Each row used to be a card whose tap
	// fired the request outright, so a mis-tap while scrolling the list
	// started handing the organisation to the wrong person. The request now
	// waits for the footer button and a confirmation that names them.
	const send = async () => {
		if (!selected || !selectedName) return;
		const ok = await confirm({
			title: `Transfer ownership to ${selectedName}?`,
			message: `${selectedName} gets a token to accept. You stay the owner until they confirm it; after that, they are the owner and you are an admin.`,
			confirmLabel: "Send request",
		});
		if (!ok) return;
		setError(null);
		request.mutate(selected.id, {
			onSuccess: (data) => {
				setCreated({ name: selectedName, token: data.token });
				toast.success(`Transfer request created for ${selectedName}.`);
			},
			onError: (e) => setError(apiErrorMessage(e)),
		});
	};

	return (
		<Sheet
			visible={visible}
			onClose={close}
			title="Transfer ownership"
			subtitle={
				created
					? "Share this token with them to finish the handover."
					: "Pick an active admin. They must confirm before ownership changes."
			}
			footer={
				created ? (
					<View style={{ gap: spacing[2] }}>
						<Button
							onPress={() =>
								copyLink(
									created.token,
									"No token on this transfer - start it again.",
								)
							}
						>
							Copy transfer token
						</Button>
						<Button variant="outline" onPress={close}>
							Done
						</Button>
					</View>
				) : admins.length > 0 ? (
					<View style={{ gap: spacing[2] }}>
						<FieldError message={error} />
						<Button
							disabled={!selected}
							loading={request.isPending}
							onPress={send}
						>
							{selectedName
								? `Send transfer request to ${selectedName}`
								: "Pick an admin"}
						</Button>
					</View>
				) : undefined
			}
		>
			<View style={{ paddingTop: spacing[2], gap: spacing[1] }}>
				{created ? (
					<View style={{ gap: spacing[2] }}>
						<Body weight="bold" numberOfLines={1}>
							{created.name}
						</Body>
						<Caption color="secondary" selectable>
							{created.token}
						</Caption>
						<Caption color="tertiary">
							Share this with {created.name}; they confirm from Team → Received
							an ownership transfer token.
						</Caption>
					</View>
				) : teamQuery.isLoading ? (
					<LoadingState label="Loading admins" />
				) : teamQuery.isError ? (
					<ErrorState
						message={apiErrorMessage(teamQuery.error)}
						onRetry={() => void teamQuery.refetch()}
					/>
				) : admins.length === 0 ? (
					<Caption color="tertiary">
						Invite or promote an admin before transferring ownership.
					</Caption>
				) : (
					admins.map((member) => (
						<SheetOption
							key={member.id}
							label={member.user.fullName ?? member.user.email}
							hint={member.designation ?? "Admin"}
							selected={member.id === selectedId}
							onPress={() => {
								setError(null);
								setSelectedId(member.id);
							}}
						/>
					))
				)}
			</View>
		</Sheet>
	);
}

function ConfirmTransferCard({ onCancel }: { onCancel: () => void }) {
	const { spacing } = useTheme();
	const inputStyle = useFieldInputStyle();
	const [token, setToken] = useState("");
	const [error, setError] = useState<string | null>(null);
	const confirmTransfer = useConfirmOwnershipTransfer();

	const submit = () => {
		if (!token.trim()) {
			setError("Paste the transfer token you were given.");
			return;
		}
		setError(null);
		confirmTransfer.mutate(token.trim(), {
			onSuccess: () => {
				toast.success("Ownership transferred.");
				setToken("");
			},
			onError: (e) => setError(apiErrorMessage(e)),
		});
	};

	return (
		<Surface>
			<View style={{ gap: spacing[3] }}>
				<H3>Confirm transfer</H3>
				<Caption color="tertiary">
					Received an ownership transfer? Paste the token here to accept it.
				</Caption>
				<Field label="Transfer token" error={error ?? undefined}>
					<Input
						placeholder="Paste the token"
						value={token}
						onChangeText={setToken}
						autoCapitalize="none"
						autoCorrect={false}
						style={inputStyle}
					/>
				</Field>
				<View
					style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}
				>
					<Button loading={confirmTransfer.isPending} onPress={submit}>
						Confirm transfer
					</Button>
					<Button variant="ghost" onPress={onCancel}>
						Cancel
					</Button>
				</View>
			</View>
		</Surface>
	);
}
