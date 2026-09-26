import type { SelectableRole } from "@nabhya/shared";
import { useRouter } from "expo-router";
import { ChevronRight, HandHeart, Landmark } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Banner, Screen, Surface } from "@/components/screen-shell";
import { TextAction } from "@/components/text-action";
import { Body, Caption, H2, H5 } from "@/components/ui/typography";
import { useSignOut } from "@/hooks/use-auth";
import { useSelectRole } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { apiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const CHOICES: Array<{
	role: SelectableRole;
	title: string;
	description: string;
	/** What the next few minutes look like, so neither choice is a mystery. */
	next: string;
	Icon: typeof Landmark;
}> = [
	{
		role: "volunteer",
		title: "I want to volunteer",
		description:
			"Find NGOs near you, pledge items they need, help at events and collect certificates.",
		next: "Next: 4 short steps - your name, your city and the causes you care about.",
		Icon: HandHeart,
	},
	{
		role: "organisation",
		title: "I represent an NGO",
		description:
			"Register your organisation, get verified, post needs and events, and manage volunteers.",
		next: "Next: 5 short steps, then your registration certificate and PAN for verification.",
		Icon: Landmark,
	},
];

/**
 * The one question after sign-up. Volunteer first - it is most people - and
 * each choice is a whole tappable card, so there is nothing else to find.
 *
 * Two things it now does that it did not:
 *
 * - **Says what the choice costs.** "I represent an NGO" led into a five-step
 *   form and a document upload with no warning, which is a bad surprise on a
 *   screen whose copy says the decision is permanent.
 * - **Has a way out.** The only route off this screen was forward. Signing up
 *   with the wrong Google account (easy, on a shared phone) left no way to
 *   reach a sign-out control, since every other screen is behind a role.
 */
export default function RoleSelect() {
	const { colors, spacing } = useTheme();
	const { isDesktop } = useMedia();
	const router = useRouter();
	const selectRole = useSelectRole();
	const signOut = useSignOut();
	const email = useAuthStore((s) => s.email);
	const [error, setError] = useState<string | null>(null);

	const choose = (role: SelectableRole) => {
		if (selectRole.isPending) return;
		setError(null);
		selectRole.mutate(role, {
			onSuccess: () => router.replace("/"),
			onError: (mutationError) =>
				setError(
					apiErrorMessage(
						mutationError,
						"Check your connection and try again.",
					),
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

				{error ? (
					<View style={{ marginBottom: spacing[5] }}>
						<Banner
							tone="error"
							title="Couldn't save your choice"
							description={error}
						/>
					</View>
				) : null}

				<View style={{ gap: spacing[3] }}>
					{CHOICES.map(({ role, title, description, next, Icon }) => {
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
									accessibilityLabel={`${title}. ${description} ${next}`}
									accessibilityState={{
										busy,
										disabled: selectRole.isPending,
									}}
								>
									<View
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

									<View
										style={{
											marginTop: spacing[3.5],
											paddingTop: spacing[3],
											borderTopWidth: 1,
											borderTopColor: colors.border.hairline,
										}}
									>
										<Caption color="quaternary">{next}</Caption>
									</View>
								</View>
							</Surface>
						);
					})}
				</View>

				<View
					style={{
						marginTop: spacing[8],
						alignItems: "center",
						gap: spacing[1],
					}}
				>
					{email ? (
						<Caption color="quaternary" numberOfLines={1}>
							Signed in as {email}
						</Caption>
					) : null}
					<TextAction
						label="Not you? Sign out"
						onPress={() => signOut.mutate()}
						disabled={signOut.isPending || selectRole.isPending}
					/>
				</View>
			</View>
		</Screen>
	);
}
