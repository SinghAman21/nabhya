import type { SelectableRole } from "@nabhya/shared";
import { useRouter } from "expo-router";
import { ChevronRight, HandHeart, Landmark } from "lucide-react-native";
import { ActivityIndicator, View } from "react-native";
import { Screen, Surface } from "@/components/screen-shell";
import { Body, Caption, H2, H5 } from "@/components/ui/typography";
import { useSelectRole } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { Alert } from "@/lib/alert";
import { apiErrorMessage } from "@/lib/api";

const CHOICES: Array<{
	role: SelectableRole;
	title: string;
	description: string;
	Icon: typeof Landmark;
}> = [
	{
		role: "volunteer",
		title: "I want to volunteer",
		description:
			"Find NGOs near you, pledge items they need, help at events and collect certificates.",
		Icon: HandHeart,
	},
	{
		role: "organisation",
		title: "I represent an NGO",
		description:
			"Register your organisation, get verified, post needs and events, and manage volunteers.",
		Icon: Landmark,
	},
];

/**
 * The one question after sign-up. Volunteer first — it is most people — and
 * each choice is a whole tappable card, so there is nothing else to find.
 */
export default function RoleSelect() {
	const { colors, spacing } = useTheme();
	const { isDesktop } = useMedia();
	const router = useRouter();
	const selectRole = useSelectRole();

	const choose = (role: SelectableRole) => {
		if (selectRole.isPending) return;
		selectRole.mutate(role, {
			onSuccess: () => router.replace("/"),
			onError: (error) =>
				Alert.alert(
					"Couldn't save your choice",
					apiErrorMessage(error, "Check your connection and try again."),
				),
		});
	};

	return (
		<Screen>
			<View
				style={{
					flex: 1,
					justifyContent: "center",
					paddingBottom: spacing[10],
					...(isDesktop
						? { width: "100%", maxWidth: 480, alignSelf: "center" }
						: {}),
				}}
			>
				<H2 accessibilityRole="header" style={{ marginBottom: spacing[1] }}>
					How will you use Nabhya?
				</H2>
				<Body color="tertiary" style={{ marginBottom: spacing[6] }}>
					This sets up your account. Contact support if it ever needs changing.
				</Body>

				<View style={{ gap: spacing[3] }}>
					{CHOICES.map(({ role, title, description, Icon }) => {
						const busy = selectRole.isPending && selectRole.variables === role;
						const dimmed = selectRole.isPending && !busy;

						return (
							<Surface
								key={role}
								onPress={() => choose(role)}
								style={{ opacity: dimmed ? 0.5 : 1 }}
							>
								<View
									accessible
									accessibilityLabel={`${title}. ${description}`}
									accessibilityState={{
										busy,
										disabled: selectRole.isPending,
									}}
									style={{
										flexDirection: "row",
										alignItems: "center",
										gap: spacing[4],
									}}
								>
									<View
										style={{
											width: 48,
											height: 48,
											borderRadius: 24,
											backgroundColor: colors.primary.tint,
											alignItems: "center",
											justifyContent: "center",
										}}
									>
										{busy ? (
											<ActivityIndicator
												size="small"
												color={colors.primary.ink}
											/>
										) : (
											<Icon
												size={24}
												color={colors.primary.ink}
												strokeWidth={1.9}
											/>
										)}
									</View>
									<View style={{ flex: 1, minWidth: 0 }}>
										<H5>{title}</H5>
										<Caption
											color="tertiary"
											style={{ marginTop: spacing[0.5] }}
										>
											{description}
										</Caption>
									</View>
									<ChevronRight
										size={18}
										color={colors.text.quaternary as string}
									/>
								</View>
							</Surface>
						);
					})}
				</View>
			</View>
		</Screen>
	);
}
