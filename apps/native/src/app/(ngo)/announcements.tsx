import {
	type UpsertAnnouncementInput,
	upsertAnnouncementSchema,
} from "@nabhya/shared";
import { useRouter } from "expo-router";
import { Check, Megaphone, Pin } from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { ConsoleList } from "@/components/admin/console-list";
import type { TableColumn } from "@/components/admin/data-table";
import { AdminScreen } from "@/components/admin/list-chrome";
import { SelectMenu, type SelectOption } from "@/components/admin/select-menu";
import { Toolbar, useTableView } from "@/components/admin/toolbar";
import { Field, FieldError, useFieldInputStyle } from "@/components/form-field";
import { FormFooterRow, useFormButtonGrow } from "@/components/ngo/form-footer";
import { RowActions } from "@/components/ngo/table-cells";
import { PagedList, usePagedQuery } from "@/components/paged-list";
import {
	Banner,
	EmptyState,
	FilterChips,
	Screen,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import { StatusPill } from "@/components/status-pill";
import { TextAction } from "@/components/text-action";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { confirm, toast } from "@/components/ui/overlay";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption } from "@/components/ui/typography";
import {
	useCreateAnnouncement,
	useDeleteAnnouncement,
	useUpdateAnnouncement,
} from "@/hooks/use-directory";
import { useOrgAccess } from "@/hooks/use-org-access";
import { useTheme } from "@/hooks/use-theme";
import { useGridColumns, useMedia } from "@/hooks/useMedia";
import { apiErrorMessage, publishingApi, queryKeys } from "@/lib/api";
import { focusable } from "@/lib/focus";
import { formatDate, formatRelative } from "@/lib/format";
import type { Announcement } from "@/lib/types";

type StatusFilter = "ALL" | "PUBLISHED" | "DRAFT";

const FILTERS: Array<SelectOption<StatusFilter>> = [
	{ value: "ALL", label: "All" },
	{ value: "PUBLISHED", label: "Published" },
	{ value: "DRAFT", label: "Drafts" },
];

/**
 * Announcements on the public profile. Distinct from "Share an update"
 * (`/feed`), which is a feed post: these are pinned, titled, and can be held
 * as drafts.
 *
 * Desktop renders them in the console's table with a status `SelectMenu`, the
 * same shape as Events and Needs, so the NGO's lists read as one product. No
 * column sorts: the publishing endpoint takes no `sort`, and a header that
 * re-ordered only the loaded page would be a lie (see `data-table.tsx`) - so
 * the headers stay plain until the server learns one.
 */
export default function OrgAnnouncements() {
	const { spacing } = useTheme();
	const router = useRouter();
	const { isDesktop } = useMedia();
	const [filter, setFilter] = useState<StatusFilter>("ALL");
	const [composing, setComposing] = useState(false);
	const [editing, setEditing] = useState<Announcement | null>(null);
	const [view, setView] = useTableView("ngo-announcements");
	const access = useOrgAccess();

	const params = filter === "ALL" ? {} : { status: filter };
	// Filtered by the server: a client filter only saw the pages loaded so far.
	const { query, items, first, loadMore } = usePagedQuery({
		queryKey: queryKeys.myAnnouncements(params),
		fetchPage: (page) =>
			publishingApi.listMyAnnouncements({ ...params, page, limit: 20 }),
	});
	const columns = useGridColumns();
	const remove = useDeleteAnnouncement();

	// The server requires verification even to save a draft of an update.
	const createBlocked = access.blocked("content.publish", { public: true });
	const canEdit = !access.blocked("content.publish");
	const canDelete = !access.blocked("content.delete");

	const confirmDelete = async (announcement: Announcement) => {
		const ok = await confirm({
			title: "Delete this update?",
			message: `"${announcement.title}" will be removed from your public profile and from every feed it reached.`,
			confirmLabel: "Delete",
		});
		if (!ok) return;
		remove.mutate(announcement.id, {
			onSuccess: () => toast.success("Update deleted."),
			onError: (error) => toast.error(apiErrorMessage(error)),
		});
	};

	const openCreate = () => setComposing(true);

	const newUpdate = (
		<Button size="sm" onPress={openCreate} disabled={!!createBlocked}>
			New update
		</Button>
	);

	const banner = createBlocked ? (
		<View style={{ marginBottom: spacing[4] }}>
			{!access.isVerified && !access.isSuspended ? (
				<Banner
					tone="warning"
					title="Verification needed to post updates"
					description="Updates appear on your public profile and notify followers, so they unlock once your documents are approved."
					onPress={() => router.push("/(ngo)/verification")}
				/>
			) : (
				<Banner tone="info" title="View only" description={createBlocked} />
			)}
		</View>
	) : null;

	const renderCard = (item: Announcement) => (
		<AnnouncementRow
			announcement={item}
			onEdit={canEdit ? () => setEditing(item) : undefined}
			onDelete={canDelete ? () => confirmDelete(item) : undefined}
		/>
	);

	const empty = (
		<EmptyState
			icon={Megaphone}
			title={
				filter === "DRAFT"
					? "No drafts"
					: filter === "PUBLISHED"
						? "Nothing published yet"
						: "No updates yet"
			}
			description="Progress reports, thank-yous, what's coming next. Published updates appear on your profile and notify people who follow you."
			action={
				createBlocked ? undefined : (
					<Button onPress={openCreate}>Write an update</Button>
				)
			}
		/>
	);

	const sheet = (
		<AnnouncementSheet
			visible={composing || !!editing}
			announcement={editing}
			onClose={() => {
				setComposing(false);
				setEditing(null);
			}}
		/>
	);

	if (isDesktop) {
		return (
			<AdminScreen
				title="Updates"
				subtitle="Shown on your public profile"
				action={newUpdate}
				toolbar={
					<Toolbar view={view} onViewChange={setView}>
						<SelectMenu
							label="Status"
							value={filter}
							options={FILTERS}
							onChange={setFilter}
						/>
					</Toolbar>
				}
				onNearEnd={loadMore}
				refreshing={query.isRefetching && !query.isFetchingNextPage}
				onRefresh={() => query.refetch()}
			>
				{banner}
				<ConsoleList
					query={query}
					items={items}
					total={first?.meta.total ?? 0}
					loadMore={loadMore}
					noun="update"
					view={view}
					columns={announcementColumns({
						onEdit: canEdit ? setEditing : undefined,
						onDelete: canDelete ? confirmDelete : undefined,
					})}
					rowKey={(announcement) => announcement.id}
					// The card opens the editor; so does the row, for a role that
					// can edit. Otherwise there is nothing to open.
					{...(canEdit
						? {
								onRowPress: (announcement: Announcement) =>
									setEditing(announcement),
							}
						: {})}
					renderCard={renderCard}
					empty={empty}
				/>
				{sheet}
			</AdminScreen>
		);
	}

	return (
		<Screen>
			<ScreenHeader
				back
				title="Updates"
				subtitle="Shown on your public profile"
				action={newUpdate}
			/>

			{banner}

			<FilterChips options={FILTERS} value={filter} onChange={setFilter} />

			<PagedList
				query={query}
				items={items}
				loadMore={loadMore}
				numColumns={columns}
				noun="updates"
				keyExtractor={(item) => item.id}
				renderItem={renderCard}
				empty={empty}
			/>

			{sheet}
		</Screen>
	);
}

/**
 * The desktop table's columns. None sorts - see the note on the screen.
 */
function announcementColumns({
	onEdit,
	onDelete,
}: {
	onEdit?: (announcement: Announcement) => void;
	onDelete?: (announcement: Announcement) => void;
}): Array<TableColumn<Announcement>> {
	return [
		{
			key: "title",
			header: "Update",
			minWidth: 260,
			render: (announcement) => (
				<View style={{ minWidth: 0, alignSelf: "stretch" }}>
					<Body weight="medium" numberOfLines={1}>
						{announcement.title}
					</Body>
					<Caption color="quaternary" numberOfLines={1}>
						{announcement.body}
					</Caption>
				</View>
			),
		},
		{
			key: "status",
			header: "Status",
			width: 108,
			render: (announcement) =>
				announcement.status === "DRAFT" ? (
					<StatusPill label="Draft" tone="neutral" />
				) : (
					<Caption color="quaternary">Published</Caption>
				),
		},
		{
			key: "pinned",
			header: "Pinned",
			width: 84,
			render: (announcement) => <PinnedCell pinned={announcement.isPinned} />,
		},
		{
			key: "date",
			header: "Last change",
			width: 120,
			align: "end",
			render: (announcement) => (
				<Caption color="quaternary">
					{formatDate(
						announcement.status === "DRAFT"
							? announcement.updatedAt
							: (announcement.publishedAt ?? announcement.createdAt),
					)}
				</Caption>
			),
		},
		{
			key: "actions",
			header: "",
			width: 150,
			align: "end",
			render: (announcement) => (
				<RowActions
					name={announcement.title}
					editLabel={
						announcement.status === "DRAFT" ? "Edit & publish" : "Edit"
					}
					editTone={announcement.status === "DRAFT" ? "brand" : "default"}
					deleteLabel="Delete"
					{...(onEdit ? { onEdit: () => onEdit(announcement) } : {})}
					{...(onDelete ? { onDelete: () => onDelete(announcement) } : {})}
				/>
			),
		},
	];
}

function PinnedCell({ pinned }: { pinned: boolean }) {
	const { colors, spacing } = useTheme();
	if (!pinned) return <Caption color="quaternary">-</Caption>;

	return (
		<View
			style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}
		>
			<Pin size={12} color={colors.primary.ink} strokeWidth={2.2} />
			<Caption weight="medium" color={colors.primary.ink}>
				Pinned
			</Caption>
		</View>
	);
}

function AnnouncementRow({
	announcement,
	onEdit,
	onDelete,
}: {
	announcement: Announcement;
	/** Omitted when the viewer's team role cannot change the update. */
	onEdit?: () => void;
	onDelete?: () => void;
}) {
	const { colors, spacing } = useTheme();
	const isDraft = announcement.status === "DRAFT";

	return (
		<Surface
			onPress={onEdit}
			footer={
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
						{onEdit && (
							<TextAction
								label={isDraft ? "Edit & publish" : "Edit"}
								tone={isDraft ? "brand" : "default"}
								onPress={onEdit}
								accessibilityLabel={`Edit ${announcement.title}`}
							/>
						)}
						{onDelete && (
							<TextAction
								label="Delete"
								tone="danger"
								onPress={onDelete}
								accessibilityLabel={`Delete ${announcement.title}`}
							/>
						)}
					</View>
				</View>
			}
		>
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
	const grow = useFormButtonGrow();
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
			onSuccess: () => {
				toast.success(
					payload.status === "PUBLISHED"
						? isEditing
							? "Update saved and published."
							: "Update published. People who follow you have been notified."
						: "Draft saved.",
				);
				onClose();
			},
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
		<Drawer
			visible={visible}
			onClose={onClose}
			wide
			title={isEditing ? "Edit update" : "New update"}
			subtitle="Publishing notifies everyone who follows you."
			footer={
				<View style={{ gap: spacing[2] }}>
					<FieldError message={errors.form} />
					<FormFooterRow
						secondary={
							!isEditing || announcement?.status === "DRAFT" ? (
								<Button
									variant="outline"
									onPress={() => submit("DRAFT")}
									disabled={saving}
									style={grow}
								>
									{isEditing ? "Keep as draft" : "Save as draft"}
								</Button>
							) : undefined
						}
						primary={
							<Button
								onPress={() => submit("PUBLISHED")}
								loading={saving}
								style={grow}
							>
								{publishLabel}
							</Button>
						}
					/>
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
		</Drawer>
	);
}
