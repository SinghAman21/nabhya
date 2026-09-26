import { useRouter } from "expo-router";
import { Bookmark } from "lucide-react-native";
import { View } from "react-native";
import { withAppShell } from "@/components/app-shell";
import { PAGE_SIZE, PagedList, usePagedQuery } from "@/components/paged-list";
import { EmptyState, Screen, ScreenHeader } from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/overlay";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption, Label } from "@/components/ui/typography";
import { useToggleBookmark } from "@/hooks/use-engagement";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage, engagementApi, queryKeys } from "@/lib/api";
import { focusable } from "@/lib/focus";
import type { BookmarkListItem } from "@/lib/types";

/**
 * NGOs the volunteer has saved. One grouped list: tap a row to open the NGO,
 * "Remove" on the right to drop it. Paged, since a keen volunteer can save
 * more than one screen of them.
 */
function Bookmarks() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const toggle = useToggleBookmark();

	const { query, items, loadMore } = usePagedQuery({
		queryKey: queryKeys.bookmarks({ limit: PAGE_SIZE }),
		fetchPage: (page) =>
			engagementApi.listBookmarks({ page, limit: PAGE_SIZE }),
	});

	const remove = (item: BookmarkListItem) => {
		const name = item.organization.organizationName;
		toggle.mutate(item.organization.id, {
			// Undo rather than a confirmation: unsaving is one tap, reversible in
			// one tap, and a dialog in front of it would cost more than the
			// mistake does.
			onSuccess: () =>
				toast.success(`${name} removed.`, {
					label: "Undo",
					onPress: () => toggle.mutate(item.organization.id),
				}),
			onError: (error) => toast.error(apiErrorMessage(error)),
		});
	};

	return (
		<Screen>
			<ScreenHeader
				back
				title="Saved NGOs"
				subtitle="Find them again in one tap."
			/>

			<PagedList
				query={query}
				items={items}
				loadMore={loadMore}
				grouped
				keyExtractor={(item) => item.id}
				empty={
					<EmptyState
						icon={Bookmark}
						title="No saved NGOs yet"
						description="Tap the bookmark on any NGO's page and it will be kept here."
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
							onPress={() => remove(item)}
							disabled={toggle.isPending}
							hitSlop={10}
							accessibilityRole="button"
							accessibilityLabel={`Remove ${item.organization.organizationName} from saved`}
							accessibilityState={{ disabled: toggle.isPending }}
							{...focusable}
						>
							<Caption weight="medium" color="tertiary">
								Remove
							</Caption>
						</Pressable>
					</View>
				)}
			/>
		</Screen>
	);
}

export default withAppShell(Bookmarks);
