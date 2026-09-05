import type { CreateFeedPostInput } from "@nabhya/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { ImagePlus, X } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Screen, ScreenHeader, Surface } from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Caption, Label } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { Alert } from "@/lib/alert";
import { apiErrorMessage, feedApi, queryScopes } from "@/lib/api";

const MAX_MEDIA = 4;
const MAX_TEXT = 5000;

/**
 * Compose a post for the feed.
 *
 * Text first, photos second: a field big enough to think in, then a strip of
 * thumbnails with a remove target on each. Media goes straight to storage
 * with the signed tickets the server hands out (plain `fetch`, never the axios
 * instance — an Authorization header would break the signature), and only the
 * returned keys are submitted. On success the screen closes and every feed
 * query refreshes, so the post is the first thing the author sees.
 */
export default function ComposePost() {
	const { colors, spacing, borderRadius } = useTheme();
	const router = useRouter();
	const queryClient = useQueryClient();
	const [text, setText] = useState("");
	const [media, setMedia] = useState<ImagePicker.ImagePickerAsset[]>([]);

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
							throw new Error("A photo failed to upload. Please try again.");
					}),
				);
				input.mediaFolder = uploads.mediaFolder;
				input.mediaKeys = uploads.tickets.map((ticket) => ticket.key);
			}
			return feedApi.create(input);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.feed });
			if (router.canGoBack()) router.back();
			else router.replace("/");
		},
		onError: (error) =>
			Alert.alert("Could not publish", apiErrorMessage(error)),
	});

	const selectMedia = async () => {
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ["images", "videos"],
			allowsMultipleSelection: true,
			selectionLimit: MAX_MEDIA - media.length,
			orderedSelection: true,
			quality: 0.85,
		});
		if (!result.canceled)
			setMedia((current) => [...current, ...result.assets].slice(0, MAX_MEDIA));
	};

	const remaining = MAX_TEXT - text.length;
	const canPost = text.trim().length > 0 && remaining >= 0;

	return (
		<Screen>
			<ScreenHeader
				back
				title="Share an update"
				action={
					<Button
						size="sm"
						onPress={() => publish.mutate()}
						disabled={!canPost}
						loading={publish.isPending}
					>
						Post
					</Button>
				}
			/>
			<ScrollView
				keyboardShouldPersistTaps="handled"
				automaticallyAdjustKeyboardInsets
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ paddingBottom: spacing[12], gap: spacing[4] }}
			>
				<Surface>
					<Input
						value={text}
						onChangeText={setText}
						placeholder="What happened, who it helped, what's next…"
						multiline
						autoFocus
						maxLength={MAX_TEXT + 200}
						accessibilityLabel="Post text"
						style={{
							borderWidth: 0,
							padding: 0,
							backgroundColor: "transparent",
							minHeight: 160,
							textAlignVertical: "top",
							fontSize: 17,
							lineHeight: 24,
						}}
					/>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							justifyContent: "space-between",
							marginTop: spacing[3],
							paddingTop: spacing[3],
							borderTopWidth: 1,
							borderTopColor: colors.border.hairline,
						}}
					>
						<Pressable
							onPress={selectMedia}
							disabled={media.length >= MAX_MEDIA}
							accessibilityRole="button"
							accessibilityLabel="Add photos"
							hitSlop={6}
							style={({ pressed }) => ({
								flexDirection: "row",
								alignItems: "center",
								gap: spacing[2],
								opacity: media.length >= MAX_MEDIA ? 0.4 : pressed ? 0.6 : 1,
							})}
						>
							<ImagePlus size={18} color={colors.primary.ink as string} />
							<Label weight="medium" color={colors.primary.ink}>
								{media.length
									? `${media.length} of ${MAX_MEDIA} added`
									: "Add photos"}
							</Label>
						</Pressable>
						<Caption color={remaining < 0 ? colors.error.ink : "quaternary"}>
							{remaining < 200 ? remaining : ""}
						</Caption>
					</View>
				</Surface>

				{media.length > 0 && (
					<View
						style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}
					>
						{media.map((asset, index) => (
							<View
								key={asset.assetId ?? asset.uri}
								style={{ position: "relative" }}
							>
								<Image
									source={{ uri: asset.uri }}
									contentFit="cover"
									accessibilityIgnoresInvertColors
									style={{
										width: 96,
										height: 96,
										borderRadius: borderRadius.md,
										backgroundColor: colors.background.subtle,
									}}
								/>
								<Pressable
									onPress={() =>
										setMedia((current) => current.filter((_, i) => i !== index))
									}
									accessibilityRole="button"
									accessibilityLabel="Remove photo"
									hitSlop={6}
									style={{
										position: "absolute",
										top: 4,
										right: 4,
										width: 24,
										height: 24,
										borderRadius: 12,
										alignItems: "center",
										justifyContent: "center",
										backgroundColor: "rgba(17,17,17,0.7)",
									}}
								>
									<X size={13} color="#FFFFFF" strokeWidth={2.5} />
								</Pressable>
							</View>
						))}
					</View>
				)}

				<Caption color="quaternary">
					Posts appear in every volunteer's feed with your NGO's name. Keep it
					concrete: numbers, places, people.
				</Caption>
			</ScrollView>
		</Screen>
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
