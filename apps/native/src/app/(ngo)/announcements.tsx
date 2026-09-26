import {
	type UpsertAnnouncementInput,
	upsertAnnouncementSchema,
} from "@nabhya/shared";
import { useRouter } from "expo-router";
import { Check, Megaphone, Pin } from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Field, FieldError, useFieldInputStyle } from "@/components/form-field";
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
import { Input } from "@/components/ui/input";
import { confirm, toast } from "@/components/ui/overlay";
import { Pressable } from "@/components/ui/pressable";
import { Sheet } from "@/components/ui/sheet";
import { Body, Caption } from "@/components/ui/typography";
import {
	useCreateAnnouncement,
	useDeleteAnnouncement,
	useUpdateAnnouncement,
} from "@/hooks/use-directory";
import { useOrgAccess } from "@/hooks/use-org-access";
import { useTheme } from "@/hooks/use-theme";
import { useGridColumns } from "@/hooks/useMedia";
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

/**
 * Announcements on the public profile. Distinct from "Share an update"
 * (`/feed`), which is a feed post: these are pinned, titled, and can be held
 * as drafts.
 */
export default function OrgAnnouncements() {
	const { spacing } = useTheme();
	const router = useRouter();
	const [filter, setFilter] = useState<StatusFilter>("ALL");
	const [composing, setComposing] = useState(false);
	const [editing, setEditing] = useState<Announcement | null>(null);
	const access = useOrgAccess();

	const params = filter === "ALL" ? {} : { status: filter };
	// Filtered by the server: a client filter only saw the pages loaded so far.
	const { query, items, loadMore } = usePagedQuery({
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

	return (
		<Screen>
			<ScreenHeader
				back
				title="Updates"
				subtitle="Shown on your public profile"
				action={
					<Button size="sm" onPress={openCreate} disabled={!!createBlocked}>
						New update
					</Button>
				}
			/>

			{createBlocked && (
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
			)}

			<FilterChips options={FILTERS} value={filter} onChange={setFilter} />

			<PagedList
				query={query}
				items={items}
				loadMore={loadMore}
				numColumns={columns}
				noun="updates"
				keyExtractor={(item) => item.id}
				renderItem={(item) => (
					<AnnouncementRow
						announcement={item}
						onEdit={canEdit ? () => setEditing(item) : undefined}
						onDelete={canDelete ? () => confirmDelete(item) : undefined}
					/>
				)}
				empty={
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
				}
			/>

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
	/** Omitted when the viewer's team role cannot change the update. */
	onEdit?: () => void;
	onDelete?: () => void;
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
