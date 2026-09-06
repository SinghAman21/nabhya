import type { CreateFeedPostInput } from "@nabhya/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { ImagePlus } from "lucide-react-native";
import { useState } from "react";
import { Alert, FlatList, Pressable, TextInput, View } from "react-native";
import {
	EmptyState,
	LoadingState,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { Body, Caption } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage, feedApi, queryKeys } from "@/lib/api";

interface FeedPost {
	id: string;
	text: string;
	createdAt: string;
	author: { id: string; fullName: string | null };
	media: Array<{ id: string; type: "IMAGE" | "VIDEO"; url: string }>;
}

export default function FeedScreen() {
	const { colors, spacing, borderRadius } = useTheme();
	const [text, setText] = useState("");
	const [media, setMedia] = useState<ImagePicker.ImagePickerAsset[]>([]);
	const feed = useQuery({
		queryKey: queryKeys.feed(),
		queryFn: () => feedApi.list({}) as Promise<{ items: FeedPost[] }>,
	});
	const publish = useMutation({
		mutationFn: async () => {
			const input: CreateFeedPostInput = {
				text: text.trim(),
				tag: "POST",
				mediaKeys: [],
			};
			if (media.length > 0) {
				const uploads = await feedApi.createMediaIntents({
					files: media.map((asset) => ({
						fileName: asset.fileName ?? `media-${Date.now()}`,
						contentType: mediaContentType(asset),
						size: asset.fileSize ?? 1,
					})),
				});
				await Promise.all(
					uploads.tickets.map(async (ticket, index) => {
						const body = await (await fetch(media[index]?.uri ?? "")).blob();
						const response = await fetch(ticket.url, {
							method: "PUT",
							headers: ticket.headers,
							body,
						});
						if (!response.ok)
							throw new Error("Media upload failed. Please try again.");
					}),
				);
				input.mediaFolder = uploads.mediaFolder;
				input.mediaKeys = uploads.tickets.map((ticket) => ticket.key);
			}
			return feedApi.create(input);
		},
		onSuccess: () => {
			setText("");
			setMedia([]);
			feed.refetch();
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import {
	ActivityIndicator,
	FlatList,
	RefreshControl,
	View,
} from "react-native";
import { FeedCard } from "@/components/feed/feed-card";
import {
	ALL_CAUSES,
	FeedFilterSheet,
	FeedTabs,
} from "@/components/feed/feed-filters";
import {
	EmptyState,
	ErrorState,
	LoadingState,
	Screen,
	ScreenHeader,
} from "@/components/screen-shell";
import { useToggleFollow } from "@/hooks/use-engagement";
import { useFeed, useFeedReaction } from "@/hooks/use-feed";
import { useCategories } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import type { FeedItem, FeedNeedItem } from "@/lib/types";
import { useAuthStore } from "@/store/auth-store";

/**
 * NGO feed — the shared ranking feed with all content kinds and tab lenses.
 *
 * For you / Trending / Following show all tags; Urgent narrows to urgent items.
 */
export default function NgoFeed() {
	const role = useAuthStore((s) => s.role);
	const isOrg = role === "organisation";
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const categories = useCategories();
	const toggleFollow = useToggleFollow();
	const like = useFeedReaction("like");
	const save = useFeedReaction("save");
	const [tab, setTab] = useState<
		"for_you" | "following" | "trending" | "urgent"
	>("for_you");
	const [categoryId, setCategoryId] = useState<string>(ALL_CAUSES);
	const [filtersOpen, setFiltersOpen] = useState(false);

	const feed = useFeed(
		{
			tab,
			...(categoryId === ALL_CAUSES ? {} : { categoryId }),
		},
		isOrg,
	);

	const selectMedia = async () => {
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ["images", "videos"],
			allowsMultipleSelection: true,
			selectionLimit: 4,
			orderedSelection: true,
		});
		if (!result.canceled) setMedia(result.assets.slice(0, 4));
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
			<ScreenHeader
				title="Community feed"
				subtitle="Updates from volunteers and NGOs across Nabhya."
			/>
			<Surface style={{ marginBottom: spacing[4], gap: spacing[3] }}>
				<TextInput
					value={text}
					onChangeText={setText}
					placeholder="Share an update…"
					placeholderTextColor={colors.text.tertiary as string}
					multiline
					style={{
						minHeight: 90,
						color: colors.text.primary as string,
						textAlignVertical: "top",
					}}
				/>
				<Pressable
					onPress={selectMedia}
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[2],
					}}
				>
					<ImagePlus size={18} color={colors.primary.main as string} />
					<Caption color="secondary">
						{media.length
							? `${media.length} of 4 media selected`
							: "Add up to 4 photos or videos"}
					</Caption>
				</Pressable>
				<Button
					disabled={!text.trim()}
					loading={publish.isPending}
					onPress={() => publish.mutate()}
				>
					Post update
				</Button>
			</Surface>
			{feed.isLoading ? (
				<LoadingState />
			) : (
				<FlatList
					data={feed.data?.items ?? []}
					keyExtractor={(item) => item.id}
					renderItem={({ item }) => (
						<Surface
							style={{
								marginBottom: spacing[3],
								borderRadius: borderRadius.lg,
							}}
						>
							<Body weight="bold">
								{item.author.fullName ?? "Nabhya member"}
							</Body>
							<Body style={{ marginTop: spacing[2] }}>{item.text}</Body>
							<Caption color="tertiary" style={{ marginTop: spacing[2] }}>
								{item.media.length
									? `${item.media.length} media item(s)`
									: "Text update"}
							</Caption>
						</Surface>
					)}
					ListEmptyComponent={
						<EmptyState
							title="No posts yet"
							description="Be the first to share an update."
						/>
					}
				/>
			)}
		</View>
	const items = feed.data?.pages.flatMap((page) => page.items) ?? [];

	if (!isOrg) return <Redirect href="/" />;

	const loadMore = () => {
		if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
	};

	const header = (
		<View>
			<ScreenHeader title="Feed" />
			<FeedTabs
				tab={tab}
				onTab={setTab}
				gutter={spacing[5]}
				onOpenFilters={() => setFiltersOpen(true)}
				filterActive={categoryId !== ALL_CAUSES}
			/>
		</View>
	);

	const footer = feed.isLoading ? (
		<LoadingState label="Building the feed" />
	) : feed.isError ? (
		<ErrorState
			message={apiErrorMessage(feed.error)}
			onRetry={() => feed.refetch()}
		/>
	) : items.length === 0 ? (
		<EmptyState
			title="Nothing here yet"
			description="Try another tab or remove the cause filter."
		/>
	) : feed.isFetchingNextPage ? (
		<View style={{ paddingVertical: spacing[6], alignItems: "center" }}>
			<ActivityIndicator color={colors.text.quaternary as string} />
		</View>
	) : feed.hasNextPage ? null : (
		<View style={{ paddingVertical: spacing[8], alignItems: "center" }}>
			<EmptyState
				title="You're all caught up"
				description="Refresh anytime for new posts."
			/>
		</View>
	);

	return (
		<Screen>
			{header}
			<FlatList
				data={items}
				keyExtractor={(item: FeedItem) => `${item.kind}:${item.id}`}
				renderItem={({ item }) => (
					<FeedCard
						item={item}
						onRespond={(need: FeedNeedItem) => {
							if (need.organization?.id) {
								router.push({
									pathname: "/ngos/[id]",
									params: { id: need.organization.id },
								});
							}
						}}
						onToggleFollow={(organizationId, following) =>
							toggleFollow.mutate({ organizationId, following })
						}
						onToggleLike={(row, liked) =>
							like.mutate({ item: row, on: !liked })
						}
						onToggleSave={(row, saved) =>
							save.mutate({ item: row, on: !saved })
						}
					/>
				)}
				ListFooterComponent={footer}
				ItemSeparatorComponent={() => <View style={{ height: spacing[3] }} />}
				onEndReached={loadMore}
				onEndReachedThreshold={0.6}
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{
					paddingHorizontal: spacing[5],
					paddingTop: spacing[4],
					paddingBottom: spacing[12],
				}}
				refreshControl={
					<RefreshControl
						refreshing={feed.isRefetching && !feed.isFetchingNextPage}
						onRefresh={() => feed.refetch()}
						tintColor={colors.text.quaternary as string}
					/>
				}
			/>

			<FeedFilterSheet
				visible={filtersOpen}
				onClose={() => setFiltersOpen(false)}
				categories={categories.data ?? []}
				categoryId={categoryId}
				onCategory={setCategoryId}
			/>
		</Screen>
	);
}
