import { useLocalSearchParams, useRouter } from "expo-router";
import { CalendarDays, MapPin, Users } from "lucide-react-native";
import { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { BackButton } from "@/components/back-button";
import { ErrorState, LoadingState, Surface } from "@/components/screen-shell";
import {
	applicationTone,
	humanizeStatus,
	StatusPill,
} from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Body, Caption, H2, Label } from "@/components/ui/typography";
import {
	useApplyToEvent,
	usePublicEvent,
	useWithdrawApplication,
} from "@/hooks/use-events";
import { useMe } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";
import { formatDateRange, formatDateTime } from "@/lib/format";
import { useAuthStore } from "@/store/auth-store";

export default function EventDetail() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const email = useAuthStore((s) => s.email);
	const [message, setMessage] = useState("");

	const query = usePublicEvent(id);
	const { data: me } = useMe(!!email);
	const apply = useApplyToEvent(id ?? "");
	const withdraw = useWithdrawApplication(id ?? "");

	const event = query.data;
	const application = event?.myApplication ?? null;
	const remaining = event
		? Math.max(event.volunteersNeeded - event.acceptedCount, 0)
		: 0;

	const isVolunteer = me?.roles.includes("volunteer") ?? false;
	const deadlinePassed = event
		? new Date(event.applicationDeadline ?? event.startAt) < new Date()
		: false;

	const onApply = () => {
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
		apply.mutate(
			{ message: message.trim() || undefined },
			{
				onSuccess: () => setMessage(""),
				onError: (error) =>
					Alert.alert("Could not apply", apiErrorMessage(error)),
			},
		);
	};

	const onWithdraw = () => {
		Alert.alert("Withdraw application", "You can apply again later.", [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Withdraw",
				style: "destructive",
				onPress: () =>
					withdraw.mutate(undefined, {
						onError: (error) =>
							Alert.alert("Could not withdraw", apiErrorMessage(error)),
					}),
			},
		]);
	};

	return (
		<View style={{ flex: 1, backgroundColor: colors.background.warm }}>
			<View
				style={{
					paddingHorizontal: spacing[6],
					paddingTop: spacing[8],
					paddingBottom: spacing[2],
				}}
			>
				<BackButton style={{ marginBottom: 0 }} />
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
				<ScrollView
					contentContainerStyle={{
						paddingHorizontal: spacing[6],
						paddingBottom: spacing[12],
					}}
					keyboardShouldPersistTaps="handled"
				>
					<Caption color="secondary" style={{ marginBottom: spacing[2] }}>
						{event.organization.organizationName}
					</Caption>
					<H2 style={{ marginBottom: spacing[4] }}>{event.title}</H2>

					<Surface style={{ marginBottom: spacing[5] }}>
						<DetailRow
							icon={CalendarDays}
							label={formatDateRange(event.startAt, event.endAt)}
						/>
						{(event.venue || event.city) && (
							<DetailRow
								icon={MapPin}
								label={[event.venue, event.city, event.state]
									.filter(Boolean)
									.join(", ")}
							/>
						)}
						<DetailRow
							icon={Users}
							label={`${event.acceptedCount} of ${event.volunteersNeeded} volunteers confirmed`}
							last
						/>
					</Surface>

					<Body weight="bold" style={{ marginBottom: spacing[2] }}>
						About this event
					</Body>
					<Body color="secondary" style={{ marginBottom: spacing[5] }}>
						{event.description}
					</Body>

					{event.applicationDeadline && (
						<Caption color="tertiary" style={{ marginBottom: spacing[5] }}>
							Applications close {formatDateTime(event.applicationDeadline)}
						</Caption>
					)}

					{application && application.status !== "WITHDRAWN" ? (
						<Surface>
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									justifyContent: "space-between",
									marginBottom: spacing[2],
								}}
							>
								<Body weight="bold">Your application</Body>
								<StatusPill
									label={humanizeStatus(application.status)}
									tone={applicationTone(application.status)}
								/>
							</View>
							<Caption color="tertiary">
								{application.status === "PENDING"
									? "The organizer will review this and get back to you."
									: application.status === "ACCEPTED"
										? "You're confirmed. See you there!"
										: "This application wasn't accepted this time."}
							</Caption>
							{application.reviewNote && (
								<Caption color="secondary" style={{ marginTop: spacing[2] }}>
									“{application.reviewNote}”
								</Caption>
							)}
							{application.status !== "REJECTED" && (
								<Button
									variant="outline"
									onPress={onWithdraw}
									loading={withdraw.isPending}
									style={{ marginTop: spacing[4] }}
								>
									Withdraw
								</Button>
							)}
						</Surface>
					) : deadlinePassed ? (
						<Surface>
							<Body weight="bold">Applications closed</Body>
							<Caption color="tertiary">
								This event is no longer accepting volunteers.
							</Caption>
						</Surface>
					) : remaining === 0 ? (
						<Surface>
							<Body weight="bold">All places filled</Body>
							<Caption color="tertiary">
								Every volunteer place for this event has been taken.
							</Caption>
						</Surface>
					) : (
						<View>
							<Label style={{ marginBottom: spacing[1.5] }}>
								Message to the organizer{" "}
								<Caption color="tertiary">(optional)</Caption>
							</Label>
							<Input
								placeholder="Tell them why you'd like to help, and your availability"
								value={message}
								onChangeText={setMessage}
								multiline
								style={{
									borderWidth: 0,
									borderRadius: 12,
									backgroundColor: colors.background.tertiary,
									paddingVertical: spacing[3.5],
									minHeight: 96,
									textAlignVertical: "top",
								}}
							/>
							<Button
								onPress={onApply}
								loading={apply.isPending}
								style={{ marginTop: spacing[4] }}
							>
								{email ? "Apply to volunteer" : "Sign in to apply"}
							</Button>
						</View>
					)}
				</ScrollView>
			)}
		</View>
	);
}

function DetailRow({
	icon: Icon,
	label,
	last,
}: {
	icon: typeof CalendarDays;
	label: string;
	last?: boolean;
}) {
	const { colors, spacing } = useTheme();

	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: spacing[3],
				paddingBottom: last ? 0 : spacing[3],
				marginBottom: last ? 0 : spacing[3],
				borderBottomWidth: last ? 0 : 1,
				borderBottomColor: colors.border.light,
			}}
		>
			<Icon size={16} color={colors.text.tertiary as string} />
			<Caption color="secondary" style={{ flex: 1 }}>
				{label}
			</Caption>
		</View>
	);
}
