import { Star } from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/overlay";
import { Pressable } from "@/components/ui/pressable";
import { Sheet } from "@/components/ui/sheet";
import { Caption, Label } from "@/components/ui/typography";
import { useUpsertReview } from "@/hooks/use-engagement";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import type { ReviewItem } from "@/lib/types";

/**
 * Write or edit a review.
 *
 * The API upserts, so submitting twice edits rather than duplicating - one
 * review per person per organization is enforced by a unique index.
 */
export function ReviewSheet({
	organizationId,
	organizationName,
	existingReview,
	visible,
	onClose,
}: {
	organizationId: string;
	organizationName: string;
	existingReview?: Pick<ReviewItem, "id" | "rating" | "body"> | null;
	visible: boolean;
	onClose: () => void;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	// No rating until one is picked: a pre-filled five stars posted a score
	// the reviewer never chose.
	const [rating, setRating] = useState(existingReview?.rating ?? 0);
	const [body, setBody] = useState(existingReview?.body ?? "");
	const [error, setError] = useState<string | null>(null);

	const upsert = useUpsertReview(organizationId);
	const editing = !!existingReview;

	useEffect(() => {
		if (!visible) return;
		setRating(existingReview?.rating ?? 0);
		setBody(existingReview?.body ?? "");
		setError(null);
	}, [visible, existingReview?.rating, existingReview?.body]);

	const submit = () => {
		setError(null);
		upsert.mutate(
			{ rating, body: body.trim() || undefined },
			{
				onSuccess: () => {
					onClose();
					toast.success(
						editing
							? "Your review has been updated."
							: "Your review has been posted.",
					);
				},
				onError: (e) => setError(apiErrorMessage(e)),
			},
		);
	};

	return (
		<Sheet
			visible={visible}
			onClose={onClose}
			title={editing ? "Edit your review" : "Write a review"}
			subtitle={organizationName}
			footer={
				<Button
					onPress={submit}
					loading={upsert.isPending}
					disabled={rating === 0}
				>
					{editing ? "Save changes" : "Post review"}
				</Button>
			}
		>
			<Label style={{ marginBottom: spacing[2] }}>Rating</Label>
			{/* Plain stars, not five amber tiles: a filled block per star was
			    the loudest thing in the sheet. */}
			<View
				style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}
				accessibilityRole="radiogroup"
			>
				{[1, 2, 3, 4, 5].map((value) => {
					const on = value <= rating;
					return (
						<Pressable
							key={value}
							onPress={() => setRating(value)}
							hitSlop={4}
							accessibilityRole="radio"
							accessibilityLabel={`${value} star${value === 1 ? "" : "s"}`}
							accessibilityState={{ checked: value === rating }}
							style={({ pressed }) => ({
								width: 44,
								height: 44,
								borderRadius: borderRadius.md,
								alignItems: "center",
								justifyContent: "center",
								backgroundColor: pressed
									? colors.background.tertiary
									: "transparent",
							})}
						>
							<Star
								size={28}
								strokeWidth={1.75}
								color={
									(on ? colors.warning.ink : colors.text.quaternary) as string
								}
								fill={on ? (colors.warning.ink as string) : "transparent"}
							/>
						</Pressable>
					);
				})}
				<Caption color="tertiary" style={{ marginLeft: spacing[2] }}>
					{rating === 0 ? "Tap a star" : `${rating} of 5`}
				</Caption>
			</View>

			<Label style={{ marginTop: spacing[5], marginBottom: spacing[1.5] }}>
				Your experience <Caption color="tertiary">(optional)</Caption>
			</Label>
			<Input
				placeholder="What was it like volunteering with them?"
				value={body}
				onChangeText={setBody}
				multiline
				style={{
					borderWidth: 0,
					borderRadius: borderRadius.md,
					backgroundColor: colors.background.tertiary,
					paddingVertical: spacing[3.5],
					minHeight: 120,
					textAlignVertical: "top",
				}}
			/>

			{error ? (
				<Caption
					color={colors.error.ink as string}
					style={{ marginTop: spacing[3] }}
				>
					{error}
				</Caption>
			) : null}
		</Sheet>
	);
}
