import { X } from "lucide-react-native";
import { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Body, Caption, H2, Label } from "@/components/ui/typography";
import { useUpsertReview } from "@/hooks/use-engagement";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";

/**
 * Write or edit a review.
 *
 * The API upserts, so submitting twice edits rather than duplicating — one
 * review per person per organization is enforced by a unique index.
 */
export function ReviewSheet({
	organizationId,
	organizationName,
	visible,
	onClose,
}: {
	organizationId: string;
	organizationName: string;
	visible: boolean;
	onClose: () => void;
}) {
	const { colors, spacing } = useTheme();
	const [rating, setRating] = useState(5);
	const [body, setBody] = useState("");
	const [error, setError] = useState<string | null>(null);

	const upsert = useUpsertReview(organizationId);

	const submit = () => {
		setError(null);
		upsert.mutate(
			{ rating, body: body.trim() || undefined },
			{
				onSuccess: () => {
					setBody("");
					onClose();
					Alert.alert("Thanks", "Your review has been posted.");
				},
				onError: (e) => setError(apiErrorMessage(e)),
			},
		);
	};

	return (
		<Modal
			visible={visible}
			animationType="slide"
			presentationStyle="pageSheet"
			onRequestClose={onClose}
		>
			<View style={{ flex: 1, backgroundColor: colors.background.warm }}>
				<View
					style={{
						flexDirection: "row",
						alignItems: "flex-start",
						justifyContent: "space-between",
						gap: spacing[3],
						paddingHorizontal: spacing[6],
						paddingTop: spacing[6],
						paddingBottom: spacing[2],
					}}
				>
					<View style={{ flex: 1 }}>
						<H2>Write a review</H2>
						<Caption color="tertiary" numberOfLines={1}>
							{organizationName}
						</Caption>
					</View>
					<Pressable onPress={onClose} hitSlop={12}>
						<X size={22} color={colors.text.tertiary as string} />
					</Pressable>
				</View>

				<ScrollView
					contentContainerStyle={{
						padding: spacing[6],
						paddingTop: spacing[4],
					}}
					keyboardShouldPersistTaps="handled"
				>
					<Label style={{ marginBottom: spacing[2] }}>Rating</Label>
					<View style={{ flexDirection: "row", gap: spacing[2] }}>
						{[1, 2, 3, 4, 5].map((value) => (
							<Pressable
								key={value}
								onPress={() => setRating(value)}
								hitSlop={6}
								style={{
									width: 48,
									height: 48,
									borderRadius: 12,
									alignItems: "center",
									justifyContent: "center",
									backgroundColor:
										value <= rating
											? colors.warning.main
											: colors.background.tertiary,
								}}
							>
								<Body
									weight="bold"
									color={
										value <= rating
											? (colors.neutral.white as string)
											: "quaternary"
									}
								>
									★
								</Body>
							</Pressable>
						))}
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
							borderRadius: 12,
							backgroundColor: colors.background.tertiary,
							paddingVertical: spacing[3.5],
							minHeight: 120,
							textAlignVertical: "top",
						}}
					/>

					{error && (
						<Caption
							color={colors.error.main as string}
							style={{ marginTop: spacing[3] }}
						>
							{error}
						</Caption>
					)}

					<Button
						onPress={submit}
						loading={upsert.isPending}
						style={{ marginTop: spacing[6] }}
					>
						Post review
					</Button>
				</ScrollView>
			</View>
		</Modal>
	);
}
