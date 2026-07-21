import { useRouter } from "expo-router";
import { ArrowLeft, UserPlus, Users, X } from "lucide-react-native";
import { useState } from "react";
import {
	Alert,
	FlatList,
	Modal,
	Pressable,
	RefreshControl,
	View,
} from "react-native";
import {
	EmptyState,
	ErrorState,
	LoadingState,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Body, Caption, H2, Label } from "@/components/ui/typography";
import {
	useInviteAdmin,
	useOrgTeam,
	useRemoveAdmin,
	useUpdateAdmin,
} from "@/hooks/use-directory";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { OrgTeamMember } from "@/lib/types";

export default function OrgTeam() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const [inviting, setInviting] = useState(false);

	const query = useOrgTeam();
	const remove = useRemoveAdmin();

	const confirmRemove = (member: OrgTeamMember) => {
		Alert.alert(
			"Remove from team",
			`${member.user.fullName ?? member.user.email} will lose access to this organization.`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Remove",
					style: "destructive",
					onPress: () =>
						remove.mutate(member.id, {
							onError: (error) =>
								Alert.alert("Could not remove", apiErrorMessage(error)),
						}),
				},
			],
		);
	};

	return (
		<View
			style={{
				flex: 1,
				backgroundColor: colors.background.warm,
				paddingHorizontal: spacing[6],
				paddingTop: spacing[8],
			}}
		>
			<Pressable
				onPress={() => router.back()}
				hitSlop={12}
				style={{ marginBottom: spacing[4] }}
			>
				<ArrowLeft size={22} color={colors.text.secondary as string} />
			</Pressable>

			<ScreenHeader
				title="Team"
				subtitle="People who can manage this organization."
				action={
					<Pressable
						onPress={() => setInviting(true)}
						style={{
							width: 44,
							height: 44,
							borderRadius: 22,
							alignItems: "center",
							justifyContent: "center",
							backgroundColor: colors.primary.main,
						}}
					>
						<UserPlus size={20} color={colors.primary.contrast as string} />
					</Pressable>
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
					data={query.data ?? []}
					keyExtractor={(item) => item.id}
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{ paddingBottom: spacing[10] }}
					ItemSeparatorComponent={() => <View style={{ height: spacing[3] }} />}
					refreshControl={
						<RefreshControl
							refreshing={query.isRefetching}
							onRefresh={() => query.refetch()}
							tintColor={colors.primary.main as string}
						/>
					}
					ListEmptyComponent={
						<EmptyState
							icon={Users}
							title="Just you so far"
							description="Add colleagues so they can post events and review applicants."
						/>
					}
					renderItem={({ item }) => (
						<MemberRow member={item} onRemove={() => confirmRemove(item)} />
					)}
				/>
			)}

			<InviteSheet visible={inviting} onClose={() => setInviting(false)} />
		</View>
	);
}

/**
 * One teammate, with their role editable in place.
 *
 * The edit is inline rather than an Alert.prompt: that only exists on iOS, so
 * on Android tapping would silently do nothing.
 */
function MemberRow({
	member,
	onRemove,
}: {
	member: OrgTeamMember;
	onRemove: () => void;
}) {
	const { colors, spacing } = useTheme();
	const [editing, setEditing] = useState(false);
	const [designation, setDesignation] = useState(member.designation ?? "");

	const update = useUpdateAdmin();

	const save = () => {
		update.mutate(
			{ id: member.id, input: { designation: designation.trim() } },
			{
				onSuccess: () => setEditing(false),
				onError: (error) =>
					Alert.alert("Could not save", apiErrorMessage(error)),
			},
		);
	};

	const cancel = () => {
		setDesignation(member.designation ?? "");
		setEditing(false);
	};

	return (
		<Surface>
			<View
				style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}
			>
				<View
					style={{
						width: 40,
						height: 40,
						borderRadius: 20,
						backgroundColor: colors.background.tertiary,
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<Body weight="bold" color="secondary">
						{(member.user.fullName ?? member.user.email)[0]?.toUpperCase()}
					</Body>
				</View>
				<View style={{ flex: 1 }}>
					<Body weight="bold" numberOfLines={1}>
						{member.user.fullName ?? member.user.email}
					</Body>
					<Caption color="tertiary" numberOfLines={1}>
						{member.designation ?? "Team member"} · joined{" "}
						{formatDate(member.joinedAt)}
					</Caption>
				</View>
				{member.isOwner && <StatusPill label="Owner" tone="info" />}
			</View>

			{editing ? (
				<View style={{ marginTop: spacing[3] }}>
					<Input
						placeholder="e.g. Programme Manager"
						value={designation}
						onChangeText={setDesignation}
						autoFocus
						style={{
							borderWidth: 0,
							borderRadius: 12,
							backgroundColor: colors.background.tertiary,
							paddingVertical: spacing[3],
						}}
					/>
					<View
						style={{
							flexDirection: "row",
							gap: spacing[4],
							marginTop: spacing[2],
						}}
					>
						<Pressable onPress={save} disabled={update.isPending} hitSlop={8}>
							<Caption weight="medium" color={colors.primary.main as string}>
								{update.isPending ? "Saving…" : "Save role"}
							</Caption>
						</Pressable>
						<Pressable onPress={cancel} hitSlop={8}>
							<Caption weight="medium" color="secondary">
								Cancel
							</Caption>
						</Pressable>
					</View>
				</View>
			) : (
				<View
					style={{
						flexDirection: "row",
						gap: spacing[4],
						marginTop: spacing[3],
					}}
				>
					<Pressable onPress={() => setEditing(true)} hitSlop={8}>
						<Caption weight="medium" color={colors.primary.main as string}>
							Change role
						</Caption>
					</Pressable>

					{/* The owner is deliberately not removable — losing them would
					    leave the organization unmanageable. */}
					{!member.isOwner && (
						<Pressable onPress={onRemove} hitSlop={8}>
							<Caption weight="medium" color={colors.error.main as string}>
								Remove from team
							</Caption>
						</Pressable>
					)}
				</View>
			)}
		</Surface>
	);
}

function InviteSheet({
	visible,
	onClose,
}: {
	visible: boolean;
	onClose: () => void;
}) {
	const { colors, spacing } = useTheme();
	const [email, setEmail] = useState("");
	const [designation, setDesignation] = useState("");
	const [error, setError] = useState<string | null>(null);

	const invite = useInviteAdmin();

	const submit = () => {
		if (!email.trim()) {
			setError("Enter their email address.");
			return;
		}
		setError(null);
		invite.mutate(
			{
				email: email.trim(),
				designation: designation.trim() || undefined,
			},
			{
				onSuccess: () => {
					setEmail("");
					setDesignation("");
					onClose();
				},
				onError: (e) => setError(apiErrorMessage(e)),
			},
		);
	};

	return (
		<Modal
			visible={visible}
			animationType="slide"
			presentationStyle="pageSheet"
			onRequestClose={onClose}
		>
			<View style={{ flex: 1, backgroundColor: colors.background.warm }}>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						justifyContent: "space-between",
						paddingHorizontal: spacing[6],
						paddingTop: spacing[6],
						paddingBottom: spacing[2],
					}}
				>
					<H2>Add to team</H2>
					<Pressable onPress={onClose} hitSlop={12}>
						<X size={22} color={colors.text.tertiary as string} />
					</Pressable>
				</View>

				<View style={{ padding: spacing[6], paddingTop: spacing[4] }}>
					<Caption color="tertiary" style={{ marginBottom: spacing[5] }}>
						They need a Nabhya account already — we won't create one on their
						behalf.
					</Caption>

					<Label style={{ marginBottom: spacing[1.5] }}>Email</Label>
					<Input
						placeholder="colleague@example.org"
						value={email}
						onChangeText={setEmail}
						keyboardType="email-address"
						autoCapitalize="none"
						style={{
							borderWidth: 0,
							borderRadius: 12,
							backgroundColor: colors.background.tertiary,
							paddingVertical: spacing[3.5],
						}}
					/>

					<Label style={{ marginTop: spacing[5], marginBottom: spacing[1.5] }}>
						Role <Caption color="tertiary">(optional)</Caption>
					</Label>
					<Input
						placeholder="e.g. Programme Manager"
						value={designation}
						onChangeText={setDesignation}
						style={{
							borderWidth: 0,
							borderRadius: 12,
							backgroundColor: colors.background.tertiary,
							paddingVertical: spacing[3.5],
						}}
					/>

					{error && (
						<Caption
							color={colors.error.main as string}
							style={{ marginTop: spacing[3] }}
						>
							{error}
						</Caption>
					)}

					<Button
						onPress={submit}
						loading={invite.isPending}
						style={{ marginTop: spacing[6] }}
					>
						Add to team
					</Button>
				</View>
			</View>
		</Modal>
	);
}
