import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { Body, Caption, Label } from "@/components/ui/typography";
import { useCreatePledge } from "@/hooks/use-needs";
import { useTheme } from "@/hooks/use-theme";
import { Alert } from "@/lib/alert";
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
	const need = listItem;

	if (!need) return null;

	return <PledgeSheetContent key={need.id} need={need} onClose={onClose} />;
}

function PledgeSheetContent({
	need,
	onClose,
}: {
	need: PublicNeed;
	onClose: () => void;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	const [quantity, setQuantity] = useState("");
	const [message, setMessage] = useState("");
	const [error, setError] = useState<string | null>(null);
	const pledge = useCreatePledge(need.id);

	const isWant = need.type === "WANT";
	const remaining =
		need.quantity !== null
			? Math.max(need.quantity - need.fulfilledQuantity, 0)
			: null;

	const inputStyle = {
		borderWidth: 0,
		borderRadius: borderRadius.md,
		backgroundColor: colors.background.subtle,
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

	return (
		<Sheet
			visible={!!need}
			onClose={onClose}
			title={isWant ? "Offer to help" : "Claim this"}
			subtitle={need.organization.organizationName}
			footer={
				<Button onPress={submit} loading={pledge.isPending}>
					{isWant ? "Send offer" : "Request this"}
				</Button>
			}
		>
			<View
				style={{
					padding: spacing[3.5],
					borderRadius: borderRadius.md,
					backgroundColor: colors.background.warm,
					marginBottom: spacing[5],
				}}
			>
				<Body weight="bold" numberOfLines={2}>
					{need.title}
				</Body>
				<Caption color="tertiary" style={{ marginTop: spacing[0.5] }}>
					{formatProgress(need.fulfilledQuantity, need.quantity, need.unit)}
					{remaining !== null ? ` · ${remaining} still needed` : ""}
				</Caption>
			</View>

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
					color={colors.error.ink as string}
					style={{ marginTop: spacing[3] }}
				>
					{error}
				</Caption>
			)}
		</Sheet>
	);
}
