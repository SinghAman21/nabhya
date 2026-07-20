import { formatFinancialYear } from "@nabhya/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
	ArrowLeft,
	Award,
	Bookmark,
	Clock,
	FileText,
	Users,
} from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { ReviewSheet } from "@/components/review-sheet";
import {
	ErrorState,
	FilterChips,
	LoadingState,
	Surface,
} from "@/components/screen-shell";
import {
	humanizeStatus,
	StatusPill,
	verificationTone,
} from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Body, Caption, H2, H3 } from "@/components/ui/typography";
import {
	useAnnouncements,
	useFinancialReports,
	useOrganization,
	useOrganizationImpact,
} from "@/hooks/use-directory";
import { useOpenDocument } from "@/hooks/use-documents";
import { useReviews, useToggleBookmark } from "@/hooks/use-engagement";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";
import { formatDate, formatRelative } from "@/lib/format";
import { useAuthStore } from "@/store/auth-store";

type Tab = "about" | "updates" | "reviews" | "transparency";

const TABS: Array<{ value: Tab; label: string }> = [
	{ value: "about", label: "About" },
	{ value: "updates", label: "Updates" },
	{ value: "reviews", label: "Reviews" },
	{ value: "transparency", label: "Transparency" },
];

export default function NgoProfilePage() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const [tab, setTab] = useState<Tab>("about");
	const [reviewOpen, setReviewOpen] = useState(false);

	const email = useAuthStore((s) => s.email);
	const org = useOrganization(id);
	const impact = useOrganizationImpact(id);
	const toggleBookmark = useToggleBookmark();

	const onBookmark = () => {
		if (!email) {
			router.push("/(auth)/login");
			return;
		}
		toggleBookmark.mutate(id, {
			onError: (error) => Alert.alert("Could not save", apiErrorMessage(error)),
		});
	};

	return (
		<View style={{ flex: 1, backgroundColor: colors.background.warm }}>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					paddingHorizontal: spacing[6],
					paddingTop: spacing[8],
					paddingBottom: spacing[2],
				}}
			>
				<Pressable onPress={() => router.back()} hitSlop={12}>
					<ArrowLeft size={22} color={colors.text.secondary as string} />
				</Pressable>
				<Pressable onPress={onBookmark} hitSlop={12}>
					<Bookmark size={22} color={colors.text.secondary as string} />
				</Pressable>
			</View>

			{org.isLoading ? (
				<LoadingState />
			) : org.isError || !org.data ? (
				<ErrorState
					message={apiErrorMessage(org.error, "This NGO is not available.")}
					onRetry={() => org.refetch()}
				/>
			) : (
				<ScrollView
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{
						paddingHorizontal: spacing[6],
						paddingBottom: spacing[12],
					}}
				>
					<H2 style={{ marginBottom: spacing[2] }}>
						{org.data.organizationName}
					</H2>
					<View
						style={{
							flexDirection: "row",
							flexWrap: "wrap",
							gap: spacing[2],
							marginBottom: spacing[3],
						}}
					>
						<StatusPill
							label={humanizeStatus(org.data.verificationStatus)}
							tone={verificationTone(org.data.verificationStatus)}
						/>
						{org.data.categories?.map((category) => (
							<StatusPill key={category.id} label={category.name} tone="info" />
						))}
					</View>
					<Caption color="tertiary" style={{ marginBottom: spacing[5] }}>
						{[org.data.city, org.data.state].filter(Boolean).join(", ")}
						{org.data.foundingYear ? ` · since ${org.data.foundingYear}` : ""}
					</Caption>

					{/* Impact is the headline: what this NGO has actually done. */}
					{impact.data && (
						<View
							style={{
								flexDirection: "row",
								gap: spacing[2],
								marginBottom: spacing[5],
							}}
						>
							<ImpactTile
								icon={Users}
								value={impact.data.volunteersEngaged}
								label="volunteers"
							/>
							<ImpactTile
								icon={Clock}
								value={impact.data.volunteerHours}
								label="hours given"
							/>
							<ImpactTile
								icon={Award}
								value={impact.data.eventsHosted}
								label="events"
							/>
						</View>
					)}

					<FilterChips options={TABS} value={tab} onChange={setTab} />

					{tab === "about" && <AboutTab organization={org.data} />}
					{tab === "updates" && <UpdatesTab organizationId={id} />}
					{tab === "reviews" && (
						<ReviewsTab
							organizationId={id}
							onWrite={() =>
								email ? setReviewOpen(true) : router.push("/(auth)/login")
							}
						/>
					)}
					{tab === "transparency" && <TransparencyTab organizationId={id} />}
				</ScrollView>
			)}

			<ReviewSheet
				organizationId={id}
				organizationName={org.data?.organizationName ?? ""}
				visible={reviewOpen}
				onClose={() => setReviewOpen(false)}
			/>
		</View>
	);
}

function ImpactTile({
	icon: Icon,
	value,
	label,
}: {
	icon: typeof Users;
	value: number;
	label: string;
}) {
	const { colors, spacing } = useTheme();
	return (
		<Surface style={{ flex: 1 }}>
			<Icon size={16} color={colors.text.tertiary as string} />
			<H3 style={{ marginTop: spacing[1] }}>{value}</H3>
			<Caption color="tertiary">{label}</Caption>
		</Surface>
	);
}

function AboutTab({
	organization,
}: {
	organization: NonNullable<ReturnType<typeof useOrganization>["data"]>;
}) {
	const { spacing } = useTheme();
	return (
		<View>
			{organization.description && (
				<Body color="secondary" style={{ marginBottom: spacing[4] }}>
					{organization.description}
				</Body>
			)}
			{organization.mission && (
				<>
					<Body weight="bold" style={{ marginBottom: spacing[1] }}>
						Mission
					</Body>
					<Body color="secondary" style={{ marginBottom: spacing[4] }}>
						{organization.mission}
					</Body>
				</>
			)}
			<Surface>
				<Row label="Type" value={humanizeStatus(organization.orgType)} />
				<Row label="Registration" value={organization.registrationNumber} />
				<Row
					label="Team size"
					value={organization.teamSize ? String(organization.teamSize) : null}
				/>
				<Row label="Website" value={organization.website} last />
			</Surface>
		</View>
	);
}

function UpdatesTab({ organizationId }: { organizationId: string }) {
	const { spacing } = useTheme();
	const query = useAnnouncements(organizationId);

	if (query.isLoading) return <LoadingState />;
	const items = query.data?.items ?? [];

	if (items.length === 0) {
		return (
			<Caption color="tertiary" style={{ paddingVertical: spacing[6] }}>
				This organization hasn't posted any updates yet.
			</Caption>
		);
	}

	return (
		<View style={{ gap: spacing[3] }}>
			{items.map((item) => (
				<Surface key={item.id}>
					{item.isPinned && <StatusPill label="Pinned" tone="info" />}
					<Body
						weight="bold"
						style={{ marginTop: item.isPinned ? spacing[2] : 0 }}
					>
						{item.title}
					</Body>
					<Caption color="secondary" style={{ marginTop: spacing[1] }}>
						{item.body}
					</Caption>
					<Caption color="quaternary" style={{ marginTop: spacing[2] }}>
						{formatRelative(item.publishedAt ?? item.createdAt)}
					</Caption>
				</Surface>
			))}
		</View>
	);
}

function ReviewsTab({
	organizationId,
	onWrite,
}: {
	organizationId: string;
	onWrite: () => void;
}) {
	const { colors, spacing } = useTheme();
	const query = useReviews(organizationId);

	if (query.isLoading) return <LoadingState />;

	const summary = query.data?.summary;
	const items = query.data?.items ?? [];

	return (
		<View>
			<Surface style={{ marginBottom: spacing[4] }}>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						justifyContent: "space-between",
					}}
				>
					<View>
						<H3>{summary?.average ? summary.average.toFixed(1) : "—"}</H3>
						<Caption color="tertiary">
							{summary?.count ?? 0} review{summary?.count === 1 ? "" : "s"}
						</Caption>
					</View>
					<Button size="sm" variant="outline" onPress={onWrite}>
						Write a review
					</Button>
				</View>
			</Surface>

			{items.length === 0 ? (
				<Caption color="tertiary" style={{ paddingVertical: spacing[4] }}>
					No reviews yet — be the first.
				</Caption>
			) : (
				<View style={{ gap: spacing[3] }}>
					{items.map((review) => (
						<Surface key={review.id}>
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									justifyContent: "space-between",
								}}
							>
								<Body weight="bold" numberOfLines={1} style={{ flex: 1 }}>
									{review.user.fullName ?? "Volunteer"}
								</Body>
								<Caption color={colors.warning.main as string}>
									{"★".repeat(review.rating)}
									{"☆".repeat(5 - review.rating)}
								</Caption>
							</View>
							{review.body && (
								<Caption color="secondary" style={{ marginTop: spacing[2] }}>
									{review.body}
								</Caption>
							)}
							{review.reply && (
								<View
									style={{
										marginTop: spacing[3],
										paddingLeft: spacing[3],
										borderLeftWidth: 2,
										borderLeftColor: colors.border.medium,
									}}
								>
									<Caption weight="medium" color="tertiary">
										Response from the NGO
									</Caption>
									<Caption color="secondary">{review.reply}</Caption>
								</View>
							)}
						</Surface>
					))}
				</View>
			)}
		</View>
	);
}

function TransparencyTab({ organizationId }: { organizationId: string }) {
	const { colors, spacing } = useTheme();
	const query = useFinancialReports(organizationId);
	const openDocument = useOpenDocument();

	if (query.isLoading) return <LoadingState />;
	const reports = query.data ?? [];

	if (reports.length === 0) {
		return (
			<Caption color="tertiary" style={{ paddingVertical: spacing[6] }}>
				This organization hasn't published any financial reports yet.
			</Caption>
		);
	}

	return (
		<View style={{ gap: spacing[3] }}>
			{reports.map((report) => (
				<Surface key={report.id}>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: spacing[3],
						}}
					>
						<FileText size={18} color={colors.text.secondary as string} />
						<View style={{ flex: 1 }}>
							<Body weight="medium" numberOfLines={1}>
								{report.title}
							</Body>
							<Caption color="tertiary">
								{formatFinancialYear(report.financialYear)} ·{" "}
								{formatDate(report.createdAt)}
							</Caption>
						</View>
					</View>
					<Pressable
						onPress={() => openDocument.mutate(report.documentKey)}
						style={{ marginTop: spacing[2] }}
					>
						<Caption weight="medium" color={colors.primary.main as string}>
							{openDocument.isPending ? "Opening…" : "Open document"}
						</Caption>
					</Pressable>
				</Surface>
			))}
		</View>
	);
}

function Row({
	label,
	value,
	last,
}: {
	label: string;
	value?: string | null;
	last?: boolean;
}) {
	const { colors, spacing } = useTheme();
	return (
		<View
			style={{
				flexDirection: "row",
				justifyContent: "space-between",
				gap: spacing[4],
				paddingBottom: last ? 0 : spacing[2],
				marginBottom: last ? 0 : spacing[2],
				borderBottomWidth: last ? 0 : 1,
				borderBottomColor: colors.border.light,
			}}
		>
			<Caption color="tertiary">{label}</Caption>
			<Caption
				weight="medium"
				color={value ? "primary" : "quaternary"}
				style={{ flex: 1, textAlign: "right" }}
			>
				{value || "—"}
			</Caption>
		</View>
	);
}
