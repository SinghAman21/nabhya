import { useRouter } from "expo-router";
import { UserCheck } from "lucide-react-native";
import { View } from "react-native";
import { withAppShell } from "@/components/app-shell";
import { PAGE_SIZE, PagedList, usePagedQuery } from "@/components/paged-list";
import { EmptyState, Screen, ScreenHeader } from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/overlay";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption, Label } from "@/components/ui/typography";
import { useToggleFollow } from "@/hooks/use-engagement";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage, engagementApi, queryKeys } from "@/lib/api";
import { focusable } from "@/lib/focus";
import type { BookmarkListItem } from "@/lib/types";

/**
 * NGOs the volunteer follows (issue #7) - the ones whose posts make up the
 * Following feed. Distinct from Saved NGOs (`bookmarks.tsx`), which is a
 * private shortlist that changes nothing in the feed; the two used to share a
 * single profile row that opened the bookmarks page.
 *
 * Same shape as `bookmarks.tsx` on purpose: grouped rows, tap to open,
 * "Unfollow" with an Undo toast rather than a confirmation.
 */
function Following() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const toggle = useToggleFollow();

	const { query, items, first, loadMore } = usePagedQuery({
		queryKey: queryKeys.following({ limit: PAGE_SIZE }),
		fetchPage: (page) =>
			engagementApi.listFollowing({ page, limit: PAGE_SIZE }),
	});
	const total = first?.meta.total ?? 0;

	const unfollow = (item: BookmarkListItem) => {
		const name = item.organization.organizationName;
		const organizationId = item.organization.id;
		toggle.mutate(
			{ organizationId, following: true },
			{
				onSuccess: () =>
					toast.success(`Unfollowed ${name}.`, {
						label: "Undo",
						onPress: () => toggle.mutate({ organizationId, following: false }),
					}),
				onError: (error) => toast.error(apiErrorMessage(error)),
			},
		);
	};

	return (
		<Screen>
			<ScreenHeader
				back
				title="Following"
				subtitle={
					total > 0
						? `${total} NGO${total === 1 ? "" : "s"} · their posts fill your Following feed`
						: "Their posts fill your Following feed."
				}
			/>

			<PagedList
				query={query}
				items={items}
				loadMore={loadMore}
				grouped
				noun="NGOs"
				keyExtractor={(item) => item.id}
				empty={
					<EmptyState
						icon={UserCheck}
						title="Not following anyone yet"
						description="Follow an NGO from any of its posts and its updates, needs and events show up in your Following feed."
						action={
							<Button
								size="sm"
								variant="outline"
								onPress={() => router.push("/ngos")}
							>
								Browse NGOs
							</Button>
						}
					/>
				}
				renderItem={(item) => (
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: spacing[3],
							paddingRight: spacing[4],
						}}
					>
						<Pressable
							onPress={() => router.push(`/ngos/${item.organization.id}`)}
							accessibilityRole="button"
							accessibilityLabel={item.organization.organizationName}
							{...focusable}
							style={(state) => {
								const { pressed, hovered } = state as {
									pressed: boolean;
									hovered?: boolean;
								};
								return {
									flex: 1,
									flexDirection: "row",
									alignItems: "center",
									gap: spacing[3],
									paddingHorizontal: spacing[4],
									paddingVertical: spacing[3],
									minHeight: 64,
									backgroundColor:
										pressed || hovered
											? colors.background.subtle
											: "transparent",
								};
							}}
						>
							<View
								style={{
									width: 40,
									height: 40,
									borderRadius: 20,
									backgroundColor: colors.primary.tint,
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								<Label weight="bold" color={colors.primary.ink}>
									{item.organization.organizationName[0]?.toUpperCase()}
								</Label>
							</View>
							<View style={{ flex: 1, minWidth: 0 }}>
								<Body weight="medium" numberOfLines={1}>
									{item.organization.organizationName}
								</Body>
								<Caption color="tertiary" numberOfLines={1}>
									{[item.organization.city, item.organization.state]
										.filter(Boolean)
										.join(", ") || "Location not set"}
								</Caption>
							</View>
						</Pressable>
						<Pressable
							onPress={() => unfollow(item)}
							disabled={toggle.isPending}
							hitSlop={10}
							accessibilityRole="button"
							accessibilityLabel={`Unfollow ${item.organization.organizationName}`}
							accessibilityState={{ disabled: toggle.isPending }}
							{...focusable}
						>
							<Caption weight="medium" color="tertiary">
								Unfollow
							</Caption>
						</Pressable>
					</View>
				)}
			/>
		</Screen>
	);
}

export default withAppShell(Following);
