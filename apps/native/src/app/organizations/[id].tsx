import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Globe, MapPin, Users } from "lucide-react-native";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { ErrorState, LoadingState, Surface } from "@/components/screen-shell";
import { StatusPill, urgencyTone } from "@/components/status-pill";
import { Body, Caption, H2, H3 } from "@/components/ui/typography";
import { usePublicEvents } from "@/hooks/use-events";
import { usePublicNeeds } from "@/hooks/use-needs";
import { usePublicOrganization } from "@/hooks/use-organizations";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";
import { formatDateRange, formatProgress } from "@/lib/format";

/** Public profile of a verified NGO: who they are, plus live events and needs. */
export default function OrganizationProfile() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const { colors, spacing } = useTheme();
	const router = useRouter();

	const query = usePublicOrganization(id);
	const events = usePublicEvents({ organizationId: id, limit: 5 });
	const needs = usePublicNeeds({ organizationId: id, limit: 5 });

	const organization = query.data;
	const location = [organization?.city, organization?.state]
		.filter(Boolean)
		.join(", ");

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
			) : query.isError || !organization ? (
				<ErrorState
					message={apiErrorMessage(
						query.error,
						"This organization is no longer available.",
					)}
					onRetry={() => query.refetch()}
				/>
			) : (
				<ScrollView
					contentContainerStyle={{
						paddingHorizontal: spacing[6],
						paddingBottom: spacing[12],
					}}
				>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: spacing[3],
							marginBottom: spacing[4],
						}}
					>
						<View
							style={{
								width: 56,
								height: 56,
								borderRadius: 28,
								backgroundColor: colors.primary.main,
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<H3 color={colors.primary.contrast as string}>
								{organization.organizationName[0]?.toUpperCase()}
							</H3>
						</View>
						<View style={{ flex: 1 }}>
							<H2 numberOfLines={2}>{organization.organizationName}</H2>
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									gap: spacing[2],
									marginTop: spacing[1],
								}}
							>
								<StatusPill label="Verified" tone="success" />
								{organization.foundingYear ? (
									<Caption color="tertiary">
										Since {organization.foundingYear}
									</Caption>
								) : null}
							</View>
						</View>
					</View>

					<OrgFacts organization={organization} location={location} />

					{(organization.categories.length ?? 0) > 0 && (
						<View
							style={{
								flexDirection: "row",
								flexWrap: "wrap",
								gap: spacing[2],
								marginBottom: spacing[5],
							}}
						>
							{organization.categories.map((category) => (
								<StatusPill
									key={category.id}
									label={category.name}
									tone="info"
								/>
							))}
						</View>
					)}

					{organization.description ? (
						<>
							<Body weight="bold" style={{ marginBottom: spacing[2] }}>
								About
							</Body>
							<Body color="secondary" style={{ marginBottom: spacing[5] }}>
								{organization.description}
							</Body>
						</>
					) : null}

					{organization.mission ? (
						<>
							<Body weight="bold" style={{ marginBottom: spacing[2] }}>
								Mission
							</Body>
							<Body color="secondary" style={{ marginBottom: spacing[5] }}>
								{organization.mission}
							</Body>
						</>
					) : null}

					<Body weight="bold" style={{ marginBottom: spacing[3] }}>
						Upcoming events
					</Body>
					{(events.data?.items.length ?? 0) === 0 ? (
						<Surface style={{ marginBottom: spacing[5] }}>
							<Caption color="tertiary">No upcoming events right now.</Caption>
						</Surface>
					) : (
						<View style={{ gap: spacing[3], marginBottom: spacing[5] }}>
							{events.data?.items.map((event) => (
								<Surface
									key={event.id}
									onPress={() => router.push(`/events/${event.id}`)}
								>
									<Body weight="bold" numberOfLines={1}>
										{event.title}
									</Body>
									<Caption color="tertiary" style={{ marginTop: 2 }}>
										{formatDateRange(event.startAt, event.endAt)}
										{event.city ? ` · ${event.city}` : ""}
									</Caption>
								</Surface>
							))}
						</View>
					)}

					<Body weight="bold" style={{ marginBottom: spacing[3] }}>
						Open needs
					</Body>
					{(needs.data?.items.length ?? 0) === 0 ? (
						<Surface>
							<Caption color="tertiary">Nothing posted right now.</Caption>
						</Surface>
					) : (
						<View style={{ gap: spacing[3] }}>
							{needs.data?.items.map((need) => (
								<Surface
									key={need.id}
									onPress={() => router.push(`/needs/${need.id}`)}
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
											label={
												need.type === "WANT" ? "Needs this" : "Giving away"
											}
											tone={need.type === "WANT" ? "info" : "success"}
										/>
										{need.urgency === "HIGH" && (
											<StatusPill
												label="Urgent"
												tone={urgencyTone(need.urgency)}
											/>
										)}
									</View>
									<Body weight="bold" numberOfLines={1}>
										{need.title}
									</Body>
									<Caption color="secondary" style={{ marginTop: 2 }}>
										{formatProgress(
											need.fulfilledQuantity,
											need.quantity,
											need.unit,
										)}
									</Caption>
								</Surface>
							))}
						</View>
					)}
				</ScrollView>
			)}
		</View>
	);
}

function OrgFacts({
	organization,
	location,
}: {
	organization: { teamSize: number | null; website: string | null };
	location: string;
}) {
	const { spacing } = useTheme();

	const rows: Array<{
		icon: typeof MapPin;
		label: string;
		onPress?: () => void;
	}> = [];
	if (location) rows.push({ icon: MapPin, label: location });
	if (organization.teamSize) {
		rows.push({ icon: Users, label: `Team of ${organization.teamSize}` });
	}
	if (organization.website) {
		const website = organization.website;
		rows.push({
			icon: Globe,
			label: website,
			onPress: () => Linking.openURL(website),
		});
	}
	if (rows.length === 0) return null;

	return (
		<Surface style={{ marginBottom: spacing[5] }}>
			{rows.map((row, index) => {
				const detail = (
					<DetailRow
						key={row.label}
						icon={row.icon}
						label={row.label}
						last={index === rows.length - 1}
					/>
				);
				return row.onPress ? (
					<Pressable key={row.label} onPress={row.onPress}>
						{detail}
					</Pressable>
				) : (
					detail
				);
			})}
		</Surface>
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
			<Caption color="secondary" style={{ flex: 1 }} numberOfLines={1}>
				{label}
			</Caption>
		</View>
	);
}
