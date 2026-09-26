import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Copy, LogIn, MailPlus } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { withAppShell } from "@/components/app-shell";
import { FieldError } from "@/components/form-field";
import {
	EmptyState,
	LoadingState,
	Screen,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/overlay";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption, H3 } from "@/components/ui/typography";
import {
	useAcceptTeamInvite,
	useDeclineTeamInvite,
} from "@/hooks/use-directory";
import { useMe } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import { queryKeys } from "@/lib/api/query-keys";
import { copyText } from "@/lib/clipboard";
import { savePendingInvite } from "@/lib/pending-invite";
import { verticalScrollbar } from "@/lib/scroll";
import { useAuthStore } from "@/store/auth-store";

/**
 * Accept (or decline) a team invite from its email link.
 *
 * Public route on purpose - the person tapping the link may not be signed in
 * yet, in which case the token is parked (`lib/pending-invite.ts`) and the
 * entry gate brings them back here after sign-in or sign-up. The server
 * enforces the rules that matter: the invite's email must equal the signed-in
 * account's, the account must be an organisation account or have no role yet
 * (accepting grants it), and an account can be on one team at a time.
 */
function TeamInvitePage() {
	const params = useLocalSearchParams<{ token: string; by?: string }>();
	const raw = params.token;
	const token = Array.isArray(raw) ? raw[0] : raw;
	// `?by=id`: opened from the in-app notification, which carries the invite's
	// id. The email link carries the token. Same page, same server rules.
	const byId = params.by === "id";
	const router = useRouter();
	const queryClient = useQueryClient();
	const { colors, spacing } = useTheme();

	const email = useAuthStore((s) => s.email);
	const { data: me } = useMe(!!email);
	const accountEmail = me?.email ?? email ?? null;

	const accept = useAcceptTeamInvite(byId);
	const decline = useDeclineTeamInvite(byId);
	const [error, setError] = useState<string | null>(null);

	if (!token) {
		return (
			<Screen>
				<ScreenHeader back title="Team invite" />
				<EmptyState
					icon={MailPlus}
					title="Invalid invite link"
					description="This link is missing its invite token. Ask the organisation to resend the invite."
				/>
			</Screen>
		);
	}

	if (!email) {
		return (
			<Screen>
				<ScreenHeader back title="Team invite" />
				<EmptyState
					icon={LogIn}
					title="Sign in to accept this invite"
					description="Team invites are tied to your email. Sign in or create an account with the address the invite was sent to, and you'll come straight back here."
					action={
						<Button
							onPress={async () => {
								await savePendingInvite(token);
								router.replace("/(auth)/login");
							}}
						>
							Continue
						</Button>
					}
				/>
			</Screen>
		);
	}

	const busy = accept.isPending || decline.isPending;

	const failure = (err: unknown) => {
		const message = apiErrorMessage(err, "Could not process this invite.");
		// The server has two 403s here - wrong email, and an account that is
		// already a volunteer - and only the first is fixed by switching account.
		if (message.includes("different email")) {
			setError(
				accountEmail
					? `This invite was sent to a different email address - you are signed in as ${accountEmail}. Switch to the invited account and try again.`
					: "This invite was sent to a different email address. Sign in with the invited account and try again.",
			);
			return;
		}
		setError(message);
	};

	const onAccept = () => {
		setError(null);
		accept.mutate(token, {
			onSuccess: () => {
				toast.success("Welcome to the team.");
				// Accepting can grant this account its role, so the cached status
				// may still say "pick a role". Drop it rather than invalidate: the
				// gate then waits for a fresh answer instead of routing on the old
				// one, and lands the new member in the NGO app.
				queryClient.removeQueries({ queryKey: queryKeys.onboardingStatus });
				router.replace("/");
			},
			onError: failure,
		});
	};

	const onDecline = () => {
		setError(null);
		decline.mutate(token, {
			onSuccess: () => {
				toast.success("Invite declined.");
				router.replace("/");
			},
			onError: failure,
		});
	};

	const onCopyEmail = async () => {
		if (!accountEmail) return;
		const copied = await copyText(accountEmail);
		if (copied) toast.success("Email copied.");
		else toast.error("Could not copy. Long-press the address instead.");
	};

	return (
		<Screen>
			<ScreenHeader back title="Team invite" />
			<ScrollView
				{...verticalScrollbar}
				contentContainerStyle={{ paddingBottom: spacing[10] }}
			>
				<View style={{ width: "100%", maxWidth: 560, alignSelf: "center" }}>
					<Surface>
						<View style={{ gap: spacing[4] }}>
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									gap: spacing[3],
								}}
							>
								<View
									style={{
										width: 44,
										height: 44,
										borderRadius: 22,
										alignItems: "center",
										justifyContent: "center",
										backgroundColor: colors.primary.tint,
									}}
								>
									<MailPlus
										size={22}
										color={colors.primary.ink as string}
										strokeWidth={1.9}
									/>
								</View>
								<View style={{ flex: 1, gap: spacing[1] }}>
									<H3>Join the team</H3>
									<StatusPill label="Pending" tone="warning" />
								</View>
							</View>

							<Body color="secondary">
								You have been invited to help run an organisation on Nabhya.
								Invites are locked to one email address: the account you accept
								with must match the address the invite was sent to.
							</Body>

							{accountEmail && (
								<View
									style={{
										flexDirection: "row",
										alignItems: "center",
										gap: spacing[2],
									}}
								>
									<Caption color="tertiary" style={{ flex: 1 }} selectable>
										Signed in as {accountEmail}
									</Caption>
									<Pressable
										onPress={onCopyEmail}
										hitSlop={8}
										accessibilityRole="button"
										accessibilityLabel={`Copy ${accountEmail}`}
										style={{
											width: 36,
											height: 36,
											alignItems: "center",
											justifyContent: "center",
											borderRadius: 999,
										}}
									>
										<Copy
											size={16}
											color={colors.text.tertiary as string}
											strokeWidth={1.9}
										/>
									</Pressable>
								</View>
							)}

							<FieldError message={error} />

							<View style={{ flexDirection: "row", gap: spacing[3] }}>
								<Button
									variant="outline"
									onPress={onDecline}
									loading={decline.isPending}
									disabled={busy}
									style={{ flex: 1 }}
								>
									Decline
								</Button>
								<Button
									onPress={onAccept}
									loading={accept.isPending}
									disabled={busy}
									style={{ flex: 1 }}
								>
									Accept
								</Button>
							</View>

							{busy && <LoadingState label="Working on your invite" />}
						</View>
					</Surface>
				</View>
			</ScrollView>
		</Screen>
	);
}

export default withAppShell(TeamInvitePage);
