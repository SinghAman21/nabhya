import { Linking, Platform, View } from "react-native";
import { TextAction } from "@/components/text-action";
import { toast } from "@/components/ui/overlay";
import { Caption } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { copyText } from "@/lib/clipboard";

/**
 * How an NGO reaches a volunteer it has said yes to - a pledge it accepted,
 * an applicant it took on.
 *
 * Shown only after acceptance, never on a pending offer: the volunteer shared
 * their details to help, not to be contacted by every NGO they glance at, and
 * a declined pledge is a closed conversation. The API already returns the
 * phone and email to the organisation; this is the part that makes them usable
 * instead of a line of grey text.
 *
 * WhatsApp is first-class because that is how coordination actually happens
 * in India. Numbers are stored as 10 digits, so a bare 10-digit number gets
 * the +91 prefix `wa.me` needs.
 */
export function ContactActions({
	name,
	phone,
	email,
}: {
	name: string;
	phone: string | null;
	email: string | null;
}) {
	const { colors, spacing } = useTheme();
	const digits = phone?.replace(/\D/g, "") ?? "";
	const international = digits.length === 10 ? `91${digits}` : digits;

	const open = async (url: string, fallback: string, copied: string) => {
		try {
			// `canOpenURL` lies on the web and needs a manifest query on Android,
			// so just try, and fall back to copying the value.
			await Linking.openURL(url);
		} catch {
			const ok = await copyText(fallback);
			if (ok) toast.info(copied);
			else toast.error("Couldn't open that. Long-press to copy it instead.");
		}
	};

	if (!digits && !email) return null;

	return (
		<View
			style={{
				marginTop: spacing[3],
				paddingTop: spacing[3],
				borderTopWidth: 1,
				borderTopColor: colors.border.hairline,
				gap: spacing[2],
			}}
		>
			<Caption color="tertiary" selectable>
				{[phone, email].filter(Boolean).join(" · ")}
			</Caption>
			<View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[4] }}>
				{digits ? (
					<>
						{/* A desktop browser has nothing to dial with. */}
						{Platform.OS !== "web" && (
							<TextAction
								label="Call"
								tone="brand"
								onPress={() =>
									open(`tel:${digits}`, phone ?? digits, "Number copied.")
								}
								accessibilityLabel={`Call ${name}`}
							/>
						)}
						<TextAction
							label="WhatsApp"
							tone="brand"
							onPress={() =>
								open(
									`https://wa.me/${international}`,
									phone ?? digits,
									"Number copied.",
								)
							}
							accessibilityLabel={`Message ${name} on WhatsApp`}
						/>
					</>
				) : null}
				{email ? (
					<TextAction
						label="Email"
						onPress={() => open(`mailto:${email}`, email, "Email copied.")}
						accessibilityLabel={`Email ${name}`}
					/>
				) : null}
			</View>
		</View>
	);
}
