import { useLocalSearchParams, useRouter } from "expo-router";
import {
	CalendarDays,
	Clock,
	type LucideIcon,
	MapPin,
	Users,
} from "lucide-react-native";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/back-button";
import {
	ErrorState,
	ListGroup,
	ListRow,
	LoadingState,
	SectionTitle,
	Surface,
} from "@/components/screen-shell";
import {
	applicationTone,
	humanizeStatus,
	StatusPill,
} from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { Body, Caption, H2, Label } from "@/components/ui/typography";
import {
	useApplyToEvent,
	usePublicEvent,
	useWithdrawApplication,
} from "@/hooks/use-events";
import { useMe } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { Alert } from "@/lib/alert";
import { apiErrorMessage } from "@/lib/api";
import { formatDateRange, formatDateTime } from "@/lib/format";
import { useAuthStore } from "@/store/auth-store";

/**
 * One event, laid out in the order a volunteer decides: who and what, then the
 * facts (when, where, how many places), then the description. The one action —
 * apply, or withdraw — is pinned to the bottom so it never has to be scrolled
 * to, and the optional message to the organiser lives in a sheet rather than an
 * always-open text box on the page.
 */
export default function EventDetail() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const { colors, spacing } = useTheme();
	const { isDesktop } = useMedia();
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const email = useAuthStore((s) => s.email);
	const [applyOpen, setApplyOpen] = useState(false);
	const [message, setMessage] = useState("");

	const query = usePublicEvent(id);
	const { data: me } = useMe(!!email);
	const apply = useApplyToEvent(id ?? "");
	const withdraw = useWithdrawApplication(id ?? "");

	const event = query.data;
	const application = event?.myApplication ?? null;
	const activeApplication =
		application && application.status !== "WITHDRAWN" ? application : null;
	const remaining = event
		? Math.max(event.volunteersNeeded - event.acceptedCount, 0)
		: 0;

	const isVolunteer = me?.roles.includes("volunteer") ?? false;
	const deadlinePassed = event
		? new Date(event.applicationDeadline ?? event.startAt) < new Date()
		: false;

	const startApply = () => {
		if (!email) {
			router.push("/(auth)/login");
			return;
		}
		if (!isVolunteer) {
			Alert.alert(
				"Volunteer account needed",
				"Applications come from volunteer accounts. Organisation accounts manage their own events instead.",
			);
			return;
		}
		setApplyOpen(true);
	};

	const sendApplication = () => {
		apply.mutate(
			{ message: message.trim() || undefined },
			{
				onSuccess: () => {
					setMessage("");
					setApplyOpen(false);
				},
				onError: (error) =>
					Alert.alert("Could not apply", apiErrorMessage(error)),
			},
		);
	};

	const onWithdraw = () => {
		Alert.alert(
			"Withdraw your application?",
			"Your place goes back to the pool. You can apply again while applications are open.",
			[
				{ text: "Keep it", style: "cancel" },
				{
					text: "Withdraw",
					style: "destructive",
					onPress: () =>
						withdraw.mutate(undefined, {
							onError: (error) =>
								Alert.alert("Could not withdraw", apiErrorMessage(error)),
						}),
				},
			],
		);
	};

	const gutter = spacing[5];

	/* Footer ------------------------------------------------------------------ */
	let footer: React.ReactNode = null;
	if (event) {
		if (activeApplication) {
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
							{activeApplication.status === "ACCEPTED"
								? "You're confirmed"
								: activeApplication.status === "PENDING"
									? "Application sent"
									: "Not accepted this time"}
						</Label>
						<Caption color="tertiary" numberOfLines={1}>
							{activeApplication.status === "ACCEPTED"
								? "Turn up and get marked present."
								: activeApplication.status === "PENDING"
									? "The organiser will review it."
									: "You can look for another event."}
						</Caption>
					</View>
					{activeApplication.status !== "REJECTED" && (
						<Button
							variant="outline"
							size="sm"
							onPress={onWithdraw}
							loading={withdraw.isPending}
							accessibilityLabel="Withdraw your application"
						>
							Withdraw
						</Button>
					)}
				</View>
			);
		} else if (deadlinePassed) {
			footer = (
				<Button
					disabled
					onPress={() => {}}
					accessibilityLabel="Applications closed"
				>
					Applications closed
				</Button>
			);
		} else if (remaining === 0) {
			footer = (
				<Button
					disabled
					onPress={() => {}}
					accessibilityLabel="All places filled"
				>
					All places filled
				</Button>
			);
		} else {
			footer = (
				<Button onPress={startApply} loading={apply.isPending}>
					{email ? "Apply to volunteer" : "Sign in to apply"}
				</Button>
			);
		}
	}

	return (
		<View style={{ flex: 1, backgroundColor: colors.background.warm }}>
			{/* Header row: 40pt back target, same row a title would sit on. */}
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
				<BackButton fallbackHref="/events" />
			</View>

			{query.isLoading ? (
				<LoadingState />
			) : query.isError || !event ? (
				<ErrorState
					message={apiErrorMessage(
						query.error,
						"This event is no longer available.",
					)}
					onRetry={() => query.refetch()}
				/>
			) : (
				<>
					<ScrollView
						showsVerticalScrollIndicator={false}
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
							{event.organization.organizationName}
						</Caption>
						<H2 accessibilityRole="header" style={{ marginBottom: spacing[3] }}>
							{event.title}
						</H2>

						{activeApplication && (
							<View style={{ marginBottom: spacing[4] }}>
								<StatusPill
									label={`Your application: ${humanizeStatus(activeApplication.status)}`}
									tone={applicationTone(activeApplication.status)}
								/>
							</View>
						)}

						<View style={{ marginBottom: spacing[5] }}>
							<ListGroup>
								<Fact
									icon={CalendarDays}
									label={formatDateRange(event.startAt, event.endAt)}
									hint="When"
								/>
								{(event.venue || event.city) && (
									<Fact
										icon={MapPin}
										label={[event.venue, event.city, event.state]
											.filter(Boolean)
											.join(", ")}
										hint="Where"
									/>
								)}
								<Fact
									icon={Users}
									label={
										remaining > 0
											? `${remaining} of ${event.volunteersNeeded} places left`
											: `All ${event.volunteersNeeded} places filled`
									}
									hint={`${event.acceptedCount} confirmed so far`}
								/>
								{event.applicationDeadline && (
									<Fact
										icon={Clock}
										label={
											deadlinePassed
												? `Closed ${formatDateTime(event.applicationDeadline)}`
												: `Apply by ${formatDateTime(event.applicationDeadline)}`
										}
										hint="Applications"
									/>
								)}
							</ListGroup>
						</View>

						<SectionTitle>About this event</SectionTitle>
						<Body color="secondary" style={{ marginBottom: spacing[5] }}>
							{event.description}
						</Body>

						{activeApplication?.reviewNote && (
							<Surface style={{ marginBottom: spacing[5] }}>
								<Caption color="tertiary">Note from the organiser</Caption>
								<Body color="secondary" style={{ marginTop: spacing[1] }}>
									“{activeApplication.reviewNote}”
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

			<Sheet
				visible={applyOpen}
				onClose={() => setApplyOpen(false)}
				title="Apply to volunteer"
				subtitle={event?.title}
				footer={
					<Button
						onPress={sendApplication}
						loading={apply.isPending}
						accessibilityLabel="Send application"
					>
						Send application
					</Button>
				}
			>
				<View style={{ paddingTop: spacing[2], paddingBottom: spacing[2] }}>
					<Label style={{ marginBottom: spacing[1.5] }}>
						Message to the organiser
						<Caption color="tertiary"> (optional)</Caption>
					</Label>
					<Input
						placeholder="Why you'd like to help, and when you're free"
						value={message}
						onChangeText={setMessage}
						multiline
						accessibilityLabel="Message to the organiser"
						style={{ minHeight: 110, textAlignVertical: "top" }}
					/>
					<Caption color="quaternary" style={{ marginTop: spacing[2] }}>
						The organiser sees your name, city and this message.
					</Caption>
				</View>
			</Sheet>
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
