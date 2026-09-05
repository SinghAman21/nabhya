import {
	type UpsertAnnouncementInput,
	upsertAnnouncementSchema,
} from "@nabhya/shared";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Check, Megaphone, Pin } from "lucide-react-native";
import { useEffect, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { Field, FieldError, useFieldInputStyle } from "@/components/form-field";
import { LoadMoreFooter } from "@/components/load-more-footer";
import {
	EmptyState,
	ErrorState,
	FilterChips,
	LoadingState,
	Screen,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import { StatusPill } from "@/components/status-pill";
import { TextAction } from "@/components/text-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Sheet } from "@/components/ui/sheet";
import { Body, Caption } from "@/components/ui/typography";
import {
	useCreateAnnouncement,
	useDeleteAnnouncement,
	useUpdateAnnouncement,
} from "@/hooks/use-directory";
import { useTheme } from "@/hooks/use-theme";
import { Alert } from "@/lib/alert";
import { apiErrorMessage, publishingApi, queryKeys } from "@/lib/api";
import { focusable } from "@/lib/focus";
import { formatRelative } from "@/lib/format";
import type { Announcement } from "@/lib/types";

type StatusFilter = "ALL" | "PUBLISHED" | "DRAFT";

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
	{ value: "ALL", label: "All" },
	{ value: "PUBLISHED", label: "Published" },
	{ value: "DRAFT", label: "Drafts" },
];

const PAGE_SIZE = 20;

/** Own announcements, page by page; the status filter is applied locally. */
function useMyAnnouncementPages() {
	return useInfiniteQuery({
		queryKey: queryKeys.myAnnouncements({ paged: true }),
		queryFn: ({ pageParam }) =>
			publishingApi.listMyAnnouncements({
				page: pageParam,
				limit: PAGE_SIZE,
			}),
		initialPageParam: 1,
		getNextPageParam: (last) =>
			last.meta.hasMore ? last.meta.page + 1 : undefined,
	});
}

/**
 * Announcements on the public profile. Distinct from "Share an update"
 * (`/feed`), which is a feed post: these are pinned, titled, and can be held
 * as drafts.
 */
export default function OrgAnnouncements() {
	const { colors, spacing } = useTheme();
	const [filter, setFilter] = useState<StatusFilter>("ALL");
	const [composing, setComposing] = useState(false);
	const [editing, setEditing] = useState<Announcement | null>(null);

	const query = useMyAnnouncementPages();
	const remove = useDeleteAnnouncement();

	const all = query.data?.pages.flatMap((page) => page.items) ?? [];
	const items =
		filter === "ALL" ? all : all.filter((item) => item.status === filter);

	const loadMore = () => {
		if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
	};

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

	const openCreate = () => setComposing(true);

	return (
		<Screen>
			<ScreenHeader
				back
				title="Updates"
				subtitle="Shown on your public profile"
				action={
					<Button size="sm" onPress={openCreate}>
						New update
					</Button>
				}
			/>

			<FilterChips options={FILTERS} value={filter} onChange={setFilter} />

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
					onEndReached={loadMore}
					onEndReachedThreshold={0.5}
					refreshControl={
						<RefreshControl
							refreshing={query.isRefetching && !query.isFetchingNextPage}
							onRefresh={() => query.refetch()}
							tintColor={colors.text.quaternary as string}
						/>
					}
					ListEmptyComponent={
						<EmptyState
							icon={Megaphone}
							title={filter === "DRAFT" ? "No drafts" : "No updates yet"}
							description="Progress reports, thank-yous, what's coming next. Published updates appear on your profile and notify people who follow you."
							action={<Button onPress={openCreate}>Write an update</Button>}
						/>
					}
					ListFooterComponent={
						<LoadMoreFooter
							hasMore={!!query.hasNextPage}
							loading={query.isFetchingNextPage}
							onLoadMore={loadMore}
							count={items.length}
							noun="updates"
						/>
					}
					renderItem={({ item }) => (
						<AnnouncementRow
							announcement={item}
							onEdit={() => setEditing(item)}
							onDelete={() => confirmDelete(item)}
						/>
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

function AnnouncementRow({
	announcement,
	onEdit,
	onDelete,
}: {
	announcement: Announcement;
	onEdit: () => void;
	onDelete: () => void;
}) {
	const { colors, spacing } = useTheme();
	const isDraft = announcement.status === "DRAFT";

	return (
		<Surface onPress={onEdit}>
			{(isDraft || announcement.isPinned) && (
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[2],
						marginBottom: spacing[2.5],
					}}
				>
					{isDraft && <StatusPill label="Draft" tone="neutral" />}
					{announcement.isPinned && (
						<View
							style={{
								flexDirection: "row",
								alignItems: "center",
								gap: spacing[1],
							}}
						>
							<Pin size={12} color={colors.primary.ink} strokeWidth={2.2} />
							<Caption weight="medium" color={colors.primary.ink}>
								Pinned
							</Caption>
						</View>
					)}
				</View>
			)}

			<Body weight="bold" numberOfLines={2}>
				{announcement.title}
			</Body>
			<Caption
				color="tertiary"
				numberOfLines={3}
				style={{ marginTop: spacing[1] }}
			>
				{announcement.body}
			</Caption>

			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					gap: spacing[3],
					marginTop: spacing[3],
					paddingTop: spacing[3],
					borderTopWidth: 1,
					borderTopColor: colors.border.hairline,
				}}
			>
				<Caption color="quaternary" style={{ flex: 1 }} numberOfLines={1}>
					{isDraft
						? `Saved ${formatRelative(announcement.updatedAt)}`
						: `Published ${formatRelative(announcement.publishedAt ?? announcement.createdAt)}`}
				</Caption>
				<View style={{ flexDirection: "row", gap: spacing[3] }}>
					<TextAction
						label={isDraft ? "Edit & publish" : "Edit"}
						tone={isDraft ? "brand" : "default"}
						onPress={onEdit}
						accessibilityLabel={`Edit ${announcement.title}`}
					/>
					<TextAction
						label="Delete"
						tone="danger"
						onPress={onDelete}
						accessibilityLabel={`Delete ${announcement.title}`}
					/>
				</View>
			</View>
		</Surface>
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
	const inputStyle = useFieldInputStyle();
	const textAreaStyle = useFieldInputStyle(140);
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [isPinned, setPinned] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});

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
		setErrors({});
	}, [announcement]);

	const submit = (status: "DRAFT" | "PUBLISHED") => {
		const parsed = upsertAnnouncementSchema.safeParse({
			title,
			body,
			status,
			isPinned,
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
		const payload = parsed.data as UpsertAnnouncementInput;
		const options = {
			onSuccess: onClose,
			onError: (e: unknown) => setErrors({ form: apiErrorMessage(e) }),
		};

		if (isEditing && announcement) {
			update.mutate({ id: announcement.id, input: payload }, options);
		} else {
			create.mutate(payload, options);
		}
	};

	const saving = create.isPending || update.isPending;
	const publishLabel =
		isEditing && announcement?.status === "DRAFT"
			? "Publish this draft"
			: isEditing
				? "Save changes"
				: "Publish update";

	return (
		<Sheet
			visible={visible}
			onClose={onClose}
			title={isEditing ? "Edit update" : "New update"}
			subtitle="Publishing notifies everyone who follows you."
			footer={
				<View style={{ gap: spacing[2] }}>
					<FieldError message={errors.form} />
					<Button onPress={() => submit("PUBLISHED")} loading={saving}>
						{publishLabel}
					</Button>
					{(!isEditing || announcement?.status === "DRAFT") && (
						<Button
							variant="outline"
							onPress={() => submit("DRAFT")}
							disabled={saving}
						>
							{isEditing ? "Keep as draft" : "Save as draft"}
						</Button>
					)}
				</View>
			}
		>
			<View style={{ paddingTop: spacing[2] }}>
				<Field label="Title" error={errors.title}>
					<Input
						placeholder="e.g. 400 blankets distributed in Dharavi"
						value={title}
						onChangeText={setTitle}
						style={inputStyle}
					/>
				</Field>

				<Field label="Update" error={errors.body}>
					<Input
						placeholder="What happened, who it helped, what's next"
						value={body}
						onChangeText={setBody}
						multiline
						style={textAreaStyle}
					/>
				</Field>

				<Pressable
					onPress={() => setPinned((v) => !v)}
					accessibilityRole="checkbox"
					accessibilityState={{ checked: isPinned }}
					accessibilityLabel="Pin to the top of our profile"
					hitSlop={6}
					{...focusable}
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[3],
						minHeight: 44,
					}}
				>
					<View
						style={{
							width: 22,
							height: 22,
							borderRadius: 6,
							borderWidth: 1.5,
							borderColor: isPinned
								? (colors.text.primary as string)
								: colors.border.dark,
							backgroundColor: isPinned
								? (colors.text.primary as string)
								: "transparent",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						{isPinned && (
							<Check
								size={14}
								color={colors.text.inverse as string}
								strokeWidth={3}
							/>
						)}
					</View>
					<View style={{ flex: 1 }}>
						<Body>Pin to the top of our profile</Body>
						<Caption color="quaternary">
							Pinned updates show first on your public profile.
						</Caption>
					</View>
				</Pressable>
			</View>
		</Sheet>
	);
}
