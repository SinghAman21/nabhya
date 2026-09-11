import { inviteTeamMemberSchema } from "@nabhya/shared";
import { MailPlus, ShieldCheck, UserPlus, Users } from "lucide-react-native";
import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { Field, FieldError, useFieldInputStyle } from "@/components/form-field";
import { InitialAvatar } from "@/components/initial-avatar";
import {
	EmptyState,
	ErrorState,
	LoadingState,
	Screen,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirm, toast } from "@/components/ui/overlay";
import { Sheet } from "@/components/ui/sheet";
import { Body, Caption, H3, Label } from "@/components/ui/typography";
import {
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
import { useTheme } from "@/hooks/use-theme";

import { apiErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { verticalScrollbar } from "@/lib/scroll";
import type { OrgTeamMember, TeamInvite } from "@/lib/types";

const ROLES = ["ADMIN", "MANAGER", "MEMBER", "VIEWER"] as const;
const ROLE_COPY: Record<(typeof ROLES)[number], string> = {
	ADMIN: "Full operations access, except ownership transfer.",
	MANAGER: "Events, needs, applicants, attendance and certificates.",
	MEMBER: "Draft support and attendance marking.",
	VIEWER: "Read-only observer with money visibility.",
};

/**
 * Mock-level team UI for the new collaboration backend: visible sections and
 * basic controls first, polish later. Teams are small, so a ScrollView is enough.
 */
export default function OrgTeam() {
	const { colors, spacing } = useTheme();
	const [inviting, setInviting] = useState(false);
	const [managing, setManaging] = useState<OrgTeamMember | null>(null);
	const [transferring, setTransferring] = useState(false);

	const teamQuery = useOrgTeam();
	const invitesQuery = useTeamInvites();
	const items = teamQuery.data ?? [];
	const invites = invitesQuery.data ?? [];
	const loading = teamQuery.isLoading || invitesQuery.isLoading;
	const refreshing = teamQuery.isRefetching || invitesQuery.isRefetching;

	const refetch = () => {
		void teamQuery.refetch();
		void invitesQuery.refetch();
	};

	return (
		<Screen>
			<ScreenHeader
				back
				title="Team"
				subtitle={`${items.length} active ${items.length === 1 ? "member" : "members"} · ${invites.length} pending`}
				action={
					<Button size="sm" onPress={() => setInviting(true)}>
						Invite
					</Button>
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
					<Surface>
						<View style={{ gap: spacing[2] }}>
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									gap: spacing[2],
								}}
							>
								<ShieldCheck size={18} color={colors.primary.main as string} />
								<H3>Access roles</H3>
							</View>
							<Caption color="tertiary">
								Roles decide what teammates can do. Designation is just the
								public label shown beside their name.
							</Caption>
							<View
								style={{
									flexDirection: "row",
									flexWrap: "wrap",
									gap: spacing[2],
								}}
							>
								{["OWNER", ...ROLES].map((role) => (
									<StatusPill
										key={role}
										label={role}
										tone={role === "OWNER" ? "info" : "neutral"}
									/>
								))}
							</View>
						</View>
					</Surface>

					<SectionTitle
						title="Members"
						actionLabel="Invite member"
						onAction={() => setInviting(true)}
					/>
					{items.length === 0 ? (
						<EmptyState
							icon={Users}
							title="Just you so far"
							description="Invite colleagues, coordinators or accountants with the minimum access they need."
							action={
								<Button onPress={() => setInviting(true)}>
									Invite someone
								</Button>
							}
						/>
					) : (
						<View style={{ gap: spacing[3] }}>
							{items.map((item) => (
								<MemberRow
									key={item.id}
									member={item}
									onPress={() => setManaging(item)}
								/>
							))}
						</View>
					)}

					<SectionTitle title="Pending invites" />
					{invites.length === 0 ? (
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

					<DangerZone onTransfer={() => setTransferring(true)} />
				</ScrollView>
			)}

			<InviteSheet visible={inviting} onClose={() => setInviting(false)} />
			<MemberSheet member={managing} onClose={() => setManaging(null)} />
			<TransferSheet
				visible={transferring}
				onClose={() => setTransferring(false)}
				members={items}
			/>
		</Screen>
	);
}

function SectionTitle({
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

function MemberRow({
	member,
	onPress,
}: {
	member: OrgTeamMember;
	onPress: () => void;
}) {
	const { spacing } = useTheme();
	const role = member.role ?? (member.isOwner ? "OWNER" : "ADMIN");
	const name = member.user.fullName ?? member.user.email;

	return (
		<Surface onPress={onPress}>
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
					<StatusPill
						label={role}
						tone={role === "OWNER" ? "info" : "neutral"}
					/>
				</View>
				<Caption color="tertiary" numberOfLines={2}>
					{member.designation ?? "No designation"} · Joined{" "}
					{formatDate(member.joinedAt)}
					{member.isPublic ? " · Public" : ""}
				</Caption>
			</View>
		</Surface>
	);
}

function InviteRow({ invite }: { invite: TeamInvite }) {
	const { spacing } = useTheme();
	const resend = useResendTeamInvite();
	const revoke = useRevokeTeamInvite();

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
					<UserPlus size={22} />
					<View style={{ flex: 1, minWidth: 0 }}>
						<Body weight="bold" numberOfLines={1}>
							{invite.email}
						</Body>
						<Caption color="tertiary" numberOfLines={1}>
							{invite.role} · expires {formatDate(invite.expiresAt)}
						</Caption>
					</View>
					<StatusPill label="Pending" tone="warning" />
				</View>
				<View
					style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}
				>
					<Button
						size="sm"
						variant="outline"
						onPress={() =>
							toast.success(
								invite.token
									? "Invite link copied."
									: "Invite link will appear after resend.",
							)
						}
					>
						Copy link
					</Button>
					<Button
						size="sm"
						variant="outline"
						loading={resend.isPending}
						onPress={() =>
							resend.mutate(invite.id, {
								onSuccess: () => toast.success("Invite link refreshed."),
							})
						}
					>
						Resend
					</Button>
					<Button
						size="sm"
						variant="ghost"
						loading={revoke.isPending}
						onPress={() =>
							revoke.mutate(invite.id, {
								onSuccess: () => toast.success("Invite revoked."),
							})
						}
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
				input: { designation: designation.trim(), role, isPublic },
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

	const isOwner = member.role === "OWNER" || member.isOwner;
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
						disabled={busy || isOwner}
					>
						Save changes
					</Button>
					{!isOwner ? (
						<Button
							variant="outline"
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
						Owners can only be changed from the transfer flow.
					</Caption>
				) : null}
				<Field
					label="Access role"
					hint="Mock role picker; server still enforces the rules."
				>
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
				<View style={{ gap: spacing[2] }}>
					<Label>Public profile</Label>
					<Button
						variant={isPublic ? "default" : "outline"}
						onPress={() => setPublic((v) => !v)}
					>
						{isPublic ? "Shown on NGO profile" : "Hidden from public profile"}
					</Button>
				</View>
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
	const invite = useCreateTeamInvite();

	const close = () => {
		setEmail("");
		setDesignation("");
		setRole("MANAGER");
		setErrors({});
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
			onSuccess: (created) => {
				toast.success(
					created.token
						? "Invite created. Copy link from Pending invites."
						: "Invite created.",
				);
				close();
			},
			onError: (e) => setErrors({ form: apiErrorMessage(e) }),
		});
	};

	return (
		<Sheet
			visible={visible}
			onClose={close}
			title="Invite teammate"
			subtitle="Works even if they have not signed up yet."
			footer={
				<View style={{ gap: spacing[2] }}>
					<FieldError message={errors.form} />
					<Button onPress={submit} loading={invite.isPending}>
						Create invite
					</Button>
				</View>
			}
		>
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
						onPress={() => onChange(role)}
					>
						{role}
					</Button>
				))}
			</View>
			<Caption color="tertiary">{ROLE_COPY[value]}</Caption>
		</View>
	);
}

function DangerZone({ onTransfer }: { onTransfer: () => void }) {
	const { spacing } = useTheme();
	const leave = useLeaveTeam();
	return (
		<Surface>
			<View style={{ gap: spacing[3] }}>
				<H3>Danger zone</H3>
				<Caption color="tertiary">
					Mock controls for ownership transfer and leaving the team.
				</Caption>
				<View
					style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}
				>
					<Button variant="outline" onPress={onTransfer}>
						Transfer ownership
					</Button>
					<Button
						variant="ghost"
						loading={leave.isPending}
						onPress={() =>
							leave.mutate(undefined, {
								onSuccess: () => toast.success("You left the team."),
							})
						}
					>
						Leave team
					</Button>
				</View>
			</View>
		</Surface>
	);
}

function TransferSheet({
	visible,
	onClose,
	members,
}: {
	visible: boolean;
	onClose: () => void;
	members: OrgTeamMember[];
}) {
	const { spacing } = useTheme();
	const request = useRequestOwnershipTransfer();
	const admins = members.filter(
		(member) => (member.role ?? "ADMIN") === "ADMIN",
	);
	return (
		<Sheet
			visible={visible}
			onClose={onClose}
			title="Transfer ownership"
			subtitle="Pick an active admin. They must confirm before ownership changes."
		>
			<View style={{ paddingTop: spacing[2], gap: spacing[3] }}>
				{admins.length === 0 ? (
					<Caption color="tertiary">
						Invite or promote an admin before transferring ownership.
					</Caption>
				) : null}
				{admins.map((member) => (
					<Surface
						key={member.id}
						onPress={() =>
							request.mutate(member.id, {
								onSuccess: () => {
									toast.success("Transfer request created.");
									onClose();
								},
							})
						}
					>
						<Body weight="bold">
							{member.user.fullName ?? member.user.email}
						</Body>
						<Caption color="tertiary">{member.designation ?? "Admin"}</Caption>
					</Surface>
				))}
			</View>
		</Sheet>
	);
}
