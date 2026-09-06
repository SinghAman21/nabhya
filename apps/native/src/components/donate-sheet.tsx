import { DONATION_PRESETS_MINOR, formatMinor } from "@nabhya/shared";
import { Check } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Sheet } from "@/components/ui/sheet";
import { Body, Caption, Label } from "@/components/ui/typography";
import { useCreateDonation } from "@/hooks/use-engagement";
import { useMe } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { Alert } from "@/lib/alert";
import { apiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

/**
 * Donation entry point.
 *
 * The amount is captured in rupees but sent as paise — integers only, so no
 * float rounding ever reaches the ledger.
 */
interface RazorpayCheckout {
	open: (options: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Razorpay ships a native module, so it exists only in a dev client or a store
 * build. Loading it lazily keeps Expo Go and web booting; there the donor is
 * told to use the app build instead.
 */
function loadRazorpay(): RazorpayCheckout | null {
	try {
		const mod = require("react-native-razorpay") as {
			default?: RazorpayCheckout;
		};
		return mod.default ?? null;
	} catch {
		return null;
	}
}

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
					const checkout = loadRazorpay();
					if (!checkout) {
						Alert.alert(
							"Payments need the app build",
							"Donations open Razorpay's secure checkout, which is not available in this preview.",
						);
						return;
					}
					try {
						// Fast client-side feedback only — the donation is COMPLETED only
						// once the server's webhook verifies Razorpay's signature.
						await checkout.open({
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
						Alert.alert(
							"Thank you!",
							"We're confirming your donation now. Check Donations shortly.",
						);
					} catch (err: unknown) {
						const description =
							typeof err === "object" && err !== null && "description" in err
								? String((err as { description?: unknown }).description)
								: null;
						Alert.alert(
							"Payment not completed",
							description ?? "You can try again any time.",
						);
					}
				},
				onError: (e) => setError(apiErrorMessage(e)),
			},
		);
	};

	return (
		<Sheet
			visible={visible}
			onClose={onClose}
			title="Donate"
			subtitle={organizationName}
			footer={
				<>
					<Button onPress={submit} loading={donate.isPending}>
						Donate {formatMinor(amountMinor)}
					</Button>
					<Caption
						color="quaternary"
						style={{ textAlign: "center", marginTop: spacing[2] }}
					>
						You'll be taken to a secure payment page to finish.
					</Caption>
				</>
			}
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
							accessibilityRole="radio"
							accessibilityState={{ checked: active }}
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
					<Label style={{ marginTop: spacing[5], marginBottom: spacing[1.5] }}>
						Your name <Caption color="tertiary">(optional)</Caption>
					</Label>
					<Input
						placeholder="Aditi Sharma"
						value={guestName}
						onChangeText={setGuestName}
						style={inputStyle}
					/>

					<Label style={{ marginTop: spacing[4], marginBottom: spacing[1.5] }}>
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
				accessibilityRole="checkbox"
				accessibilityState={{ checked: isAnonymous }}
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
						borderColor: isAnonymous ? colors.primary.main : colors.border.dark,
						backgroundColor: isAnonymous ? colors.primary.main : "transparent",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					{isAnonymous && (
						<Check
							size={14}
							color={colors.primary.contrast as string}
							strokeWidth={3}
						/>
					)}
				</View>
				<Caption color="secondary" style={{ flex: 1 }}>
					Donate anonymously — your name is hidden from the NGO
				</Caption>
			</Pressable>

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
