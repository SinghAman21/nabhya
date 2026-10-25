import { useLocalSearchParams, useRouter } from "expo-router";
import {
	Building2,
	CalendarDays,
	Clock,
	type LucideIcon,
	MapPin,
	Users,
} from "lucide-react-native";
import { useState } from "react";
import { Platform, ScrollView, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/back-button";
import { ClosedState } from "@/components/closed-state";
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
import { confirm, toast } from "@/components/ui/overlay";
import { Sheet } from "@/components/ui/sheet";
import { Body, Caption, H3, Label, Title } from "@/components/ui/typography";
import { useVerifyIdentitySheet } from "@/components/verification/verify-identity-sheet";
import {
	useIdentityGate,
	VerificationNote,
} from "@/components/verification-note";
import {
	useApplyToEvent,
	usePublicEvent,
	useWithdrawApplication,
} from "@/hooks/use-events";
import { useMe } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { apiErrorMessage } from "@/lib/api";
import { formatDateRange, formatDateTime } from "@/lib/format";
import { signInAndReturn } from "@/lib/return-to";
import { verticalScrollbar } from "@/lib/scroll";
import { useAuthStore } from "@/store/auth-store";

/** Details plus the action card, and no wider than both need. */
const PAGE = { maxWidth: 1080, width: "100%", alignSelf: "center" } as const;

/** The action card's column. Fixed, so the details column takes the slack. */
const ASIDE: ViewStyle = { width: 360, flexGrow: 0, flexShrink: 0 };

/**
 * Sticks to the top of the page's own scroller on the web. It works here
 * because the card is a *descendant* of the `ScrollView` (see the sticky note
 * in `apps/native/AGENTS.md` - a sibling of the scroller has nothing to stick
 * to); `alignItems: "flex-start"` on the row keeps the column content-height
 * so there is room for it to travel.
 */
const STICKY = (Platform.OS === "web"
	? { position: "sticky", top: 0 }
	: {}) as unknown as ViewStyle;

/**
 * One event, laid out in the order a volunteer decides: who and what, then the
 * facts (when, where, how many places), then the description.
 *
 * Desktop is two columns: the details on the left, and on the right an action
 * card holding the facts you decide on (date, place, places left, deadline)
 * with the one action under them, sticking as the description scrolls. It was
 * a 720 column with a display-face title in capitals and the action as a
 * full-width bar pinned to the bottom of a 1400pt window.
 *
 * A phone keeps the action pinned in the footer so it never has to be
 * scrolled to. On both, a closed event says so as a quiet line in a neutral
 * well - never a disabled brand button, which at half opacity was a muddy
 * orange bar that still looked pressable.
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
	const gate = useIdentityGate();
	const verify = useVerifyIdentitySheet();
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
			void signInAndReturn(`/events/${id}`);
			return;
		}
		if (!isVolunteer) {
			toast.info(
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
					// The sheet closing is the only other sign anything happened.
					toast.success(
						`Application sent to ${event?.organization.organizationName ?? "the organiser"}. You'll hear back in Activity.`,
						{
							label: "View",
							onPress: () => router.push("/(volunteer)/activity"),
						},
					);
				},
				onError: (error) => toast.error(apiErrorMessage(error)),
			},
		);
	};

	const onWithdraw = async () => {
		const ok = await confirm({
			title: "Withdraw your application?",
			message:
				"Your place goes back to the pool. You can apply again while applications are open.",
			confirmLabel: "Withdraw",
			cancelLabel: "Keep it",
		});
		if (!ok) return;
		withdraw.mutate(undefined, {
			onSuccess: () => toast.success("Application withdrawn."),
			onError: (error) => toast.error(apiErrorMessage(error)),
		});
	};

	const gutter = spacing[5];

	/* The action, in whichever state the event is in ------------------------- */
	let action: React.ReactNode = null;
	if (event) {
		if (activeApplication) {
			const status = activeApplication.status;
			action = (
				<View
					style={{
						flexDirection: isDesktop ? "column" : "row",
						alignItems: isDesktop ? "stretch" : "center",
						gap: spacing[3],
					}}
				>
					<View style={{ flex: isDesktop ? undefined : 1, minWidth: 0 }}>
						<Label weight="semibold" numberOfLines={1}>
							{status === "ACCEPTED"
								? "You're confirmed"
								: status === "PENDING"
									? "Application sent"
									: "Not accepted this time"}
						</Label>
						{/* What happens next, in order - "turn up" alone left an accepted
						    volunteer asking how they would hear the details. */}
						<Caption color="tertiary" numberOfLines={isDesktop ? 4 : 2}>
							{status === "ACCEPTED"
								? "The organiser has your phone number and will message the details. Once they mark you present, your certificate appears in Profile."
								: status === "PENDING"
									? "The organiser reviews it next. You'll get an update in Activity."
									: "Thanks for offering. Other events are looking for people."}
						</Caption>
					</View>
					{status === "REJECTED" ? (
						<Button
							variant="outline"
							size={isDesktop ? "default" : "sm"}
							onPress={() => router.push("/events")}
						>
							Find events
						</Button>
					) : (
						<Button
							variant="outline"
							size={isDesktop ? "default" : "sm"}
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
			action = (
				<ClosedState
					title="Applications closed"
					description={
						event.applicationDeadline
							? `Closed ${formatDateTime(event.applicationDeadline)}.`
							: "This event has already started."
					}
				/>
			);
		} else if (remaining === 0) {
			action = (
				<ClosedState
					title="All places filled"
					description={`All ${event.volunteersNeeded} volunteers are confirmed.`}
				/>
			);
		} else {
			action = (
				<Button onPress={startApply} loading={apply.isPending}>
					{email ? "Apply to volunteer" : "Sign in to apply"}
				</Button>
			);
		}
	}

	const place = event
		? [event.venue, event.city, event.state].filter(Boolean).join(", ")
		: "";

	// An array, not a fragment: `ListGroup` draws its hairlines between children.
	const facts = event
		? [
				<Fact
					key="when"
					icon={CalendarDays}
					label={formatDateRange(event.startAt, event.endAt)}
					hint="When"
				/>,
				place ? (
					<Fact key="where" icon={MapPin} label={place} hint="Where" />
				) : null,
				<Fact
					key="places"
					icon={Users}
					label={
						remaining > 0
							? `${remaining} of ${event.volunteersNeeded} places left`
							: `All ${event.volunteersNeeded} places filled`
					}
					hint={`${event.acceptedCount} confirmed so far`}
				/>,
				event.applicationDeadline ? (
					<Fact
						key="deadline"
						icon={Clock}
						label={
							deadlinePassed
								? `Closed ${formatDateTime(event.applicationDeadline)}`
								: `Apply by ${formatDateTime(event.applicationDeadline)}`
						}
						hint="Applications"
					/>
				) : null,
			]
		: [];

	const organiserRow = event ? (
		<ListRow
			icon={Building2}
			label={event.organization.organizationName}
			hint="See the NGO"
			onPress={() => router.push(`/ngos/${event.organization.id}`)}
		/>
	) : null;

	const heading = event ? (
		<View style={{ gap: spacing[1], marginBottom: spacing[5] }}>
			<Caption color="secondary">{event.organization.organizationName}</Caption>
			{isDesktop ? (
				<Title accessibilityRole="header">{event.title}</Title>
			) : (
				<H3 accessibilityRole="header">{event.title}</H3>
			)}
			{activeApplication ? (
				<View style={{ flexDirection: "row", marginTop: spacing[2] }}>
					<StatusPill
						label={`Your application: ${humanizeStatus(activeApplication.status)}`}
						tone={applicationTone(activeApplication.status)}
					/>
				</View>
			) : null}
		</View>
	) : null;

	const about = event ? (
		<>
			<SectionTitle>About this event</SectionTitle>
			<Body color="secondary" style={{ marginBottom: spacing[6] }}>
				{event.description}
			</Body>

			{activeApplication?.reviewNote ? (
				<Surface style={{ marginBottom: spacing[6] }}>
					<Caption color="tertiary">Note from the organiser</Caption>
					<Body color="secondary" style={{ marginTop: spacing[1] }}>
						"{activeApplication.reviewNote}"
					</Body>
				</Surface>
			) : null}
		</>
	) : null;

	return (
		<View style={{ flex: 1, backgroundColor: colors.background.warm }}>
			{/* Header row: the back target and where it leads, on the page grid. */}
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
					<BackButton fallbackHref="/events" />
					{isDesktop ? (
						<Caption color="tertiary" numberOfLines={1} style={{ flex: 1 }}>
							Events
						</Caption>
					) : null}
				</View>
			</View>

			{query.isLoading ? (
				<LoadingState />
			) : query.isError || !event ? (
				<ErrorState
					title="Event not available"
					message={apiErrorMessage(
						query.error,
						"This event is no longer available.",
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
							<SectionTitle>Organiser</SectionTitle>
							<ListGroup>{organiserRow}</ListGroup>
						</View>

						<View style={[ASIDE, STICKY]}>
							<ListGroup>
								{facts}
								<View key="action" style={{ padding: spacing[4] }}>
									{action}
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

					{action ? (
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
							{action}
						</View>
					) : null}
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
						disabled={gate.blocked}
						accessibilityLabel="Send application"
					>
						Send application
					</Button>
				}
			>
				<View style={{ paddingTop: spacing[2], paddingBottom: spacing[2] }}>
					<VerificationNote
						onNavigate={() => setApplyOpen(false)}
						onVerify={verify.open}
					/>
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
			{verify.sheet}
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
