import type { SelectableRole } from "@nabhya/shared";
import { useQueryClient } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import {
	ChevronRight,
	FileCheck2,
	HandHeart,
	Landmark,
	type LucideIcon,
	ScanFace,
} from "lucide-react-native";
import { useState } from "react";
import {
	ActivityIndicator,
	Platform,
	ScrollView,
	View,
	type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccountSignOut } from "@/components/account-sign-out";
import { BrandMark } from "@/components/brand";
import { Banner, Surface } from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { confirm } from "@/components/ui/overlay";
import {
	Body,
	Caption,
	H3,
	H5,
	Label,
	Title,
} from "@/components/ui/typography";
import { useSignOut } from "@/hooks/use-auth";
import { useSelectRole } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { apiErrorMessage, queryKeys } from "@/lib/api";
import { verticalScrollbar } from "@/lib/scroll";
import { useAuthStore } from "@/store/auth-store";

/** Two journeys side by side need this much window; below it they stack. */
const COLUMNS_MIN_WIDTH = 960;

const WEB_VIEWPORT: ViewStyle =
	Platform.OS === "web" ? ({ height: "100dvh" } as unknown as ViewStyle) : {};

interface Choice {
	role: SelectableRole;
	title: string;
	description: string;
	Icon: LucideIcon;
	/** The wizard's own steps, minus its review - what the next minutes are. */
	steps: ReadonlyArray<{ title: string; body: string }>;
	/** The one thing after the wizard that gates the account's real use. */
	gate: { icon: LucideIcon; title: string; body: string };
	/** The phone's card footer, and the confirmation's message. */
	summary: string;
	action: string;
	confirmTitle: string;
}

const CHOICES: readonly Choice[] = [
	{
		role: "volunteer",
		title: "I want to volunteer",
		description:
			"Find NGOs near you, pledge the things they need, help at their events and collect certificates for it.",
		Icon: HandHeart,
		steps: [
			{
				title: "About you",
				body: "Your name, a photo and a line about yourself.",
			},
			{ title: "Your city", body: "Your feed opens on what's near you." },
			{ title: "Causes", body: "What you care about, so the feed fits." },
		],
		gate: {
			icon: ScanFace,
			title: "Then verify your ID",
			body: "An Aadhaar photo and a quick selfie. Needed before you apply to an event or pledge an item.",
		},
		summary: "3 short steps, then an ID check before you apply or pledge.",
		action: "Continue as a volunteer",
		confirmTitle: "Set up a volunteer account?",
	},
	{
		role: "organisation",
		title: "I represent an NGO",
		description:
			"Register your organisation, get verified, then post needs and events and manage the volunteers who respond.",
		Icon: Landmark,
		steps: [
			{
				title: "Your organisation",
				body: "Name, type and registration number.",
			},
			{
				title: "Where you're based",
				body: "Your city is public; the address stays private.",
			},
			{
				title: "Causes",
				body: "What you work on - it decides who sees you.",
			},
			{
				title: "Team and presence",
				body: "Logo, founding year, team size. All optional.",
			},
		],
		gate: {
			icon: FileCheck2,
			title: "Then get verified",
			body: "Upload your registration certificate and PAN. A reviewer approves them before anything you post goes public.",
		},
		summary:
			"4 short steps, then your registration certificate and PAN for verification.",
		action: "Register my NGO",
		confirmTitle: "Set up an NGO account?",
	},
];

/**
 * The one question after sign-up.
 *
 * **Desktop shows both journeys in full, side by side.** It was two short cards
 * in a 480pt column in the middle of a 1920pt window, and the only place the
 * consequences were spelled out was a confirmation dialog raised *after* the
 * click - so the screen with all the room said the least, and then interrupted.
 * Each column now lists its own steps and the gate after them, and ends in its
 * own labelled button. Nothing needs confirming: the choice is made with the
 * consequences on screen, by pressing a button named for it, not by a stray
 * tap on a card.
 *
 * **A phone keeps the card and the confirmation.** Two full journeys stacked
 * are a long scroll before the second choice is even visible, so the phone gets
 * the summary line, and - because there a whole card is the target and an
 * accidental tap while scrolling is easy - the confirm. It is drawn as a normal
 * action, not in the error tone: it was a red "Continue", which reads as
 * "this deletes something".
 *
 * Both shapes keep the way out: signing up with the wrong Google account (easy
 * on a shared phone) otherwise left no route to a sign-out control, since every
 * other screen is behind a role.
 */
export default function RoleSelect() {
	const { colors, spacing } = useTheme();
	const { isDesktop, width } = useMedia();
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const selectRole = useSelectRole();
	const queryClient = useQueryClient();
	const signOut = useSignOut();
	const [error, setError] = useState<string | null>(null);
	const columns = isDesktop && width >= COLUMNS_MIN_WIDTH;
	const signedIn = useAuthStore((s) => !!s.email);

	const commit = (role: SelectableRole) => {
		if (selectRole.isPending) return;
		setError(null);
		selectRole.mutate(role, {
			onSuccess: () => {
				// Drop the cached status, don't just invalidate it. The gate
				// otherwise mounts on the old `needsRoleSelection: true`, syncs
				// that back into the store and replaces itself with this screen
				// before the refetch lands - the role was saved, but the person
				// was bounced straight back here to choose again.
				queryClient.removeQueries({ queryKey: queryKeys.onboardingStatus });
				router.replace("/");
			},
			onError: (mutationError) =>
				setError(
					apiErrorMessage(
						mutationError,
						"Check your connection and try again.",
					),
				),
		});
	};

	const confirmThenCommit = async (choice: Choice) => {
		if (selectRole.isPending) return;
		const ok = await confirm({
			title: choice.confirmTitle,
			message: `Next: ${choice.summary} This can't be switched later from the app.`,
			confirmLabel: "Continue",
			cancelLabel: "Go back",
			destructive: false,
		});
		if (ok) commit(choice.role);
	};

	const errorBanner = error ? (
		<View style={{ marginBottom: spacing[5] }}>
			<Banner
				tone="error"
				title="Couldn't save your choice"
				description={error}
			/>
		</View>
	) : null;

	const signOutControl = (
		<AccountSignOut
			onPress={() => signOut.mutate()}
			pending={signOut.isPending}
			disabled={selectRole.isPending}
			// Always, phone included: the commonest reason to leave this screen
			// is having signed up with the wrong Google account.
			showEmail
		/>
	);

	// A 401 mid-choice signs out from under this screen; it has no layout guard
	// of its own, so it sends the person to sign-in itself.
	if (!signedIn) return <Redirect href="/(auth)/login" />;

	if (columns) {
		return (
			<View
				style={{
					flex: 1,
					backgroundColor: colors.background.warm,
					...WEB_VIEWPORT,
				}}
			>
				<ScrollView
					style={{ flex: 1 }}
					contentContainerStyle={{
						flexGrow: 1,
						paddingHorizontal: spacing[10],
						paddingBottom: spacing[12],
					}}
					{...verticalScrollbar}
				>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							justifyContent: "space-between",
							paddingVertical: spacing[6],
						}}
					>
						<BrandMark onDark={false} />
						<View
							style={{
								flexDirection: "row",
								alignItems: "center",
								gap: spacing[3],
							}}
						>
							{signOutControl}
						</View>
					</View>

					<View
						style={{
							flex: 1,
							justifyContent: "center",
							width: "100%",
							maxWidth: 1040,
							alignSelf: "center",
							paddingTop: spacing[6],
						}}
					>
						<Title accessibilityRole="header">How will you use Nabhya?</Title>
						<Body
							color="tertiary"
							style={{
								marginTop: spacing[1.5],
								marginBottom: spacing[8],
								maxWidth: 560,
							}}
						>
							Pick the one that fits. It sets up your account, and can't be
							switched later from the app.
						</Body>

						{errorBanner}

						<View
							style={{
								flexDirection: "row",
								alignItems: "stretch",
								gap: spacing[5],
							}}
						>
							{CHOICES.map((choice) => (
								<RoleColumn
									key={choice.role}
									choice={choice}
									busy={
										selectRole.isPending && selectRole.variables === choice.role
									}
									disabled={selectRole.isPending}
									onChoose={() => commit(choice.role)}
								/>
							))}
						</View>
					</View>
				</ScrollView>
			</View>
		);
	}

	return (
		<View style={{ flex: 1, backgroundColor: colors.background.warm }}>
			{/*
			 * Scrolls. Two cards, a lede, a possible error banner and the
			 * sign-out line are taller than a small phone in landscape or a
			 * short laptop window, and a centred `View` would clip the second
			 * card and the way out with nothing to drag.
			 */}
			<ScrollView
				style={{ flex: 1 }}
				contentContainerStyle={{
					flexGrow: 1,
					paddingTop: insets.top + spacing[5],
					paddingHorizontal: spacing[5],
					paddingBottom: insets.bottom + spacing[8],
				}}
				{...verticalScrollbar}
			>
				<View
					style={{
						flex: 1,
						width: "100%",
						maxWidth: 520,
						alignSelf: "center",
					}}
				>
					<BrandMark onDark={false} />

					<View style={{ flex: 1, justifyContent: "center" }}>
						<Title
							accessibilityRole="header"
							style={{ marginTop: spacing[10] }}
						>
							How will you use Nabhya?
						</Title>
						<Body
							color="tertiary"
							style={{ marginTop: spacing[1.5], marginBottom: spacing[6] }}
						>
							This sets up your account, and can't be switched later from the
							app.
						</Body>

						{errorBanner}

						<View style={{ gap: spacing[3] }}>
							{CHOICES.map((choice) => (
								<RoleCard
									key={choice.role}
									choice={choice}
									busy={
										selectRole.isPending && selectRole.variables === choice.role
									}
									dimmed={
										selectRole.isPending && selectRole.variables !== choice.role
									}
									disabled={selectRole.isPending}
									onPress={() => confirmThenCommit(choice)}
								/>
							))}
						</View>
					</View>

					<View
						style={{
							marginTop: spacing[8],
							alignItems: "center",
							gap: spacing[1],
						}}
					>
						{signOutControl}
					</View>
				</View>
			</ScrollView>
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Desktop: one journey, in full                                              */
/* -------------------------------------------------------------------------- */

function RoleColumn({
	choice,
	busy,
	disabled,
	onChoose,
}: {
	choice: Choice;
	busy: boolean;
	disabled: boolean;
	onChoose: () => void;
}) {
	const { colors, spacing } = useTheme();
	const { Icon, gate } = choice;
	const GateIcon = gate.icon;

	return (
		<Surface
			padded={false}
			style={{
				flex: 1,
				minWidth: 0,
				padding: spacing[7],
				opacity: disabled && !busy ? 0.5 : 1,
			}}
		>
			<IconWell icon={Icon} size={52} />
			<H3 style={{ marginTop: spacing[5] }}>{choice.title}</H3>
			<Body color="tertiary" style={{ marginTop: spacing[1.5] }}>
				{choice.description}
			</Body>

			<View
				style={{
					height: 1,
					backgroundColor: colors.border.hairline,
					marginVertical: spacing[6],
				}}
			/>

			<Label color="tertiary" style={{ marginBottom: spacing[4] }}>
				What happens next
			</Label>
			<View style={{ gap: spacing[4] }}>
				{choice.steps.map((step, index) => (
					<View
						key={step.title}
						style={{ flexDirection: "row", gap: spacing[3] }}
					>
						<View
							style={{
								width: 26,
								height: 26,
								borderRadius: 13,
								backgroundColor: colors.background.subtle,
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<Caption weight="bold" color="secondary">
								{index + 1}
							</Caption>
						</View>
						<View style={{ flex: 1, minWidth: 0 }}>
							<Label weight="semibold">{step.title}</Label>
							<Caption color="tertiary">{step.body}</Caption>
						</View>
					</View>
				))}

				<View style={{ flexDirection: "row", gap: spacing[3] }}>
					<View
						style={{
							width: 26,
							height: 26,
							borderRadius: 13,
							backgroundColor: colors.primary.tint,
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<GateIcon
							size={14}
							strokeWidth={2.2}
							color={colors.primary.ink as string}
						/>
					</View>
					<View style={{ flex: 1, minWidth: 0 }}>
						<Label weight="semibold">{gate.title}</Label>
						<Caption color="tertiary">{gate.body}</Caption>
					</View>
				</View>
			</View>

			{/* Pushed to the bottom, so both buttons sit on one line whichever
			    journey is longer. */}
			<View style={{ flex: 1, minHeight: spacing[8] }} />
			<Button onPress={onChoose} loading={busy} disabled={disabled}>
				{choice.action}
			</Button>
		</Surface>
	);
}

/* -------------------------------------------------------------------------- */
/* Phone: the summary, one tap away from the confirmation                     */
/* -------------------------------------------------------------------------- */

function RoleCard({
	choice,
	busy,
	dimmed,
	disabled,
	onPress,
}: {
	choice: Choice;
	busy: boolean;
	dimmed: boolean;
	disabled: boolean;
	onPress: () => void;
}) {
	const { colors, spacing } = useTheme();
	const { Icon, title, description, summary } = choice;

	return (
		<Surface onPress={onPress} style={{ opacity: dimmed ? 0.5 : 1 }}>
			<View
				accessible
				accessibilityLabel={`${title}. ${description} Next: ${summary}`}
				accessibilityState={{ busy, disabled }}
			>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[3.5],
					}}
				>
					{busy ? (
						<View
							style={{
								width: 44,
								height: 44,
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<ActivityIndicator size="small" color={colors.primary.ink} />
						</View>
					) : (
						<IconWell icon={Icon} size={44} />
					)}
					<View style={{ flex: 1, minWidth: 0 }}>
						<H5>{title}</H5>
						<Caption color="tertiary" style={{ marginTop: spacing[0.5] }}>
							{description}
						</Caption>
					</View>
					<ChevronRight size={18} color={colors.text.quaternary as string} />
				</View>

				<View
					style={{
						marginTop: spacing[3.5],
						paddingTop: spacing[3],
						borderTopWidth: 1,
						borderTopColor: colors.border.hairline,
					}}
				>
					<Caption color="quaternary">Next: {summary}</Caption>
				</View>
			</View>
		</Surface>
	);
}

function IconWell({ icon: Icon, size }: { icon: LucideIcon; size: number }) {
	const { colors } = useTheme();
	return (
		<View
			style={{
				width: size,
				height: size,
				borderRadius: size / 2,
				backgroundColor: colors.primary.tint,
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<Icon
				size={Math.round(size * 0.46)}
				color={colors.primary.ink as string}
				strokeWidth={1.9}
			/>
		</View>
	);
}
