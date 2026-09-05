import { X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Body, Caption, H2, Label } from "@/components/ui/typography";
import { useCreatePledge, usePublicNeed } from "@/hooks/use-needs";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import { formatProgress } from "@/lib/format";
import type { PublicNeed } from "@/lib/types";

/**
 * Collects a volunteer's response to a need.
 *
 * Quantity matters: the organisation's `fulfilledQuantity` advances by the
 * pledged amount when they accept, so a quantified need cannot make progress
 * without it. The server rejects a missing quantity in that case, and this
 * mirrors the rule inline.
 */
export function PledgeSheet({
	need: listItem,
	onClose,
}: {
	need: PublicNeed | null;
	onClose: () => void;
}) {
	const { colors, spacing } = useTheme();
	const [quantity, setQuantity] = useState("");
	const [message, setMessage] = useState("");
	const [error, setError] = useState<string | null>(null);

	// The row that opened this sheet may have been loaded minutes ago, and
	// `fulfilledQuantity` moves as other people pledge. Re-reading the need
	// keeps "only N still needed" honest instead of validating against a stale
	// number the server will then reject.
	const fresh = usePublicNeed(listItem?.id);
	const need = fresh.data ?? listItem;

	const pledge = useCreatePledge(need?.id ?? "");

	// Reset between different needs so one post's draft never leaks into another.
	useEffect(() => {
		if (listItem) {
			setQuantity("");
			setMessage("");
			setError(null);
		}
	}, [listItem]);

	if (!need) return null;

	const isWant = need.type === "WANT";
	const remaining =
		need.quantity !== null
			? Math.max(need.quantity - need.fulfilledQuantity, 0)
			: null;

	const inputStyle = {
		borderWidth: 0,
		borderRadius: 12,
		backgroundColor: colors.background.tertiary,
		paddingVertical: spacing[3.5],
	} as const;

	const submit = () => {
		const parsed = quantity ? Number(quantity) : undefined;

		if (need.quantity !== null && !parsed) {
			setError(`Enter how many ${need.unit ?? "items"} you can provide.`);
			return;
		}
		if (parsed !== undefined && remaining !== null && parsed > remaining) {
			setError(`Only ${remaining} ${need.unit ?? "items"} still needed.`);
			return;
		}

		setError(null);
		pledge.mutate(
			{ quantity: parsed, message: message.trim() || undefined },
			{
				onSuccess: () => {
					onClose();
					Alert.alert(
						"Thank you",
						isWant
							? "The organisation will review your offer and get in touch."
							: "The organisation will confirm and arrange handover.",
					);
				},
				onError: (e) => setError(apiErrorMessage(e)),
			},
		);
	};

	// Visibility tracks the caller's selection rather than `need`: a cached
	// detail response must not keep the sheet open after it is dismissed.
	return (
		<Modal
			visible={!!listItem}
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
						<H2 numberOfLines={2}>{isWant ? "Offer to help" : "Claim this"}</H2>
						<Caption color="tertiary" numberOfLines={1}>
							{need.organization.organizationName}
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
					<Body weight="bold" style={{ marginBottom: spacing[1] }}>
						{need.title}
					</Body>
					<Caption color="tertiary" style={{ marginBottom: spacing[5] }}>
						{formatProgress(need.fulfilledQuantity, need.quantity, need.unit)}
						{remaining !== null ? ` · ${remaining} still needed` : ""}
					</Caption>

					{need.quantity !== null && (
						<>
							<Label style={{ marginBottom: spacing[1.5] }}>
								How many {need.unit ?? "items"}?
							</Label>
							<Input
								placeholder={remaining ? String(remaining) : "e.g. 10"}
								value={quantity}
								onChangeText={(v) => setQuantity(v.replace(/\D/g, ""))}
								keyboardType="number-pad"
								style={[inputStyle, { maxWidth: 160 }]}
							/>
						</>
					)}

					<Label
						style={{
							marginTop: need.quantity !== null ? spacing[5] : 0,
							marginBottom: spacing[1.5],
						}}
					>
						Message <Caption color="tertiary">(optional)</Caption>
					</Label>
					<Input
						placeholder={
							isWant
								? "Condition of the items, when you can drop them off…"
								: "How you'll use these, when you can collect…"
						}
						value={message}
						onChangeText={setMessage}
						multiline
						style={{ ...inputStyle, minHeight: 96, textAlignVertical: "top" }}
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
						loading={pledge.isPending}
						style={{ marginTop: spacing[6] }}
					>
						{isWant ? "Send offer" : "Request this"}
					</Button>
				</ScrollView>
			</View>
		</Modal>
	);
}
