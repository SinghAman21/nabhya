import { inviteTeamMemberSchema } from "@nabhya/shared";
import { KeyRound, MailPlus, UserPlus, Users } from "lucide-react-native";
import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { Field, FieldError, useFieldInputStyle } from "@/components/form-field";
import { InitialAvatar } from "@/components/initial-avatar";
import {
	EmptyState,
	ErrorState,
	FilterChips,
	LoadingState,
	Screen,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import { type PillTone, StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirm, toast } from "@/components/ui/overlay";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Body, Caption, H3, Label } from "@/components/ui/typography";
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

import { apiErrorMessage } from "@/lib/api";
import { copyText } from "@/lib/clipboard";
import { formatDate } from "@/lib/format";
import { verticalScrollbar } from "@/lib/scroll";
import { TEAM_ROLE_COPY, TEAM_ROLE_LABELS } from "@/lib/team-roles";
import type { OrgTeamMember, TeamInvite, TeamStatusFilter } from "@/lib/types";

const ROLES = ["ADMIN", "MANAGER", "MEMBER", "VIEWER"] as const;

const STATUS_OPTIONS: Array<{ value: TeamStatusFilter; label: string }> = [
	{ value: "ACTIVE", label: "Active" },
	{ value: "SUSPENDED", label: "Suspended" },
];

/**
 * Organisation team management: members, pending invites, and ownership.
 * The team endpoint returns the whole team (no paging), so a ScrollView is
 * enough here - see the paged-list note in apps/native/AGENTS.md.
 */
export default function OrgTeam() {
	const { colors, spacing } = useTheme();
	const [status, setStatus] = useState<TeamStatusFilter>("ACTIVE");
	const [includeLeft, setIncludeLeft] = useState(false);
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

	const teamQuery = useOrgTeam({ status, includeLeft });
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
			? `${items.length} active ${items.length === 1 ? "member" : "members"}`
			: `${items.length} suspended`;

	return (
		<Screen>
			<ScreenHeader
				back
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
					<SectionHeading title="Members" />
					{!canInvite && !access.isLoading ? (
						<Caption color="tertiary">
							Only owners and admins can invite. Ask an owner or admin.
						</Caption>
					) : null}
					{/* Filters only once there is something to filter. */}
					{items.length > 0 || status !== "ACTIVE" || includeLeft ? (
						<>
							<FilterChips
								inline
								options={STATUS_OPTIONS}
								value={status}
								onChange={setStatus}
							/>
							<SwitchRow
								label="Include people who left"
								checked={includeLeft}
								onChange={setIncludeLeft}
							/>
						</>
					) : null}
					{items.length === 0 ? (
						<EmptyState
							icon={Users}
							title={
								status === "SUSPENDED"
									? "No suspended teammates"
									: "Just you so far"
							}
							description={
								status === "SUSPENDED"
									? "Suspended teammates will appear here until they are reactivated."
									: "Invite colleagues, coordinators or accountants with the minimum access they need."
							}
							action={
								status === "ACTIVE" && canInvite ? (
									<Button onPress={() => setInviting(true)}>
										Invite someone
									</Button>
								) : undefined
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
					{canInvite ? <SectionHeading title="Pending invites" /> : null}
					{!canInvite ? null : invitesQuery.isError ? (
						<ErrorState
							message={apiErrorMessage(invitesQuery.error)}
							onRetry={() => void invitesQuery.refetch()}
						/>
					) : invites.length === 0 ? (
						<Surface>
							<View style={{ gap: spacing[2] }}>
								<MailPlus size={22} color={colors.text.tertiary as string} />
								<Body weight="bold">No pending invites</Body>
								<Caption color="tertiary">
									Invites for new or existing users will appear here with a link
									to copy, resend or revoke.
								</Caption>
							</View>
						</Surface>
					) : (
						<View style={{ gap: spacing[3] }}>
							{invites.map((invite) => (
								<InviteRow key={invite.id} invite={invite} />
							))}
						</View>
					)}

					{/* Reference, not the first thing on the page: it used to open
					    the screen and push the members below the fold on a phone. */}
					<SectionHeading title="What each role can do" />
					<Surface>
						<View style={{ gap: spacing[3] }}>
							{(["OWNER", ...ROLES] as const).map((role) => (
								<View
									key={role}
									style={{
										flexDirection: "row",
										alignItems: "flex-start",
										gap: spacing[3],
									}}
								>
									<View style={{ width: 84 }}>
										<StatusPill
											label={TEAM_ROLE_LABELS[role]}
											tone={role === "OWNER" ? "info" : "neutral"}
										/>
									</View>
									<Caption color="tertiary" style={{ flex: 1 }}>
										{TEAM_ROLE_COPY[role]}
									</Caption>
								</View>
							))}
							<Caption color="quaternary">
								A designation ("Field lead - Pune") is only the label shown
								beside a name; the role is what grants access.
							</Caption>
						</View>
					</Surface>

					<OwnershipSection
						isOwner={isOwner}
						onTransfer={() => setTransferring(true)}
					/>
					{canReceiveOwnership ? <ConfirmTransferCard /> : null}
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

/** Screen-local: an H3 with an optional action, unlike screen-shell's caption. */
function SectionHeading({
	title,
	actionLabel,
	onAction,
}: {
	title: string;
	actionLabel?: string;
	onAction?: () => void;
}) {
	const { spacing } = useTheme();
	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				justifyContent: "space-between",
				gap: spacing[3],
			}}
		>
			<H3>{title}</H3>
			{actionLabel && onAction ? (
				<Button size="sm" variant="outline" onPress={onAction}>
					{actionLabel}
				</Button>
			) : null}
		</View>
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
	const update = useUpdateAdmin();
	const pill = memberPill(member);
	const name = member.user.fullName ?? member.user.email;
	const suspended = (member.status ?? "ACTIVE") === "SUSPENDED";
	const left = member.status === "LEFT" || member.status === "REMOVED";

	const reactivate = () => {
		update.mutate(
			{ id: member.id, input: { status: "ACTIVE" } },
			{
				onSuccess: () => toast.success(`${name} reactivated.`),
				onError: (e) => toast.error(apiErrorMessage(e)),
			},
		);
	};

	return (
		<Surface
			onPress={onPress}
			footer={
				suspended && canManage ? (
					<View style={{ alignItems: "flex-start", marginTop: spacing[3] }}>
						<Button
							size="sm"
							variant="outline"
							loading={update.isPending}
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

function InviteRow({ invite }: { invite: TeamInvite }) {
	const { colors, spacing } = useTheme();
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
						loading={resend.isPending}
						onPress={onResend}
					>
						Resend
					</Button>
					<Button
						size="sm"
						variant="ghost"
						loading={revoke.isPending}
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
	const isOwner = member.isOwner || member.role === "OWNER";
	const status = member.status ?? "ACTIVE";
	const suspended = status === "SUSPENDED";
	const left = status === "LEFT" || status === "REMOVED";
	const initialRole =
		member.role && member.role !== "OWNER" ? member.role : "ADMIN";
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
					{!isOwner && !left ? (
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
					<RolePicker value={role} onChange={setRole} disabled={isOwner} />
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
					label="Show on your public profile"
					hint="With their designation, in the team section volunteers see."
					checked={isPublic}
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
		invite.mutate(parsed.data, {
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
						<RolePicker value={role} onChange={setRole} />
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
}: {
	value: (typeof ROLES)[number];
	onChange: (role: (typeof ROLES)[number]) => void;
	disabled?: boolean;
}) {
	const { spacing } = useTheme();
	return (
		<View style={{ gap: spacing[2] }}>
			<View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
				{ROLES.map((role) => (
					<Button
						key={role}
						size="sm"
						variant={value === role ? "default" : "outline"}
						disabled={disabled}
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

	const close = () => {
		setCreated(null);
		setError(null);
		onClose();
	};

	const select = (member: OrgTeamMember) => {
		setError(null);
		const name = member.user.fullName ?? member.user.email;
		request.mutate(member.id, {
			onSuccess: (data) => {
				setCreated({ name, token: data.token });
				toast.success(`Transfer request created for ${name}.`);
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
				) : undefined
			}
		>
			<View style={{ paddingTop: spacing[2], gap: spacing[3] }}>
				<FieldError message={error} />
				{created ? (
					<View style={{ gap: spacing[2] }}>
						<Body weight="bold" numberOfLines={1}>
							{created.name}
						</Body>
						<Caption color="secondary" selectable>
							{created.token}
						</Caption>
						<Caption color="tertiary">
							Share this with {created.name}; they confirm from Team → Confirm
							transfer.
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
						<Surface key={member.id} onPress={() => select(member)}>
							<Body weight="bold">
								{member.user.fullName ?? member.user.email}
							</Body>
							<Caption color="tertiary">
								{member.designation ?? "Admin"}
							</Caption>
						</Surface>
					))
				)}
				{!created && request.isPending ? (
					<Caption color="tertiary">Creating transfer request…</Caption>
				) : null}
			</View>
		</Sheet>
	);
}

function ConfirmTransferCard() {
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
				<View style={{ alignItems: "flex-start" }}>
					<Button loading={confirmTransfer.isPending} onPress={submit}>
						Confirm transfer
					</Button>
				</View>
			</View>
		</Surface>
	);
}

/** A labelled switch - a setting, not a button that changes its own label. */
function SwitchRow({
	label,
	hint,
	checked,
	onChange,
}: {
	label: string;
	hint?: string;
	checked: boolean;
	onChange: (next: boolean) => void;
}) {
	const { spacing } = useTheme();
	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				justifyContent: "space-between",
				gap: spacing[3],
				minHeight: 44,
			}}
		>
			<View style={{ flex: 1, minWidth: 0 }}>
				<Label>{label}</Label>
				{hint ? <Caption color="tertiary">{hint}</Caption> : null}
			</View>
			<Switch
				checked={checked}
				onCheckedChange={onChange}
				accessibilityLabel={label}
			/>
		</View>
	);
}
