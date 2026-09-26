import { type DonationStatus, formatMinor } from "@nabhya/shared";
import { useRouter } from "expo-router";
import { HandCoins, Lock } from "lucide-react-native";
import { View } from "react-native";
import { InitialAvatar } from "@/components/initial-avatar";
import { PagedList, usePagedQuery } from "@/components/paged-list";
import {
	EmptyState,
	MetricRow,
	Screen,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Body, BodySmall, Caption } from "@/components/ui/typography";
import { useOrgAccess } from "@/hooks/use-org-access";
import { useTheme } from "@/hooks/use-theme";
import { useGridColumns } from "@/hooks/useMedia";
import { donationsApi, queryKeys } from "@/lib/api";
import { formatDate, formatRelative } from "@/lib/format";
import type { OrgDonation } from "@/lib/types";

/** Every state but COMPLETED, which needs no pill - the amount says it. */
const STATUS_PILL: Record<
	Exclude<DonationStatus, "COMPLETED">,
	{ label: string; tone: "warning" | "error" | "neutral" }
> = {
	PENDING: { label: "Confirming", tone: "warning" },
	FAILED: { label: "Failed", tone: "error" },
	REFUNDED: { label: "Refunded", tone: "neutral" },
};

/**
 * Money received through Nabhya. Read-only by design: a donation only becomes
 * COMPLETED through Razorpay's signed webhook, so there is nothing here for
 * the organisation to approve - just to see, thank, and reconcile.
 */
export default function OrgDonations() {
	const { spacing } = useTheme();
	const router = useRouter();
	const access = useOrgAccess();
	// Money is visible to owners, admins and viewers only (`money.view`); for
	// anyone else the endpoint 403s, which used to surface as an error screen.
	const moneyBlocked = access.blocked("money.view");
	const { query, items, first, loadMore } = usePagedQuery({
		queryKey: queryKeys.orgDonations({}),
		fetchPage: (page) => donationsApi.listForOrg({ page, limit: 20 }),
		enabled: !moneyBlocked,
	});

	const stats = first?.stats;
	const columns = useGridColumns();

	const numbers =
		stats && (stats.completedCount > 0 || stats.pendingCount > 0) ? (
			<View style={{ marginBottom: spacing[5] }}>
				<MetricRow
					stats={[
						{ label: "Received", value: formatMinor(stats.totalMinor) },
						{ label: "Donors", value: stats.donorCount },
						{ label: "Donations", value: stats.completedCount },
					]}
				/>
				{stats.pendingCount > 0 && (
					<Caption color="quaternary" style={{ marginTop: spacing[2] }}>
						{stats.pendingCount} payment{stats.pendingCount === 1 ? "" : "s"}{" "}
						still confirming with Razorpay.
					</Caption>
				)}
			</View>
		) : null;

	return (
		<Screen>
			<ScreenHeader
				back
				title="Donations"
				subtitle="Money received through Nabhya"
			/>

			{moneyBlocked ? (
				<EmptyState
					icon={Lock}
					title={
						access.isSuspended
							? "Unavailable while suspended"
							: "Donations are visible to owners, admins and viewers"
					}
					description={moneyBlocked}
				/>
			) : (
				<PagedList
					query={query}
					items={items}
					loadMore={loadMore}
					numColumns={columns}
					noun="donations"
					header={numbers ?? undefined}
					keyExtractor={(item) => item.id}
					renderItem={(item) => <DonationRow donation={item} />}
					empty={
						<EmptyState
							icon={HandCoins}
							title="No donations yet"
							description="Donations come from your public profile, with the amount, the donor's name (unless they chose to stay anonymous) and any message they left. A profile with a logo, a description and a published report gets far more of them."
							// An empty state with nothing to do is a dead end. The
							// profile is the page donors actually give from, so it is
							// the one useful thing to offer here.
							action={
								<Button
									variant="outline"
									onPress={() => router.push("/(ngo)/profile")}
								>
									Check your profile
								</Button>
							}
						/>
					}
				/>
			)}
		</Screen>
	);
}

function DonationRow({ donation }: { donation: OrgDonation }) {
	const { spacing } = useTheme();
	// Anonymity is applied server-side; donorName arrives null.
	const donor = donation.donorName ?? "Anonymous donor";
	const completed = donation.status === "COMPLETED";

	return (
		<Surface>
			<View
				style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}
			>
				<InitialAvatar name={donation.donorName} />
				<View style={{ flex: 1, minWidth: 0 }}>
					<Body weight="bold" numberOfLines={1}>
						{formatMinor(donation.amountMinor)}
					</Body>
					<Caption color="tertiary" numberOfLines={1}>
						{donor} ·{" "}
						{formatRelative(donation.completedAt ?? donation.createdAt)}
					</Caption>
				</View>
				{donation.status !== "COMPLETED" && (
					<StatusPill
						label={STATUS_PILL[donation.status].label}
						tone={STATUS_PILL[donation.status].tone}
					/>
				)}
			</View>

			{donation.message && (
				<BodySmall color="secondary" style={{ marginTop: spacing[3] }}>
					“{donation.message}”
				</BodySmall>
			)}

			{completed && donation.receiptNumber && (
				<Caption color="quaternary" style={{ marginTop: spacing[2] }}>
					Receipt {donation.receiptNumber} ·{" "}
					{formatDate(donation.completedAt ?? donation.createdAt)}
				</Caption>
			)}
		</Surface>
	);
}
