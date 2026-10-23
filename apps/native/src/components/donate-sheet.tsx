import {
	DONATION_PRESETS_MINOR,
	formatMinor,
	MIN_DONATION_MINOR,
} from "@nabhya/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Platform } from "react-native";
import { Tick } from "@/components/admin/data-table";
import { ChoiceChips } from "@/components/choice-chips";
import { Field, FieldError, useFieldInputStyle } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/overlay";
import { Pressable } from "@/components/ui/pressable";
import { Sheet } from "@/components/ui/sheet";
import { Caption, Label } from "@/components/ui/typography";
import { useCreateDonation } from "@/hooks/use-engagement";
import { useMe } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import { queryScopes } from "@/lib/api/query-keys";
import { focusable } from "@/lib/focus";
import { useAuthStore } from "@/store/auth-store";

/**
 * Donation entry point.
 *
 * The amount is captured in rupees but sent as paise - integers only, so no
 * float rounding ever reaches the ledger.
 *
 * Open to signed-out visitors: the checkout endpoint is optional-auth and a
 * guest gives a receipt email instead of an account. The NGO page used to send
 * them to sign in first, which left this sheet's guest fields unreachable.
 *
 * Built from the form primitives (`ChoiceChips`, `Field`, `FieldError`, the
 * shared tick) rather than its own hand-drawn checkbox and 12pt radii - the
 * old checkbox drew `primary.main` as a border, which is a fill colour that
 * fails contrast as a line.
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
	const inputStyle = useFieldInputStyle();
	const email = useAuthStore((s) => s.email);
	const { data: me } = useMe(!!email);
	const queryClient = useQueryClient();
	const router = useRouter();

	// A preset is chosen by its value; a typed amount replaces it. Clearing the
	// typed amount leaves nothing chosen, rather than silently keeping the last
	// number on the button.
	const [preset, setPreset] = useState<string | null>(
		String(DONATION_PRESETS_MINOR[1] ?? 100_000),
	);
	const [custom, setCustom] = useState("");
	const [message, setMessage] = useState("");
	const [isAnonymous, setAnonymous] = useState(false);
	const [guestName, setGuestName] = useState("");
	const [guestEmail, setGuestEmail] = useState("");
	const [error, setError] = useState<string | null>(null);

	const donate = useCreateDonation();

	const amountMinor = custom
		? Number(custom) * 100
		: preset
			? Number(preset)
			: 0;
	const tooSmall = amountMinor > 0 && amountMinor < MIN_DONATION_MINOR;
	const canSubmit = amountMinor >= MIN_DONATION_MINOR;

	const submit = () => {
		setError(null);
		if (!canSubmit) return;

		if (!me && !guestEmail.trim()) {
			setError("Enter an email to attach to this guest donation.");
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
								? "Razorpay's checkout script didn't load. Check your connection and tap Donate to try again."
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
						if (me?.roles.includes("volunteer")) {
							toast.success(
								"Thank you - we're confirming your donation now. It shows under Your giving, with a receipt, once it lands.",
								{
									label: "View",
									onPress: () => router.push("/(volunteer)/donations"),
								},
							);
						} else {
							toast.success(
								me
									? "Thank you - we're confirming your donation now."
									: `Thank you - we're confirming your donation now. ${guestEmail.trim()} is attached to the donation record. Email receipts aren't available yet.`,
							);
						}
					} catch (err: unknown) {
						// User-cancelled checkouts land here too (react-native-razorpay
						// rejects on dismiss, not just on failure) - there is no distinct
						// "cancelled" code documented, so this message stays generic.
						const description =
							typeof err === "object" && err !== null && "description" in err
								? String((err as { description?: unknown }).description)
								: null;
						// Razorpay's descriptions end without a stop ("Payment
						// cancelled"), which ran straight into the next sentence.
						const reason = (description || "Payment not completed").replace(
							/[.\s]*$/,
							".",
						);
						toast.error(
							`${reason} Nothing was charged - tap Donate to try again.`,
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
					<Button
						onPress={submit}
						loading={donate.isPending}
						disabled={!canSubmit}
					>
						{canSubmit
							? `Donate ${formatMinor(amountMinor)}`
							: `Choose an amount (min ${formatMinor(MIN_DONATION_MINOR)})`}
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
			<ChoiceChips
				label="Amount"
				options={DONATION_PRESETS_MINOR.map((value) => ({
					value: String(value),
					label: formatMinor(value),
				}))}
				value={custom ? null : preset}
				onChange={(value) => {
					setCustom("");
					setPreset(value);
				}}
			/>

			<Field
				label="Or enter an amount (₹)"
				hint={`Minimum ${formatMinor(MIN_DONATION_MINOR)}`}
				{...(tooSmall
					? { error: `The minimum is ${formatMinor(MIN_DONATION_MINOR)}.` }
					: {})}
				style={{ marginTop: spacing[4] }}
			>
				<Input
					placeholder="e.g. 750"
					value={custom}
					onChangeText={(v) => {
						const digits = v.replace(/\D/g, "").replace(/^0+/, "");
						setCustom(digits);
						if (!digits) setPreset(null);
					}}
					keyboardType="number-pad"
					accessibilityLabel="Amount in rupees"
					style={[inputStyle, { maxWidth: 180 }]}
				/>
			</Field>

			{!me && (
				<>
					<Field label="Your name" optional>
						<Input
							placeholder="Aditi Sharma"
							value={guestName}
							onChangeText={setGuestName}
							autoComplete="name"
							style={inputStyle}
						/>
					</Field>
					<Field label="Email for donation record">
						<Input
							placeholder="you@example.com"
							value={guestEmail}
							onChangeText={setGuestEmail}
							keyboardType="email-address"
							autoCapitalize="none"
							autoComplete="email"
							style={inputStyle}
						/>
					</Field>
				</>
			)}

			<Field label="Message" optional>
				<Input
					placeholder="Anything you'd like the NGO to know"
					value={message}
					onChangeText={setMessage}
					multiline
					style={{ ...inputStyle, minHeight: 88, textAlignVertical: "top" }}
				/>
			</Field>

			<Pressable
				onPress={() => setAnonymous((v) => !v)}
				accessibilityRole="checkbox"
				accessibilityState={{ checked: isAnonymous }}
				accessibilityLabel="Donate anonymously"
				{...focusable}
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[3],
					minHeight: 44,
				}}
			>
				<Tick checked={isAnonymous} label="Donate anonymously" />
				<Caption color="secondary" style={{ flex: 1 }}>
					Donate anonymously - your name is hidden from the NGO
				</Caption>
			</Pressable>

			<FieldError message={error} />
		</Sheet>
	);
}
