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
import { useTheme } from "@/hooks/useTheme";
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
			const input: CreateFeedPostInput = { text: text.trim(), mediaKeys: [] };
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
		},
		onError: (error) =>
			Alert.alert("Could not publish", apiErrorMessage(error)),
	});

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
	);
}

function mediaContentType(asset: ImagePicker.ImagePickerAsset) {
	if (asset.mimeType === "video/mp4" || asset.mimeType === "video/quicktime") {
		return asset.mimeType;
	}
	return asset.mimeType === "image/png" || asset.mimeType === "image/webp"
		? asset.mimeType
		: "image/jpeg";
}
