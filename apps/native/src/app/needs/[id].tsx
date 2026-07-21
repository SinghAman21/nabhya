import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Clock, MapPin, Package } from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { ErrorState, LoadingState, Surface } from "@/components/screen-shell";
import {
	humanizeStatus,
	pledgeTone,
	StatusPill,
	urgencyTone,
} from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Body, Caption, H2, Label } from "@/components/ui/typography";
import { useCreatePledge, usePublicNeed } from "@/hooks/use-needs";
import { useMe } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";
import { formatDateTime, formatProgress } from "@/lib/format";
import { useAuthStore } from "@/store/auth-store";

export default function NeedDetail() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const email = useAuthStore((s) => s.email);
	const [quantity, setQuantity] = useState("");
	const [message, setMessage] = useState("");

	const query = usePublicNeed(id);
	const { data: me } = useMe(!!email);
	const pledge = useCreatePledge(id ?? "");

	const need = query.data;
	const myPledge = need?.myPledge ?? null;
	const isVolunteer = me?.roles.includes("volunteer") ?? false;
	const isWant = need?.type === "WANT";

	const onPledge = () => {
		if (!email) {
			router.push("/(auth)/login");
			return;
		}
		if (!isVolunteer) {
			Alert.alert(
				"Volunteer account needed",
				"Pledges come from volunteer accounts. Organisation accounts manage their own posts instead.",
			);
			return;
		}
		pledge.mutate(
			{
				quantity: quantity ? Number(quantity) : undefined,
				message: message.trim() || undefined,
			},
			{
				onSuccess: () => {
					setQuantity("");
					setMessage("");
					Alert.alert(
						"Thanks!",
						isWant
							? "The NGO will review your offer and get in touch."
							: "The NGO will confirm and arrange handover.",
					);
				},
				onError: (error) =>
					Alert.alert("Could not respond", apiErrorMessage(error)),
			},
		);
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
				<Pressable onPress={() => router.back()} hitSlop={12}>
					<ArrowLeft size={22} color={colors.text.secondary as string} />
				</Pressable>
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
				<ScrollView
					contentContainerStyle={{
						paddingHorizontal: spacing[6],
						paddingBottom: spacing[12],
					}}
					keyboardShouldPersistTaps="handled"
				>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: spacing[2],
							marginBottom: spacing[2],
						}}
					>
						<StatusPill
							label={isWant ? "Needs this" : "Giving away"}
							tone={isWant ? "info" : "success"}
						/>
						{need.urgency === "HIGH" && (
							<StatusPill label="Urgent" tone={urgencyTone(need.urgency)} />
						)}
						{need.status !== "OPEN" && (
							<StatusPill label={humanizeStatus(need.status)} tone="neutral" />
						)}
					</View>

					<Pressable
						onPress={() =>
							router.push(`/organizations/${need.organization.id}`)
						}
					>
						<Caption
							color={colors.primary.main as string}
							weight="medium"
							style={{ marginBottom: spacing[2] }}
						>
							{need.organization.organizationName}
						</Caption>
					</Pressable>
					<H2 style={{ marginBottom: spacing[4] }}>{need.title}</H2>

					<Surface style={{ marginBottom: spacing[5] }}>
						<DetailRow
							icon={Package}
							label={formatProgress(
								need.fulfilledQuantity,
								need.quantity,
								need.unit,
							)}
						/>
						{(need.city || need.state) && (
							<DetailRow
								icon={MapPin}
								label={[need.city, need.state].filter(Boolean).join(", ")}
								last={!need.expiresAt}
							/>
						)}
						{need.expiresAt && (
							<DetailRow
								icon={Clock}
								label={`Open until ${formatDateTime(need.expiresAt)}`}
								last
							/>
						)}
					</Surface>

					<Body weight="bold" style={{ marginBottom: spacing[2] }}>
						Details
					</Body>
					<Body color="secondary" style={{ marginBottom: spacing[5] }}>
						{need.description}
					</Body>

					{myPledge ? (
						<Surface>
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									justifyContent: "space-between",
									marginBottom: spacing[2],
								}}
							>
								<Body weight="bold">Your response</Body>
								<StatusPill
									label={humanizeStatus(myPledge.status)}
									tone={pledgeTone(myPledge.status)}
								/>
							</View>
							<Caption color="tertiary">
								{myPledge.status === "PENDING"
									? "The NGO will review this and get in touch."
									: myPledge.status === "ACCEPTED"
										? "Accepted — the NGO will coordinate the handover with you."
										: myPledge.status === "COMPLETED"
											? "Completed. Thank you!"
											: humanizeStatus(myPledge.status)}
							</Caption>
							{myPledge.quantity != null && (
								<Caption color="secondary" style={{ marginTop: spacing[2] }}>
									You offered {myPledge.quantity}
									{need.unit ? ` ${need.unit}` : ""}
								</Caption>
							)}
						</Surface>
					) : need.status !== "OPEN" ? (
						<Surface>
							<Body weight="bold">No longer open</Body>
							<Caption color="tertiary">
								This post isn't accepting responses any more.
							</Caption>
						</Surface>
					) : (
						<View>
							{need.quantity != null && (
								<>
									<Label style={{ marginBottom: spacing[1.5] }}>
										How many{need.unit ? ` ${need.unit}` : ""}?{" "}
										<Caption color="tertiary">(optional)</Caption>
									</Label>
									<Input
										placeholder="e.g. 10"
										value={quantity}
										onChangeText={(v) => setQuantity(v.replace(/\D/g, ""))}
										keyboardType="number-pad"
										style={{
											borderWidth: 0,
											borderRadius: 12,
											backgroundColor: colors.background.tertiary,
											paddingVertical: spacing[3.5],
											maxWidth: 160,
											marginBottom: spacing[4],
										}}
									/>
								</>
							)}
							<Label style={{ marginBottom: spacing[1.5] }}>
								Message to the NGO{" "}
								<Caption color="tertiary">(optional)</Caption>
							</Label>
							<Input
								placeholder={
									isWant
										? "What you can contribute, and how to reach you"
										: "Why you'd like this, and how you'll collect it"
								}
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
								onPress={onPledge}
								loading={pledge.isPending}
								style={{ marginTop: spacing[4] }}
							>
								{!email
									? "Sign in to respond"
									: isWant
										? "I can help with this"
										: "I'd like this"}
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
	icon: typeof MapPin;
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
