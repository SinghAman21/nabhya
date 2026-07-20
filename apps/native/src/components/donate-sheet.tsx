import { DONATION_PRESETS_MINOR, formatMinor } from "@nabhya/shared";
import { X } from "lucide-react-native";
import { useState } from "react";
import {
	Alert,
	Linking,
	Modal,
	Pressable,
	ScrollView,
	View,
} from "react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Body, Caption, H2, Label } from "@/components/ui/typography";
import { useCreateDonation } from "@/hooks/use-engagement";
import { useMe } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

/**
 * Donation entry point.
 *
 * The amount is captured in rupees but sent as paise — integers only, so no
 * float rounding ever reaches the ledger. Dodo is product-based, so whole
 * rupees are the finest granularity the gateway can represent.
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
				onSuccess: async ({ checkoutUrl }) => {
					onClose();
					const canOpen = await Linking.canOpenURL(checkoutUrl);
					if (canOpen) await Linking.openURL(checkoutUrl);
					else
						Alert.alert(
							"Could not open payment page",
							"Please try again from a browser.",
						);
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
						You'll be taken to a secure payment page to finish.
					</Caption>
				</ScrollView>
			</View>
		</Modal>
	);
}
