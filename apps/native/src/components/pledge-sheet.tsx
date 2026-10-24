import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/overlay";
import { Sheet } from "@/components/ui/sheet";
import { Body, Caption, Label } from "@/components/ui/typography";
import { useVerifyIdentitySheet } from "@/components/verification/verify-identity-sheet";
import {
	useIdentityGate,
	VerificationNote,
} from "@/components/verification-note";
import { useCreatePledge } from "@/hooks/use-needs";
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
	const need = listItem;
	// Owned here, outside the pledge sheet, so the gate can close the pledge and
	// open verification in its place - one modal at a time.
	const verify = useVerifyIdentitySheet();

	return (
		<>
			{need ? (
				<PledgeSheetContent
					key={need.id}
					need={need}
					onClose={onClose}
					onVerify={verify.open}
				/>
			) : null}
			{verify.sheet}
		</>
	);
}

function PledgeSheetContent({
	need,
	onClose,
	onVerify,
}: {
	need: PublicNeed;
	onClose: () => void;
	onVerify: () => void;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	const [quantity, setQuantity] = useState("");
	const [message, setMessage] = useState("");
	const [error, setError] = useState<string | null>(null);
	const pledge = useCreatePledge(need.id);
	const router = useRouter();
	const gate = useIdentityGate();

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
					// Where to watch for the answer, not just that it went: the NGO's
					// decision arrives as an Activity row, and nothing else says so.
					toast.success(
						isWant
							? "Offer sent. You'll see the NGO's answer in Activity."
							: "Request sent. You'll see the NGO's answer in Activity.",
						{
							label: "View",
							onPress: () => router.push("/(volunteer)/activity"),
						},
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
				<Button
					onPress={submit}
					loading={pledge.isPending}
					disabled={gate.blocked}
				>
					{isWant ? "Send offer" : "Request this"}
				</Button>
			}
		>
			<VerificationNote onNavigate={onClose} onVerify={onVerify} />
			<View
				style={{
					padding: spacing[3.5],
					borderRadius: borderRadius.md,
					backgroundColor: colors.background.subtle,
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
						// "Up to 4", not "4": a bare number in the box read as a value
						// already filled in, and sending it empty then failed.
						placeholder={remaining ? `Up to ${remaining}` : "e.g. 10"}
						accessibilityLabel={`How many ${need.unit ?? "items"}`}
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
					// Needs are people as often as things ("4 tutors"), so the prompt
					// cannot assume items to drop off.
					isWant
						? "When you can help, and anything the NGO should know…"
						: "How you'll use these, when you can collect…"
				}
				accessibilityLabel="Message to the NGO"
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
