import { View } from "react-native";
import { TextAction } from "@/components/text-action";
import { Caption } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { useAuthStore } from "@/store/auth-store";

/**
 * The way out of a screen that sits before the app proper - role select and
 * both onboarding wizards: which account you are in, and Sign out.
 *
 * It said "Not your NGO? Sign out" and "Not you? Sign out" - a riddle on the
 * first step of a form, which read as though the screen doubted you rather
 * than offering a control. Stating the account and naming the action says the
 * same thing plainly. The email is dropped on a phone, where the header row
 * also holds the back button and the mark.
 */
export function AccountSignOut({
	onPress,
	pending,
	disabled,
	showEmail,
}: {
	onPress: () => void;
	pending?: boolean;
	disabled?: boolean;
	/** Force the email on or off; defaults to desktop only. */
	showEmail?: boolean;
}) {
	const { spacing } = useTheme();
	const { isDesktop } = useMedia();
	const email = useAuthStore((s) => s.email);

	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: spacing[3],
				flexShrink: 1,
				minWidth: 0,
			}}
		>
			{(showEmail ?? isDesktop) && email ? (
				<Caption color="quaternary" numberOfLines={1} style={{ flexShrink: 1 }}>
					{email}
				</Caption>
			) : null}
			<TextAction
				label={pending ? "Signing out…" : "Sign out"}
				accessibilityLabel={email ? `Sign out of ${email}` : "Sign out"}
				onPress={onPress}
				disabled={pending || disabled}
			/>
		</View>
	);
}
