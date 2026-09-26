import { useLocalSearchParams, useRouter } from "expo-router";
import {
	Building2,
	Clock,
	type LucideIcon,
	MapPin,
	Package,
} from "lucide-react-native";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/back-button";
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
	pledgeTone,
	StatusPill,
} from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { confirm, toast } from "@/components/ui/overlay";
import { Body, Caption, H2, Label } from "@/components/ui/typography";
import { usePublicNeed, useWithdrawPledge } from "@/hooks/use-needs";
import { useMe } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { apiErrorMessage } from "@/lib/api";
import { formatDateTime, formatProgress } from "@/lib/format";
import { verticalScrollbar } from "@/lib/scroll";
import { useAuthStore } from "@/store/auth-store";

/**
 * One need or offer - the page a shared link and a "pledge accepted"
 * notification open. The app had no such page: needs lived only as feed cards,
 * so a shared need opened the NGO's profile and the volunteer had to find it
 * again. `GET /api/needs/:id` existed with no screen behind it.
 *
 * Same shape as `events/[id].tsx`, on purpose: who and what, the facts, the
 * description, and the one action pinned to the bottom. Pledging is the same
 * `PledgeSheet` the feed opens, so there is one pledge form in the app.
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

	/* Footer ------------------------------------------------------------------ */
	let footer: React.ReactNode = null;
	if (need) {
		if (pledge) {
			const copy =
				pledge.status === "ACCEPTED"
					? ["They said yes", "The NGO will contact you to arrange it."]
					: pledge.status === "COMPLETED"
						? ["Received - thank you", "The NGO marked your help as delivered."]
						: pledge.status === "REJECTED"
							? ["Not needed this time", "Thank you for offering."]
							: ["Offer sent", "The NGO will review it."];
			footer = (
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[3],
					}}
				>
					<View style={{ flex: 1, minWidth: 0 }}>
						<Label weight="semibold" numberOfLines={1}>
							{copy[0]}
						</Label>
						<Caption color="tertiary" numberOfLines={1}>
							{copy[1]}
						</Caption>
					</View>
					{(pledge.status === "PENDING" || pledge.status === "ACCEPTED") && (
						<Button
							variant="outline"
							size="sm"
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
			footer = (
				<Button disabled onPress={() => {}} accessibilityLabel="Closed">
					{need.status === "FULFILLED"
						? "Fully met - thank you"
						: "No longer accepting offers"}
				</Button>
			);
		} else {
			footer = (
				<Button onPress={startPledge}>
					{!email ? "Sign in to help" : isWant ? "I can help" : "I'd like this"}
				</Button>
			);
		}
	}

	return (
		<View style={{ flex: 1, backgroundColor: colors.background.warm }}>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					minHeight: 40,
					paddingHorizontal: gutter,
					paddingTop: insets.top + spacing[2],
					paddingBottom: spacing[2],
				}}
			>
				<BackButton fallbackHref="/" />
			</View>

			{query.isLoading ? (
				<LoadingState />
			) : query.isError || !need ? (
				<ErrorState
					message={apiErrorMessage(
						query.error,
						"This post is no longer available.",
					)}
					onRetry={() => query.refetch()}
				/>
			) : (
				<>
					<ScrollView
						{...verticalScrollbar}
						contentContainerStyle={{
							paddingHorizontal: gutter,
							paddingTop: spacing[2],
							paddingBottom: spacing[8],
							...(isDesktop
								? { maxWidth: 720, width: "100%", alignSelf: "center" }
								: {}),
						}}
					>
						<Caption color="secondary" style={{ marginBottom: spacing[1] }}>
							{need.organization.organizationName} ·{" "}
							{isWant ? "Needs help" : "Giving away"}
						</Caption>
						<H2 accessibilityRole="header" style={{ marginBottom: spacing[3] }}>
							{need.title}
						</H2>

						{(pledge || need.urgency === "HIGH") && (
							<View
								style={{
									flexDirection: "row",
									flexWrap: "wrap",
									gap: spacing[2],
									marginBottom: spacing[4],
								}}
							>
								{need.urgency === "HIGH" && open && (
									<StatusPill label="Urgent" tone="error" />
								)}
								{pledge && (
									<StatusPill
										label={`Your offer: ${
											pledge.status === "COMPLETED"
												? "Received"
												: humanizeStatus(pledge.status)
										}`}
										tone={pledgeTone(pledge.status)}
									/>
								)}
							</View>
						)}

						<View style={{ marginBottom: spacing[5] }}>
							<ListGroup>
								<Fact
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
								/>
								{need.city && (
									<Fact
										icon={MapPin}
										label={[need.city, need.state].filter(Boolean).join(", ")}
										hint="Where"
									/>
								)}
								{need.expiresAt && (
									<Fact
										icon={Clock}
										label={
											expired
												? `Closed ${formatDateTime(need.expiresAt)}`
												: `Open until ${formatDateTime(need.expiresAt)}`
										}
										hint="Deadline"
									/>
								)}
								<ListRow
									icon={Building2}
									label={need.organization.organizationName}
									hint="See the NGO"
									onPress={() => router.push(`/ngos/${need.organization.id}`)}
								/>
							</ListGroup>
						</View>

						<SectionTitle>
							{isWant ? "What they need" : "What's on offer"}
						</SectionTitle>
						<Body color="secondary" style={{ marginBottom: spacing[5] }}>
							{need.description}
						</Body>

						{pledge?.message && (
							<Surface style={{ marginBottom: spacing[5] }}>
								<Caption color="tertiary">Your message</Caption>
								<Body color="secondary" style={{ marginTop: spacing[1] }}>
									“{pledge.message}”
								</Body>
							</Surface>
						)}
					</ScrollView>

					{footer && (
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
							<View
								style={
									isDesktop
										? { maxWidth: 720, width: "100%", alignSelf: "center" }
										: undefined
								}
							>
								{footer}
							</View>
						</View>
					)}
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
