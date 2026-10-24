import { useLocalSearchParams, useRouter } from "expo-router";
import {
	Building2,
	Clock,
	type LucideIcon,
	MapPin,
	Package,
} from "lucide-react-native";
import { useState } from "react";
import { Platform, ScrollView, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/back-button";
import { ClosedState } from "@/components/closed-state";
import { PledgeSheet } from "@/components/pledge-sheet";
import {
	ErrorState,
	ListGroup,
	ListRow,
	LoadingState,
	SectionTitle,
	Surface,
} from "@/components/screen-shell";
import {
	humanizeStatus,
	pledgeStatusLabel,
	pledgeTone,
	StatusPill,
} from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { confirm, toast } from "@/components/ui/overlay";
import { Body, Caption, H3, Label, Title } from "@/components/ui/typography";
import { usePublicNeed, useWithdrawPledge } from "@/hooks/use-needs";
import { useMe } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { apiErrorMessage } from "@/lib/api";
import { formatDateTime, formatProgress } from "@/lib/format";
import { verticalScrollbar } from "@/lib/scroll";
import { useAuthStore } from "@/store/auth-store";

/** Same grid as `events/[id].tsx`: details left, a sticky action card right. */
const PAGE = { maxWidth: 1080, width: "100%", alignSelf: "center" } as const;
const ASIDE: ViewStyle = { width: 360, flexGrow: 0, flexShrink: 0 };
const STICKY = (Platform.OS === "web"
	? { position: "sticky", top: 0 }
	: {}) as unknown as ViewStyle;

/**
 * One need or offer - the page a shared link and a "pledge accepted"
 * notification open. The app had no such page: needs lived only as feed cards,
 * so a shared need opened the NGO's profile and the volunteer had to find it
 * again. `GET /api/needs/:id` existed with no screen behind it.
 *
 * Same shape as `events/[id].tsx`, on purpose: who and what, the facts, the
 * description, and the one action - in a sticky card beside the details on
 * desktop, pinned to the bottom on a phone. A closed post is a `ClosedState`,
 * not a disabled button. Pledging is the same `PledgeSheet` the feed opens, so
 * there is one pledge form in the app.
 */
export default function NeedDetail() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const { colors, spacing } = useTheme();
	const { isDesktop } = useMedia();
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const email = useAuthStore((s) => s.email);
	const [pledging, setPledging] = useState(false);

	const query = usePublicNeed(id);
	const { data: me } = useMe(!!email);
	const withdraw = useWithdrawPledge();

	const need = query.data;
	const pledge =
		need?.myPledge && need.myPledge.status !== "CANCELLED"
			? need.myPledge
			: null;
	const isWant = need?.type === "WANT";
	const isVolunteer = me?.roles.includes("volunteer") ?? false;
	const expired = need?.expiresAt
		? new Date(need.expiresAt) < new Date()
		: false;
	const open = need?.status === "OPEN" && !expired;

	const startPledge = () => {
		if (!email) {
			router.push("/(auth)/login");
			return;
		}
		if (!isVolunteer) {
			toast.info(
				"Offers come from volunteer accounts. Organisation accounts post their own needs instead.",
			);
			return;
		}
		setPledging(true);
	};

	const onWithdraw = async () => {
		if (!need) return;
		const ok = await confirm({
			title: "Withdraw your offer?",
			message:
				"The NGO will no longer count on it. You can offer again while the post is open.",
			confirmLabel: "Withdraw",
			cancelLabel: "Keep it",
		});
		if (!ok) return;
		withdraw.mutate(
			{ needId: need.id },
			{
				onSuccess: () => toast.success("Offer withdrawn."),
				onError: (error) => toast.error(apiErrorMessage(error)),
			},
		);
	};

	const gutter = spacing[5];

	/* The action, in whichever state the post is in --------------------------- */
	let footer: React.ReactNode = null;
	if (need) {
		if (pledge) {
			const copy =
				pledge.status === "ACCEPTED"
					? [
							"They said yes",
							"The NGO has your phone number and will message you to arrange the handover.",
						]
					: pledge.status === "COMPLETED"
						? ["Received - thank you", "The NGO marked your help as delivered."]
						: pledge.status === "REJECTED"
							? ["Not needed this time", "Thank you for offering."]
							: ["Offer sent", "The NGO will review it."];
			footer = (
				<View
					style={{
						flexDirection: isDesktop ? "column" : "row",
						alignItems: isDesktop ? "stretch" : "center",
						gap: spacing[3],
					}}
				>
					<View style={{ flex: isDesktop ? undefined : 1, minWidth: 0 }}>
						<Label weight="semibold" numberOfLines={1}>
							{copy[0]}
						</Label>
						<Caption color="tertiary" numberOfLines={isDesktop ? 4 : 2}>
							{copy[1]}
						</Caption>
					</View>
					{/* Only a pending offer can be withdrawn (the server refuses the
					    rest); once accepted, changing it is a conversation with the NGO. */}
					{pledge.status === "PENDING" && (
						<Button
							variant="outline"
							size={isDesktop ? "default" : "sm"}
							onPress={onWithdraw}
							loading={withdraw.isPending}
							accessibilityLabel="Withdraw your offer"
						>
							Withdraw
						</Button>
					)}
				</View>
			);
		} else if (!open) {
			footer =
				need.status === "FULFILLED" ? (
					<ClosedState
						title="Fully met - thank you"
						description="The NGO has everything it asked for."
					/>
				) : (
					<ClosedState
						title="No longer accepting offers"
						description={
							expired && need.expiresAt
								? `Closed ${formatDateTime(need.expiresAt)}.`
								: "The NGO has closed this post."
						}
					/>
				);
		} else {
			footer = (
				<Button onPress={startPledge}>
					{!email ? "Sign in to help" : isWant ? "I can help" : "Claim this"}
				</Button>
			);
		}
	}

	const place = need ? [need.city, need.state].filter(Boolean).join(", ") : "";

	// An array, not a fragment: `ListGroup` draws its hairlines between children.
	const facts = need
		? [
				<Fact
					key="progress"
					icon={Package}
					label={formatProgress(
						need.fulfilledQuantity,
						need.quantity,
						need.unit,
					)}
					hint={
						open
							? "Progress"
							: need.status === "FULFILLED"
								? "Fully met"
								: humanizeStatus(need.status)
					}
				/>,
				need.city ? (
					<Fact key="where" icon={MapPin} label={place} hint="Where" />
				) : null,
				need.expiresAt ? (
					<Fact
						key="deadline"
						icon={Clock}
						label={
							expired
								? `Closed ${formatDateTime(need.expiresAt)}`
								: `Open until ${formatDateTime(need.expiresAt)}`
						}
						hint="Deadline"
					/>
				) : null,
			]
		: [];

	const organiserRow = need ? (
		<ListRow
			icon={Building2}
			label={need.organization.organizationName}
			hint="See the NGO"
			onPress={() => router.push(`/ngos/${need.organization.id}`)}
		/>
	) : null;

	const heading = need ? (
		<View style={{ gap: spacing[1], marginBottom: spacing[5] }}>
			<Caption color="secondary">
				{need.organization.organizationName} ·{" "}
				{isWant ? "Needs help" : "Giving away"}
			</Caption>
			{isDesktop ? (
				<Title accessibilityRole="header">{need.title}</Title>
			) : (
				<H3 accessibilityRole="header">{need.title}</H3>
			)}
			{pledge || (need.urgency === "HIGH" && open) ? (
				<View
					style={{
						flexDirection: "row",
						flexWrap: "wrap",
						gap: spacing[2],
						marginTop: spacing[2],
					}}
				>
					{need.urgency === "HIGH" && open ? (
						<StatusPill label="Urgent" tone="error" />
					) : null}
					{pledge ? (
						<StatusPill
							label={`Your offer: ${pledgeStatusLabel(pledge.status)}`}
							tone={pledgeTone(pledge.status)}
						/>
					) : null}
				</View>
			) : null}
		</View>
	) : null;

	const about = need ? (
		<>
			<SectionTitle>
				{isWant ? "What they need" : "What's on offer"}
			</SectionTitle>
			<Body color="secondary" style={{ marginBottom: spacing[6] }}>
				{need.description}
			</Body>

			{pledge?.message ? (
				<Surface style={{ marginBottom: spacing[6] }}>
					<Caption color="tertiary">Your message</Caption>
					<Body color="secondary" style={{ marginTop: spacing[1] }}>
						"{pledge.message}"
					</Body>
				</Surface>
			) : null}
		</>
	) : null;

	return (
		<View style={{ flex: 1, backgroundColor: colors.background.warm }}>
			<View
				style={{
					paddingHorizontal: gutter,
					paddingTop: insets.top + spacing[2],
					paddingBottom: spacing[2],
				}}
			>
				<View
					style={[
						PAGE,
						{
							flexDirection: "row",
							alignItems: "center",
							gap: spacing[3],
							minHeight: 40,
						},
					]}
				>
					<BackButton fallbackHref="/" />
					{isDesktop ? (
						<Caption color="tertiary" numberOfLines={1} style={{ flex: 1 }}>
							{need?.organization.organizationName ?? "Needs"}
						</Caption>
					) : null}
				</View>
			</View>

			{query.isLoading ? (
				<LoadingState />
			) : query.isError || !need ? (
				<ErrorState
					title="Post not available"
					message={apiErrorMessage(
						query.error,
						"This post is no longer available.",
					)}
					onRetry={() => query.refetch()}
				/>
			) : isDesktop ? (
				<ScrollView
					{...verticalScrollbar}
					contentContainerStyle={{
						paddingHorizontal: gutter,
						paddingTop: spacing[4],
						paddingBottom: spacing[10],
					}}
				>
					<View
						style={[
							PAGE,
							{
								flexDirection: "row",
								alignItems: "flex-start",
								gap: spacing[8],
							},
						]}
					>
						<View style={{ flex: 1, minWidth: 0 }}>
							{heading}
							{about}
							<SectionTitle>Posted by</SectionTitle>
							<ListGroup>{organiserRow}</ListGroup>
						</View>

						<View style={[ASIDE, STICKY]}>
							<ListGroup>
								{facts}
								<View key="action" style={{ padding: spacing[4] }}>
									{footer}
								</View>
							</ListGroup>
						</View>
					</View>
				</ScrollView>
			) : (
				<>
					<ScrollView
						{...verticalScrollbar}
						contentContainerStyle={{
							paddingHorizontal: gutter,
							paddingTop: spacing[2],
							paddingBottom: spacing[8],
						}}
					>
						{heading}
						<View style={{ marginBottom: spacing[6] }}>
							<ListGroup>
								{facts}
								{organiserRow}
							</ListGroup>
						</View>
						{about}
					</ScrollView>

					{footer ? (
						<View
							style={{
								paddingHorizontal: gutter,
								paddingTop: spacing[3],
								paddingBottom: insets.bottom + spacing[3],
								borderTopWidth: 1,
								borderTopColor: colors.border.hairline,
								backgroundColor: colors.background.card,
							}}
						>
							{footer}
						</View>
					) : null}
				</>
			)}

			<PledgeSheet
				need={pledging && need ? need : null}
				onClose={() => setPledging(false)}
			/>
		</View>
	);
}

function Fact({
	icon,
	label,
	hint,
}: {
	icon: LucideIcon;
	label: string;
	hint: string;
}) {
	return <ListRow icon={icon} label={label} hint={hint} />;
}
