import type { CreateFeedPostInput, PostTag } from "@nabhya/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { ImagePlus, X } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Sheet, SheetOption } from "@/components/ui/sheet";
import { Caption, Label } from "@/components/ui/typography";
import { useOrgNeeds } from "@/hooks/use-needs";
import { useTheme } from "@/hooks/use-theme";
import { Alert } from "@/lib/alert";
import { apiErrorMessage, feedApi, queryScopes } from "@/lib/api";
import { composePostText } from "@/lib/post-text";
import type { OrgNeedListItem } from "@/lib/types";

const MAX_MEDIA = 4;
const MAX_TEXT = 5000;

const TAGS: { value: PostTag; label: string; hint: string }[] = [
	{ value: "POST", label: "#show", hint: "A general update" },
	{ value: "EVENT", label: "#event", hint: "An upcoming activity" },
	{ value: "NEED", label: "#need", hint: "A requirement or request" },
	{ value: "URGENT", label: "#urgency", hint: "Time-sensitive" },
];

export function PostComposerSheet({
	visible,
	onClose,
}: {
	visible: boolean;
	onClose: () => void;
}) {
	return (
		<Sheet
			visible={visible}
			onClose={onClose}
			title="Create post"
			subtitle="Share an update to the feed"
			footer={null}
		>
			<PostComposerBody onClose={onClose} />
		</Sheet>
	);
}

function PostComposerBody({ onClose }: { onClose: () => void }) {
	const { colors, spacing, borderRadius } = useTheme();
	const queryClient = useQueryClient();
	const [tag, setTag] = useState<PostTag>("POST");
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [media, setMedia] = useState<ImagePicker.ImagePickerAsset[]>([]);
	const [selectedNeed, setSelectedNeed] = useState<OrgNeedListItem | null>(
		null,
	);

	const myNeeds = useOrgNeeds({ limit: 6 });
	const needs = myNeeds.data?.items ?? [];

	const publish = useMutation({
		mutationFn: async () => {
			const input: CreateFeedPostInput = {
				text: composePostText(title, description),
				tag,
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
						if (!response.ok) {
							throw new Error("A photo failed to upload. Please try again.");
						}
					}),
				);
				input.mediaFolder = uploads.mediaFolder;
				input.mediaKeys = uploads.tickets.map((ticket) => ticket.key);
			}

			return feedApi.create(input);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.feed });
			onClose();
			Alert.alert("Posted", "Your update is now visible in the feed.");
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
		if (!result.canceled) {
			setMedia((current) => [...current, ...result.assets].slice(0, MAX_MEDIA));
		}
	};

	const remaining = MAX_TEXT - description.length - title.length;
	const canPost = description.trim().length > 0 && remaining >= 0;
	const tagLabel = TAGS.find((item) => item.value === tag)?.label ?? "#show";

	const pickTag = (next: PostTag) => {
		setTag(next);
		if (next !== "NEED") setSelectedNeed(null);
		if (next === "NEED" && selectedNeed) {
			setTitle(selectedNeed.title);
			setDescription(selectedNeed.description);
		}
	};

	const applyNeed = (need: OrgNeedListItem) => {
		setSelectedNeed(need);
		setTag("NEED");
		setTitle(need.title);
		setDescription(need.description);
	};

	return (
		<View style={{ gap: spacing[4], paddingBottom: spacing[2] }}>
			<View style={{ gap: spacing[2] }}>
				<Label weight="medium">Type</Label>
				<View style={{ gap: spacing[2] }}>
					{TAGS.map((item) => (
						<SheetOption
							key={item.value}
							label={item.label}
							hint={item.hint}
							selected={tag === item.value}
							onPress={() => pickTag(item.value)}
						/>
					))}
				</View>
			</View>

			<View style={{ gap: spacing[1.5] }}>
				<Label>
					Title <Caption color="tertiary">(optional)</Caption>
				</Label>
				<Input
					placeholder="Give it a short headline"
					value={title}
					onChangeText={setTitle}
					maxLength={120}
					style={{
						borderWidth: 0,
						borderRadius: borderRadius.md,
						backgroundColor: colors.background.subtle,
					}}
				/>
			</View>

			<View style={{ gap: spacing[1.5] }}>
				<Label>Description</Label>
				<Input
					placeholder="What are you working on?"
					value={description}
					onChangeText={setDescription}
					multiline
					style={{
						minHeight: 140,
						textAlignVertical: "top",
						borderWidth: 0,
						borderRadius: borderRadius.md,
						backgroundColor: colors.background.subtle,
					}}
				/>
			</View>

			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					paddingTop: spacing[2],
					borderTopWidth: 1,
					borderTopColor: colors.border.hairline,
				}}
			>
				<Pressable
					onPress={selectMedia}
					disabled={media.length >= MAX_MEDIA}
					accessibilityRole="button"
					accessibilityLabel="Add media"
					hitSlop={8}
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
							: "Add media"}
					</Label>
				</Pressable>
				<Caption color={remaining < 200 ? colors.error.ink : "quaternary"}>
					{remaining < 200 ? remaining : tagLabel}
				</Caption>
			</View>

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
								accessibilityLabel="Remove media"
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

			{tag === "NEED" && (
				<View style={{ gap: spacing[2] }}>
					<Label>Select one of your needs</Label>
					{needs.length > 0 ? (
						<View style={{ gap: spacing[1.5] }}>
							{needs.map((need) => (
								<SheetOption
									key={need.id}
									label={need.title}
									hint={need.status}
									selected={selectedNeed?.id === need.id}
									onPress={() => applyNeed(need)}
								/>
							))}
						</View>
					) : myNeeds.isLoading ? (
						<Caption color="quaternary">Loading your needs…</Caption>
					) : (
						<Caption color="quaternary">
							No needs found on your account yet.
						</Caption>
					)}
				</View>
			)}

			<Caption color="quaternary">
				Posts appear in the feed with your NGO&apos;s name. Keep it concrete:
				numbers, places, people.
			</Caption>

			<Button
				onPress={() => publish.mutate()}
				loading={publish.isPending}
				disabled={!canPost}
			>
				Post
			</Button>
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
