import type { UpsertAnnouncementInput } from "@nabhya/shared";
import { Megaphone, Pin, Plus } from "lucide-react-native";
import { useEffect, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
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
import { Pressable } from "@/components/ui/pressable";
import { Sheet } from "@/components/ui/sheet";
import { Body, Caption, Label } from "@/components/ui/typography";
import {
	useCreateAnnouncement,
	useDeleteAnnouncement,
	useMyAnnouncements,
	useUpdateAnnouncement,
} from "@/hooks/use-directory";
import { useTheme } from "@/hooks/useTheme";
import { Alert } from "@/lib/alert";
import { apiErrorMessage } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import type { Announcement } from "@/lib/types";

export default function OrgAnnouncements() {
	const { colors, spacing } = useTheme();
	const [composing, setComposing] = useState(false);
	const [editing, setEditing] = useState<Announcement | null>(null);

	const query = useMyAnnouncements();
	const remove = useDeleteAnnouncement();

	const confirmDelete = (announcement: Announcement) => {
		Alert.alert("Delete update", `"${announcement.title}" will be removed.`, [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Delete",
				style: "destructive",
				onPress: () =>
					remove.mutate(announcement.id, {
						onError: (error) =>
							Alert.alert("Could not delete", apiErrorMessage(error)),
					}),
			},
		]);
	};

	return (
		<Screen>
			<ScreenHeader
				back
				title="Updates"
				subtitle="Publishing notifies everyone who saved your organization."
				action={
					<Pressable
						onPress={() => setComposing(true)}
						style={{
							width: 44,
							height: 44,
							borderRadius: 22,
							alignItems: "center",
							justifyContent: "center",
							backgroundColor: colors.primary.main,
						}}
					>
						<Plus size={22} color={colors.primary.contrast as string} />
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
					data={query.data?.items ?? []}
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
							icon={Megaphone}
							title="No updates yet"
							description="Share what you've been doing — it appears on your public profile."
							action={
								<Button onPress={() => setComposing(true)}>
									Post your first update
								</Button>
							}
						/>
					}
					renderItem={({ item }) => (
						<Surface onPress={() => setEditing(item)}>
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									gap: spacing[2],
									marginBottom: spacing[2],
								}}
							>
								{item.status === "DRAFT" && (
									<StatusPill label="Draft" tone="neutral" />
								)}
								{item.isPinned && (
									<View
										style={{
											flexDirection: "row",
											alignItems: "center",
											gap: spacing[1],
										}}
									>
										<Pin size={12} color={colors.primary.main as string} />
										<Caption color={colors.primary.main as string}>
											Pinned
										</Caption>
									</View>
								)}
							</View>

							<Body weight="bold" numberOfLines={2}>
								{item.title}
							</Body>
							<Caption
								color="tertiary"
								numberOfLines={3}
								style={{ marginTop: 4 }}
							>
								{item.body}
							</Caption>

							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									justifyContent: "space-between",
									marginTop: spacing[3],
									paddingTop: spacing[3],
									borderTopWidth: 1,
									borderTopColor: colors.border.light,
								}}
							>
								<Caption color="quaternary">
									{formatRelative(item.publishedAt ?? item.createdAt)}
								</Caption>
								<Pressable onPress={() => confirmDelete(item)} hitSlop={8}>
									<Caption weight="medium" color={colors.error.main as string}>
										Delete
									</Caption>
								</Pressable>
							</View>
						</Surface>
					)}
				/>
			)}

			<AnnouncementSheet
				visible={composing || !!editing}
				announcement={editing}
				onClose={() => {
					setComposing(false);
					setEditing(null);
				}}
			/>
		</Screen>
	);
}

function AnnouncementSheet({
	visible,
	announcement,
	onClose,
}: {
	visible: boolean;
	announcement: Announcement | null;
	onClose: () => void;
}) {
	const { colors, spacing } = useTheme();
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [isPinned, setPinned] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const create = useCreateAnnouncement();
	const update = useUpdateAnnouncement();
	const isEditing = !!announcement;

	useEffect(() => {
		if (announcement) {
			setTitle(announcement.title);
			setBody(announcement.body);
			setPinned(announcement.isPinned);
		} else {
			setTitle("");
			setBody("");
			setPinned(false);
		}
		setError(null);
	}, [announcement]);

	const inputStyle = {
		borderWidth: 0,
		borderRadius: 12,
		backgroundColor: colors.background.tertiary,
		paddingVertical: spacing[3.5],
	} as const;

	const submit = (status: "DRAFT" | "PUBLISHED") => {
		const payload: UpsertAnnouncementInput = {
			title: title.trim(),
			body: body.trim(),
			status,
			isPinned,
		};

		if (payload.title.length < 4) {
			setError("Give the update a title of at least 4 characters.");
			return;
		}
		if (payload.body.length < 10) {
			setError("Write at least a sentence.");
			return;
		}

		setError(null);
		const options = {
			onSuccess: onClose,
			onError: (e: unknown) => setError(apiErrorMessage(e)),
		};

		if (isEditing && announcement) {
			update.mutate({ id: announcement.id, input: payload }, options);
		} else {
			create.mutate(payload, options);
		}
	};

	const saving = create.isPending || update.isPending;

	return (
		<Sheet
			visible={visible}
			onClose={onClose}
			title={isEditing ? "Edit update" : "New update"}
			footer={
				<>
					<Button onPress={() => submit("PUBLISHED")} loading={saving}>
						Publish update
					</Button>
					<Button
						variant="outline"
						onPress={() => submit("DRAFT")}
						disabled={saving}
						style={{ marginTop: spacing[2] }}
					>
						Save as draft
					</Button>
				</>
			}
		>
			<Label style={{ marginBottom: spacing[1.5] }}>Title</Label>
			<Input
				placeholder="e.g. 400 blankets distributed in Dharavi"
				value={title}
				onChangeText={setTitle}
				style={inputStyle}
			/>

			<Label style={{ marginTop: spacing[5], marginBottom: spacing[1.5] }}>
				Update
			</Label>
			<Input
				placeholder="What happened, who it helped, what's next"
				value={body}
				onChangeText={setBody}
				multiline
				style={{ ...inputStyle, minHeight: 140, textAlignVertical: "top" }}
			/>

			<Pressable
				onPress={() => setPinned((v) => !v)}
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[3],
					marginTop: spacing[4],
				}}
			>
				<View
					style={{
						width: 22,
						height: 22,
						borderRadius: 6,
						borderWidth: 2,
						borderColor: isPinned ? colors.primary.main : colors.border.dark,
						backgroundColor: isPinned ? colors.primary.main : "transparent",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					{isPinned && (
						<Body
							weight="bold"
							color={colors.primary.contrast as string}
							style={{ fontSize: 13, lineHeight: 16 }}
						>
							✓
						</Body>
					)}
				</View>
				<Caption color="secondary" style={{ flex: 1 }}>
					Pin to the top of our profile
				</Caption>
			</Pressable>

			{error && (
				<Caption
					color={colors.error.main as string}
					style={{ marginTop: spacing[3] }}
				>
					{error}
				</Caption>
			)}
		</Sheet>
	);
}
