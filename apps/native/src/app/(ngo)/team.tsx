import { inviteOrgAdminSchema } from "@nabhya/shared";
import { Users } from "lucide-react-native";
import { useEffect, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
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
import { Sheet } from "@/components/ui/sheet";
import { Body, Caption } from "@/components/ui/typography";
import {
	useInviteAdmin,
	useOrgTeam,
	useRemoveAdmin,
	useUpdateAdmin,
} from "@/hooks/use-directory";
import { useTheme } from "@/hooks/use-theme";
import { Alert } from "@/lib/alert";
import { apiErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { OrgTeamMember } from "@/lib/types";

/**
 * Who can act for the organisation. Tapping a member opens their sheet, where
 * the role is edited and — for anyone but the owner — access is removed. The
 * endpoint returns the whole team, so there is no paging here.
 */
export default function OrgTeam() {
	const { colors, spacing } = useTheme();
	const [inviting, setInviting] = useState(false);
	const [managing, setManaging] = useState<OrgTeamMember | null>(null);

	const query = useOrgTeam();
	const items = query.data ?? [];
	const openInvite = () => setInviting(true);

	return (
		<Screen>
			<ScreenHeader
				back
				title="Team"
				subtitle={
					items.length > 0
						? `${items.length} ${items.length === 1 ? "person" : "people"} can manage this organisation`
						: undefined
				}
				action={
					<Button size="sm" onPress={openInvite}>
						Add person
					</Button>
				}
			/>

			{query.isLoading ? (
				<LoadingState />
			) : query.isError ? (
				<ErrorState
					message={apiErrorMessage(query.error)}
					onRetry={() => query.refetch()}
				/>
			) : (
				<FlatList
					data={items}
					keyExtractor={(item) => item.id}
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{ paddingBottom: spacing[10] }}
					ItemSeparatorComponent={() => <View style={{ height: spacing[3] }} />}
					refreshControl={
						<RefreshControl
							refreshing={query.isRefetching}
							onRefresh={() => query.refetch()}
							tintColor={colors.text.quaternary as string}
						/>
					}
					ListEmptyComponent={
						<EmptyState
							icon={Users}
							title="Just you so far"
							description="Add colleagues so they can post events and needs, review applicants and reply to reviews on the NGO's behalf."
							action={<Button onPress={openInvite}>Add a colleague</Button>}
						/>
					}
					renderItem={({ item }) => (
						<MemberRow member={item} onPress={() => setManaging(item)} />
					)}
				/>
			)}

			<InviteSheet visible={inviting} onClose={() => setInviting(false)} />
			<MemberSheet member={managing} onClose={() => setManaging(null)} />
		</Screen>
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
	const name = member.user.fullName ?? member.user.email;

	return (
		<Surface onPress={onPress}>
			<View
				style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}
			>
				<InitialAvatar name={member.user.fullName ?? member.user.email} />
				<View style={{ flex: 1, minWidth: 0 }}>
					<Body weight="bold" numberOfLines={1}>
						{name}
					</Body>
					<Caption color="tertiary" numberOfLines={1}>
						{member.designation ?? "Team member"} · since{" "}
						{formatDate(member.joinedAt)}
					</Caption>
				</View>
				{member.isOwner && <StatusPill label="Owner" tone="info" />}
			</View>
		</Surface>
	);
}

/**
 * One teammate's sheet: edit their role, or remove them.
 *
 * The edit is a real field rather than an Alert.prompt: that only exists on
 * iOS, so on Android tapping would silently do nothing.
 */
function MemberSheet({
	member,
	onClose,
}: {
	member: OrgTeamMember | null;
	onClose: () => void;
}) {
	const { spacing } = useTheme();
	const inputStyle = useFieldInputStyle();
	const [designation, setDesignation] = useState("");
	const [error, setError] = useState<string | null>(null);

	const update = useUpdateAdmin();
	const remove = useRemoveAdmin();

	useEffect(() => {
		setDesignation(member?.designation ?? "");
		setError(null);
	}, [member]);

	const save = () => {
		if (!member) return;
		setError(null);
		update.mutate(
			{ id: member.id, input: { designation: designation.trim() } },
			{ onSuccess: onClose, onError: (e) => setError(apiErrorMessage(e)) },
		);
	};

	const confirmRemove = () => {
		if (!member) return;
		const name = member.user.fullName ?? member.user.email;
		Alert.alert(
			"Remove from team",
			`${name} will lose access to this organisation. They keep their own account.`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Remove",
					style: "destructive",
					onPress: () =>
						remove.mutate(member.id, {
							onSuccess: onClose,
							onError: (e) => setError(apiErrorMessage(e)),
						}),
				},
			],
		);
	};

	const dirty = (member?.designation ?? "") !== designation.trim();
	const busy = update.isPending || remove.isPending;

	return (
		<Sheet
			visible={!!member}
			onClose={onClose}
			title={member?.user.fullName ?? member?.user.email ?? ""}
			subtitle={member?.user.email}
			footer={
				<View style={{ gap: spacing[2] }}>
					<FieldError message={error} />
					<Button
						onPress={save}
						loading={update.isPending}
						disabled={busy || !dirty}
					>
						Save role
					</Button>
					{/* The owner is deliberately not removable — losing them would
					    leave the organisation unmanageable. */}
					{member && !member.isOwner && (
						<Button
							variant="outline"
							onPress={confirmRemove}
							loading={remove.isPending}
							disabled={busy}
						>
							Remove from team
						</Button>
					)}
				</View>
			}
		>
			<View style={{ paddingTop: spacing[2] }}>
				<Field
					label="Role"
					optional
					hint="Shown beside their name to the rest of the team."
				>
					<Input
						placeholder="e.g. Programme Manager"
						value={designation}
						onChangeText={setDesignation}
						autoFocus
						style={inputStyle}
					/>
				</Field>
				{member?.isOwner && (
					<Caption color="quaternary">
						The owner set up this organisation and cannot be removed.
					</Caption>
				)}
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
	const [errors, setErrors] = useState<Record<string, string>>({});

	const invite = useInviteAdmin();

	const close = () => {
		setEmail("");
		setDesignation("");
		setErrors({});
		onClose();
	};

	const submit = () => {
		const parsed = inviteOrgAdminSchema.safeParse({
			email: email.trim(),
			designation,
		});
		if (!parsed.success) {
			const fieldErrors: Record<string, string> = {};
			for (const issue of parsed.error.issues) {
				const key = String(issue.path[0] ?? "form");
				if (!fieldErrors[key]) fieldErrors[key] = issue.message;
			}
			setErrors(fieldErrors);
			return;
		}
		setErrors({});
		invite.mutate(parsed.data, {
			onSuccess: close,
			onError: (e) => setErrors({ form: apiErrorMessage(e) }),
		});
	};

	return (
		<Sheet
			visible={visible}
			onClose={close}
			title="Add to team"
			subtitle="They need a Nabhya account already."
			footer={
				<View style={{ gap: spacing[2] }}>
					<FieldError message={errors.form} />
					<Button onPress={submit} loading={invite.isPending}>
						Add to team
					</Button>
				</View>
			}
		>
			<View style={{ paddingTop: spacing[2] }}>
				<Field
					label="Email"
					error={errors.email}
					hint="The address they signed up with. We won't create an account for them."
				>
					<Input
						placeholder="colleague@example.org"
						value={email}
						onChangeText={setEmail}
						keyboardType="email-address"
						autoCapitalize="none"
						autoCorrect={false}
						style={inputStyle}
					/>
				</Field>

				<Field label="Role" optional error={errors.designation}>
					<Input
						placeholder="e.g. Programme Manager"
						value={designation}
						onChangeText={setDesignation}
						style={inputStyle}
					/>
				</Field>
			</View>
		</Sheet>
	);
}
