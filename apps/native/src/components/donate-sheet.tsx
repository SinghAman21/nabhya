import { DONATION_PRESETS_MINOR, formatMinor } from "@nabhya/shared";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react-native";
import { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, View } from "react-native";
import RazorpayCheckout from "react-native-razorpay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Body, Caption, H2, Label } from "@/components/ui/typography";
import { useCreateDonation } from "@/hooks/use-engagement";
import { useMe } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import { queryScopes } from "@/lib/api/query-keys";
import { useAuthStore } from "@/store/auth-store";

/**
 * Donation entry point.
 *
 * The amount is captured in rupees but sent as paise — integers only, so no
 * float rounding ever reaches the ledger.
 *
 * Checkout happens in-app via Razorpay's native SDK: the server creates an
 * order and hands back its id plus the public key, and this sheet opens
 * Razorpay's own checkout UI directly — nothing here ever touches card
 * details. A successful checkout only tells the client the payment went
 * through; the donation row itself only ever flips to COMPLETED once the
 * server's webhook verifies it, so this sheet never assumes success beyond
 * showing a "confirming" message and letting the donor check their history.
 */
export function DonateSheet({
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
	const email = useAuthStore((s) => s.email);
	const { data: me } = useMe(!!email);
	const queryClient = useQueryClient();

	const [amountMinor, setAmountMinor] = useState<number>(
		DONATION_PRESETS_MINOR[1] ?? 100_000,
	);
	const [custom, setCustom] = useState("");
	const [message, setMessage] = useState("");
	const [isAnonymous, setAnonymous] = useState(false);
	const [guestName, setGuestName] = useState("");
	const [guestEmail, setGuestEmail] = useState("");
	const [error, setError] = useState<string | null>(null);

	const donate = useCreateDonation();

	const inputStyle = {
		borderWidth: 0,
		borderRadius: 12,
		backgroundColor: colors.background.tertiary,
		paddingVertical: spacing[3.5],
	} as const;

	const submit = () => {
		setError(null);

		if (!me && !guestEmail.trim()) {
			setError("Enter an email so we can send your receipt.");
			return;
		}

		donate.mutate(
			{
				organizationId,
				amountMinor,
				message: message.trim() || undefined,
				isAnonymous,
				donorName: me ? undefined : guestName.trim() || undefined,
				donorEmail: me ? undefined : guestEmail.trim() || undefined,
			},
			{
				onSuccess: async ({
					orderId,
					amountMinor: orderAmount,
					currency,
					razorpayKeyId,
				}) => {
					onClose();
					try {
						// Fields present because we always pass order_id: razorpay_payment_id,
						// razorpay_order_id, razorpay_signature. This is fast client-side
						// feedback only — never proof the donation is COMPLETED.
						await RazorpayCheckout.open({
							key: razorpayKeyId,
							order_id: orderId,
							amount: orderAmount,
							currency,
							name: organizationName,
							description: "Donation",
							prefill: {
								email: me?.email ?? (guestEmail.trim() || undefined),
								name: me?.name ?? (guestName.trim() || undefined),
							},
							theme: { color: colors.primary.main as string },
						});
						queryClient.invalidateQueries({ queryKey: queryScopes.donations });
						Alert.alert(
							"Thank you!",
							"We're confirming your donation now — check My Donations shortly.",
						);
					} catch (err: unknown) {
						// User-cancelled checkouts land here too (react-native-razorpay
						// rejects on dismiss, not just on failure) — there is no distinct
						// "cancelled" code documented, so this message stays generic.
						const description =
							typeof err === "object" && err !== null && "description" in err
								? String((err as { description?: unknown }).description)
								: null;
						Alert.alert(
							"Payment not completed",
							description || "You can try again from My Donations.",
						);
					}
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
						<H2>Donate</H2>
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
					<Label style={{ marginBottom: spacing[2] }}>Amount</Label>
					<View
						style={{
							flexDirection: "row",
							flexWrap: "wrap",
							gap: spacing[2],
						}}
					>
						{DONATION_PRESETS_MINOR.map((preset) => {
							const active = !custom && amountMinor === preset;
							return (
								<Pressable
									key={preset}
									onPress={() => {
										setCustom("");
										setAmountMinor(preset);
									}}
									style={{
										paddingHorizontal: spacing[4],
										paddingVertical: spacing[2.5],
										borderRadius: 12,
										backgroundColor: active
											? colors.primary.main
											: colors.background.tertiary,
									}}
								>
									<Body
										weight={active ? "bold" : "normal"}
										color={
											active ? (colors.primary.contrast as string) : "secondary"
										}
									>
										{formatMinor(preset)}
									</Body>
								</Pressable>
							);
						})}
					</View>

					<Label style={{ marginTop: spacing[4], marginBottom: spacing[1.5] }}>
						Or enter an amount (₹)
					</Label>
					<Input
						placeholder="e.g. 750"
						value={custom}
						onChangeText={(v) => {
							const digits = v.replace(/\D/g, "");
							setCustom(digits);
							if (digits) setAmountMinor(Number(digits) * 100);
						}}
						keyboardType="number-pad"
						style={[inputStyle, { maxWidth: 180 }]}
					/>

					{!me && (
						<>
							<Label
								style={{ marginTop: spacing[5], marginBottom: spacing[1.5] }}
							>
								Your name <Caption color="tertiary">(optional)</Caption>
							</Label>
							<Input
								placeholder="Aditi Sharma"
								value={guestName}
								onChangeText={setGuestName}
								style={inputStyle}
							/>

							<Label
								style={{ marginTop: spacing[4], marginBottom: spacing[1.5] }}
							>
								Email for receipt
							</Label>
							<Input
								placeholder="you@example.com"
								value={guestEmail}
								onChangeText={setGuestEmail}
								keyboardType="email-address"
								autoCapitalize="none"
								style={inputStyle}
							/>
						</>
					)}

					<Label style={{ marginTop: spacing[5], marginBottom: spacing[1.5] }}>
						Message <Caption color="tertiary">(optional)</Caption>
					</Label>
					<Input
						placeholder="Anything you'd like the NGO to know"
						value={message}
						onChangeText={setMessage}
						multiline
						style={{ ...inputStyle, minHeight: 88, textAlignVertical: "top" }}
					/>

					<Pressable
						onPress={() => setAnonymous((v) => !v)}
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: spacing[3],
							marginTop: spacing[4],
						}}
					>
						<View
							style={{
								width: 22,
								height: 22,
								borderRadius: 6,
								borderWidth: 2,
								borderColor: isAnonymous
									? colors.primary.main
									: colors.border.dark,
								backgroundColor: isAnonymous
									? colors.primary.main
									: "transparent",
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							{isAnonymous && (
								<Body
									weight="bold"
									color={colors.primary.contrast as string}
									style={{ fontSize: 13, lineHeight: 16 }}
								>
									✓
								</Body>
							)}
						</View>
						<Caption color="secondary" style={{ flex: 1 }}>
							Donate anonymously — your name is hidden from the NGO
						</Caption>
					</Pressable>

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
						loading={donate.isPending}
						style={{ marginTop: spacing[6] }}
					>
						Donate {formatMinor(amountMinor)}
					</Button>

					<Caption
						color="quaternary"
						style={{ textAlign: "center", marginTop: spacing[3] }}
					>
						Payment is completed securely in this app.
					</Caption>
				</ScrollView>
			</View>
		</Modal>
	);
}
