import { DONATION_PRESETS_MINOR, formatMinor } from "@nabhya/shared";
import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react-native";
import { useState } from "react";
import { Platform, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/overlay";
import { Pressable } from "@/components/ui/pressable";
import { Sheet } from "@/components/ui/sheet";
import { Body, Caption, Label } from "@/components/ui/typography";
import { useCreateDonation } from "@/hooks/use-engagement";
import { useMe } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import { queryScopes } from "@/lib/api/query-keys";
import { useAuthStore } from "@/store/auth-store";

/**
 * Donation entry point.
 *
 * The amount is captured in rupees but sent as paise - integers only, so no
 * float rounding ever reaches the ledger.
 */
interface RazorpayCheckout {
	open: (options: Record<string, unknown>) => Promise<unknown>;
}

interface RazorpayWebInstance {
	open: () => void;
	on: (event: string, handler: (response: unknown) => void) => void;
}
interface RazorpayWebConstructor {
	new (options: Record<string, unknown>): RazorpayWebInstance;
}

/**
 * Razorpay's web Checkout.js isn't an npm package - it's loaded from their CDN
 * and attaches `window.Razorpay` once it runs. Injected at most once per
 * session; a second `open()` call reuses the same script tag.
 */
let razorpayWebScript: Promise<void> | null = null;
function loadRazorpayWebScript(): Promise<void> {
	if (razorpayWebScript) return razorpayWebScript;
	razorpayWebScript = new Promise((resolve, reject) => {
		const existing = document.getElementById("razorpay-checkout-js");
		if (existing) {
			resolve();
			return;
		}
		const script = document.createElement("script");
		script.id = "razorpay-checkout-js";
		script.src = "https://checkout.razorpay.com/v1/checkout.js";
		script.async = true;
		script.onload = () => resolve();
		script.onerror = () =>
			reject(new Error("Failed to load Razorpay checkout"));
		document.body.appendChild(script);
	});
	return razorpayWebScript;
}

/**
 * Razorpay ships a native module on iOS/Android (exists only in a dev client
 * or a store build - never Expo Go) and a separate, script-loaded Checkout.js
 * on web. Both are wrapped behind the same Promise-based `.open()` so the
 * caller never has to branch on platform.
 */
async function loadRazorpay(): Promise<RazorpayCheckout | null> {
	if (Platform.OS === "web") {
		try {
			await loadRazorpayWebScript();
		} catch {
			return null;
		}
		const RazorpayWeb = (
			window as unknown as { Razorpay?: RazorpayWebConstructor }
		).Razorpay;
		if (!RazorpayWeb) return null;

		return {
			open: (options) =>
				new Promise((resolve, reject) => {
					let settled = false;
					const instance = new RazorpayWeb({
						...options,
						handler: (response: unknown) => {
							settled = true;
							resolve(response);
						},
						modal: {
							ondismiss: () => {
								if (settled) return;
								settled = true;
								reject({ description: "Payment cancelled" });
							},
						},
					});
					instance.on("payment.failed", (response: unknown) => {
						if (settled) return;
						settled = true;
						const description =
							typeof response === "object" &&
							response !== null &&
							"error" in response
								? ((response as { error?: { description?: string } }).error
										?.description ?? null)
								: null;
						reject({ description: description ?? "Payment failed" });
					});
					instance.open();
				}),
		};
	}

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
					if (!orderId || !razorpayKeyId) {
						toast.error(
							"This payment provider does not support checkout here. Nothing has been charged.",
						);
						return;
					}
					const checkout = await loadRazorpay();
					if (!checkout) {
						toast.error(
							Platform.OS === "web"
								? "Razorpay's checkout script didn't load. Check your connection and try again."
								: "Donations open Razorpay's secure checkout, which is not available in this preview - use the dev client build instead.",
						);
						return;
					}
					try {
						// Fields present because we always pass order_id: razorpay_payment_id,
						// razorpay_order_id, razorpay_signature. This is fast client-side
						// feedback only - never proof the donation is COMPLETED.
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
						queryClient.invalidateQueries({ queryKey: queryScopes.donations });
						// Deliberately not "donation complete": only Razorpay's
						// signed webhook moves a donation to COMPLETED, so the
						// client's own success callback can only promise that it
						// is being confirmed.
						toast.success(
							"Thank you - we're confirming your donation now. It will show in My Donations shortly.",
						);
					} catch (err: unknown) {
						// User-cancelled checkouts land here too (react-native-razorpay
						// rejects on dismiss, not just on failure) - there is no distinct
						// "cancelled" code documented, so this message stays generic.
						const description =
							typeof err === "object" && err !== null && "description" in err
								? String((err as { description?: unknown }).description)
								: null;
						toast.error(
							description ||
								"Payment not completed. You can try again from My Donations.",
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
					Donate anonymously - your name is hidden from the NGO
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
		</Sheet>
	);
}
