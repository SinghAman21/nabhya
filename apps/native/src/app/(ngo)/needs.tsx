import type { NeedType, OrgNeedQuery } from "@nabhya/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import { HeartHandshake } from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { NeedFormSheet } from "@/components/need-form-sheet";
import { PagedList, usePagedQuery } from "@/components/paged-list";
import { PledgesSheet } from "@/components/pledges-sheet";
import {
	Banner,
	EmptyState,
	FilterChips,
	Screen,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import { humanizeStatus, StatusPill } from "@/components/status-pill";
import { TextAction } from "@/components/text-action";
import { Button } from "@/components/ui/button";
import { confirm, toast } from "@/components/ui/overlay";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption, Label } from "@/components/ui/typography";
import { useDeleteNeed, usePublicNeed } from "@/hooks/use-needs";
import { useOrgAccess } from "@/hooks/use-org-access";
import { useMe } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { useGridColumns } from "@/hooks/useMedia";
import { apiErrorMessage, orgNeedsApi, queryKeys } from "@/lib/api";
import { focusable } from "@/lib/focus";
import { formatProgress, formatRelative } from "@/lib/format";
import type { OrgNeedListItem } from "@/lib/types";

type TypeFilter = "ALL" | NeedType;

const FILTERS: Array<{ value: TypeFilter; label: string }> = [
	{ value: "ALL", label: "All" },
	{ value: "WANT", label: "We need" },
	{ value: "OFFER", label: "We're giving" },
];

export default function NgoNeeds() {
	const { spacing } = useTheme();
	const router = useRouter();
	const [filter, setFilter] = useState<TypeFilter>("ALL");
	const [sheetOpen, setSheetOpen] = useState(false);
	const [editing, setEditing] = useState<OrgNeedListItem | null>(null);
	const [reviewing, setReviewing] = useState<OrgNeedListItem | null>(null);
	const { data: me } = useMe();
	const access = useOrgAccess();

	const filters: Partial<OrgNeedQuery> =
		filter === "ALL" ? {} : { type: filter };
	// Under the `["org","needs"]` prefix, so every needs mutation refreshes it.
	const { query, items, first, loadMore } = usePagedQuery({
		queryKey: queryKeys.orgNeeds(filters),
		fetchPage: (page) => orgNeedsApi.list({ ...filters, page, limit: 20 }),
	});
	const deleteNeed = useDeleteNeed();
	const columns = useGridColumns();

	const total = first?.meta.total ?? items.length;

	// `?review=<needId>` - a "new pledge" notification opens that post's
	// responses. Falls back to the need's public record (pledges only exist on
	// a verified NGO's needs, so it is always visible) when the row is past
	// the first page. Cleared once used.
	const { review } = useLocalSearchParams<{ review?: string }>();
	const reviewRow = review ? items.find((item) => item.id === review) : null;
	const reviewDetail = usePublicNeed(review && !reviewRow ? review : undefined);
	useEffect(() => {
		if (!review) return;
		const detail = reviewDetail.data;
		const target: OrgNeedListItem | null =
			reviewRow ?? (detail ? { ...detail, pendingPledges: 0 } : null);
		if (!target) return;
		setReviewing(target);
		router.setParams({ review: undefined });
	}, [review, reviewRow, reviewDetail.data, router]);
	// The sheet's progress line reads the row as it is now: accepting a
	// pledge refetches the list.
	const reviewingLive =
		(reviewing && items.find((item) => item.id === reviewing.id)) ?? reviewing;
	// Posting is public and needs verification; editing and removing a post
	// that already exists only need the role.
	const createBlocked = access.blocked("content.publish", { public: true });
	const canEdit = !access.blocked("content.publish");
	const canRemove = !access.blocked("content.delete");

	const confirmDelete = async (need: OrgNeedListItem) => {
		const ok = await confirm({
			title: "Remove this post?",
			message: `"${need.title}" will be removed. A post with accepted pledges is closed instead of deleted, so the people who pledged keep their record of it.`,
			confirmLabel: "Remove",
		});
		if (!ok) return;
		deleteNeed.mutate(need.id, {
			onSuccess: () => toast.success("Post removed."),
			onError: (error) => toast.error(apiErrorMessage(error)),
		});
	};

	const openCreate = () => setSheetOpen(true);

	return (
		<Screen>
			<ScreenHeader
				title="Needs"
				subtitle={
					total > 0 ? `${total} post${total === 1 ? "" : "s"}` : undefined
				}
				action={
					<Button size="sm" onPress={openCreate} disabled={!!createBlocked}>
						New need
					</Button>
				}
			/>

			{createBlocked && (
				<View style={{ marginBottom: spacing[4] }}>
					{access.isVerified || access.isSuspended ? (
						<Banner tone="info" title="View only" description={createBlocked} />
					) : (
						<Banner
							tone="warning"
							title="Verification needed to post"
							description="Needs and offers go into every volunteer's feed, so they unlock once your documents are approved."
							onPress={() => router.push("/(ngo)/verification")}
						/>
					)}
				</View>
			)}

			<FilterChips options={FILTERS} value={filter} onChange={setFilter} />

			<PagedList
				query={query}
				items={items}
				loadMore={loadMore}
				loadingLabel="Loading your posts"
				numColumns={columns}
				noun="posts"
				keyExtractor={(item) => item.id}
				renderItem={(item) => (
					<NeedRow
						need={item}
						onReview={() => setReviewing(item)}
						onEdit={canEdit ? () => setEditing(item) : undefined}
						onDelete={canRemove ? () => confirmDelete(item) : undefined}
					/>
				)}
				empty={
					<EmptyState
						icon={HeartHandshake}
						title={
							filter === "ALL"
								? "Nothing posted yet"
								: filter === "WANT"
									? "No requests yet"
									: "No offers yet"
						}
						description={
							createBlocked
								? "Posts your team makes will show here with their pledges."
								: "Ask for what your programme needs, or list surplus you can pass on. Each post shows here with its pledges."
						}
						action={
							createBlocked ? undefined : (
								<Button onPress={openCreate}>
									{filter === "OFFER" ? "Offer something" : "Post a need"}
								</Button>
							)
						}
					/>
				}
			/>

			<PledgesSheet need={reviewingLive} onClose={() => setReviewing(null)} />

			<NeedFormSheet
				visible={sheetOpen || !!editing}
				need={editing}
				onClose={() => {
					setSheetOpen(false);
					setEditing(null);
				}}
				defaultCity={me?.organization?.city}
				defaultState={me?.organization?.state}
			/>
		</Screen>
	);
}

/**
 * One post. Tapping the card opens its responses - that is the decision this
 * screen exists for. Edit and Remove sit quietly in the footer.
 */
function NeedRow({
	need,
	onReview,
	onEdit,
	onDelete,
}: {
	need: OrgNeedListItem;
	onReview: () => void;
	/** Omitted when the viewer's team role cannot change the post. */
	onEdit?: () => void;
	onDelete?: () => void;
}) {
	const { colors, spacing } = useTheme();
	const pending = need.pendingPledges ?? 0;

	return (
		<Surface
			onPress={onReview}
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
					<Pressable
						onPress={onReview}
						accessibilityRole="button"
						accessibilityLabel={`See responses to ${need.title}`}
						{...focusable}
						style={{ flex: 1, minWidth: 0 }}
					>
						<Label numberOfLines={1}>
							{formatProgress(need.fulfilledQuantity, need.quantity, need.unit)}
						</Label>
						<Caption
							weight={pending > 0 ? "medium" : "normal"}
							color={
								pending > 0 ? (colors.warning.ink as string) : "quaternary"
							}
							numberOfLines={1}
						>
							{pending > 0
								? `${pending} pledge${pending === 1 ? "" : "s"} to review`
								: "Tap to see responses"}
						</Caption>
					</Pressable>
					<View style={{ flexDirection: "row", gap: spacing[3] }}>
						{onEdit && (
							<TextAction
								label="Edit"
								onPress={onEdit}
								accessibilityLabel={`Edit ${need.title}`}
							/>
						)}
						{onDelete && (
							<TextAction
								label="Remove"
								tone="danger"
								onPress={onDelete}
								accessibilityLabel={`Remove ${need.title}`}
							/>
						)}
					</View>
				</View>
			}
		>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[2],
					marginBottom: spacing[2.5],
				}}
			>
				<StatusPill
					label={need.type === "WANT" ? "We need" : "We're giving"}
					tone={need.type === "WANT" ? "info" : "success"}
				/>
				{need.urgency === "HIGH" && <StatusPill label="Urgent" tone="error" />}
				{need.status !== "OPEN" && (
					<StatusPill label={humanizeStatus(need.status)} tone="neutral" />
				)}
				<View style={{ flex: 1 }} />
				<Caption color="quaternary">{formatRelative(need.createdAt)}</Caption>
			</View>

			<Body weight="bold" numberOfLines={1}>
				{need.title}
			</Body>
			<Caption
				color="tertiary"
				numberOfLines={2}
				style={{ marginTop: spacing[0.5] }}
			>
				{need.description}
			</Caption>
		</Surface>
	);
}
