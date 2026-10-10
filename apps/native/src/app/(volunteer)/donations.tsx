import { formatMinor } from "@nabhya/shared";
import { useRouter } from "expo-router";
import { HandCoins, Package } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { PAGE_SIZE, PagedList, usePagedQuery } from "@/components/paged-list";
import {
	EmptyState,
	ErrorState,
	FilterChips,
	ListGroup,
	LoadingState,
	Screen,
	ScreenHeader,
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
import { Sheet } from "@/components/ui/sheet";
import { Body, Caption, H3, H5 } from "@/components/ui/typography";
import { useDonationReceipt } from "@/hooks/use-engagement";
import { useWithdrawPledge } from "@/hooks/use-needs";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage, donationsApi, needsApi, queryKeys } from "@/lib/api";
import { formatDateTime, formatRelative } from "@/lib/format";
import { READING_COLUMN } from "@/lib/reading-column";
import type { MyDonation } from "@/lib/types";

type Tab = "items" | "money";

const TABS: Array<{ value: Tab; label: string }> = [
	{ value: "items", label: "Items" },
	{ value: "money", label: "Money" },
];

/**
 * Everything the volunteer has given - item pledges and monetary donations.
 *
 * The two are rendered by separate components rather than one list with a
 * union type: their shapes share almost nothing, and forcing them together
 * needs casts that hide real mistakes. Reached from Profile, so it gets a back
 * button rather than a tab title.
 */
export default function Donations() {
	const [tab, setTab] = useState<Tab>("items");

	return (
		<Screen style={READING_COLUMN}>
			<ScreenHeader back title="Your giving" />

			<FilterChips options={TABS} value={tab} onChange={setTab} />

			{tab === "items" ? <ItemPledges /> : <MoneyDonations />}
		</Screen>
	);
}

function ItemPledges() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const withdraw = useWithdrawPledge();

	const confirmWithdraw = async (needId: string) => {
		const ok = await confirm({
			title: "Withdraw this pledge?",
			message:
				"The NGO will no longer see this offer, and they may already be counting on it.",
			confirmLabel: "Withdraw",
			cancelLabel: "Keep it",
		});
		if (!ok) return;
		withdraw.mutate(
			{ needId },
			{
				onSuccess: () => toast.success("Pledge withdrawn."),
				onError: (error) => toast.error(apiErrorMessage(error)),
			},
		);
	};

	const { query, items, loadMore } = usePagedQuery({
		queryKey: queryKeys.myPledges({ limit: PAGE_SIZE }),
		fetchPage: (page) => needsApi.myPledges({ page, limit: PAGE_SIZE }),
	});

	return (
		<PagedList
			query={query}
			items={items}
			loadMore={loadMore}
			loadingLabel="Loading your pledges"
			keyExtractor={(item) => item.id}
			empty={
				<EmptyState
					icon={Package}
					title="Nothing pledged yet"
					description="When an NGO asks for blankets, books or anything else, you can pledge them from Home. Your pledges are tracked here."
					action={
						<Button
							size="sm"
							variant="outline"
							onPress={() => router.push("/(volunteer)")}
						>
							See what's needed
						</Button>
					}
				/>
			}
			renderItem={(item) => {
				const amount = item.quantity
					? `${item.quantity}${item.need?.unit ? ` ${item.need.unit}` : ""}`
					: null;
				// Amber for waiting, green for "they said yes" - the same split
				// `applications.tsx` makes, so an acceptance never reads as a problem.
				const next =
					item.status === "PENDING"
						? { text: "Waiting for the NGO to review", ink: colors.warning.ink }
						: item.status === "ACCEPTED"
							? {
									text: "Accepted - the NGO will message you to arrange the handover",
									ink: colors.success.ink,
								}
							: null;

				// Withdraw rides in `footer`, outside the card's press target.
				const withdrawButton =
					item.status === "PENDING" ? (
						<Button
							size="sm"
							variant="outline"
							onPress={() => confirmWithdraw(item.need.id)}
							// This row only - one shared flag spun every row at once.
							loading={
								withdraw.isPending &&
								withdraw.variables?.needId === item.need.id
							}
							disabled={withdraw.isPending}
							style={{ alignSelf: "flex-start", marginTop: spacing[3] }}
						>
							Withdraw pledge
						</Button>
					) : undefined;

				return (
					<Surface
						// The need's page carries the full post and its progress; the
						// card was a dead end before.
						onPress={() => router.push(`/needs/${item.need.id}`)}
						footer={withdrawButton}
					>
						<View
							style={{
								flexDirection: "row",
								alignItems: "center",
								justifyContent: "space-between",
								gap: spacing[3],
								marginBottom: spacing[1],
							}}
						>
							<Caption color="tertiary" numberOfLines={1} style={{ flex: 1 }}>
								{item.organization?.organizationName}
							</Caption>
							<StatusPill
								label={pledgeStatusLabel(item.status)}
								tone={pledgeTone(item.status)}
							/>
						</View>

						<H5 numberOfLines={2}>{item.need?.title}</H5>
						<Caption color="tertiary" style={{ marginTop: spacing[0.5] }}>
							{amount ? `${amount} · ` : ""}
							{formatRelative(item.createdAt)}
						</Caption>

						{next && (
							<Caption color={next.ink} style={{ marginTop: spacing[2] }}>
								{next.text}
							</Caption>
						)}

						{item.reviewNote && (
							<Caption color="secondary" style={{ marginTop: spacing[2] }}>
								“{item.reviewNote}”
							</Caption>
						)}
					</Surface>
				);
			}}
		/>
	);
}

function MoneyDonations() {
	const router = useRouter();
	const [receiptId, setReceiptId] = useState<string | null>(null);

	const { query, items, loadMore } = usePagedQuery({
		queryKey: queryKeys.myDonations({ limit: PAGE_SIZE }),
		fetchPage: (page) => donationsApi.listMine({ page, limit: PAGE_SIZE }),
	});

	return (
		<>
			<PagedList
				query={query}
				items={items}
				loadMore={loadMore}
				loadingLabel="Loading your donations"
				keyExtractor={(item) => item.id}
				empty={
					<EmptyState
						icon={HandCoins}
						title="No donations yet"
						description="Donate to any verified NGO from its page. Each completed donation appears here with a receipt."
						action={
							<Button
								size="sm"
								variant="outline"
								onPress={() => router.push("/ngos")}
							>
								Browse NGOs
							</Button>
						}
					/>
				}
				renderItem={(item) => (
					<DonationCard item={item} onReceipt={() => setReceiptId(item.id)} />
				)}
			/>

			<ReceiptSheet id={receiptId} onClose={() => setReceiptId(null)} />
		</>
	);
}

function DonationCard({
	item,
	onReceipt,
}: {
	item: MyDonation;
	onReceipt: () => void;
}) {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const tone =
		item.status === "COMPLETED"
			? "success"
			: item.status === "FAILED"
				? "error"
				: "warning";

	return (
		<Surface>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					gap: spacing[3],
				}}
			>
				<H3>{formatMinor(item.amountMinor, item.currency)}</H3>
				<StatusPill label={humanizeStatus(item.status)} tone={tone} />
			</View>

			<Body color="secondary" style={{ marginTop: spacing[1] }}>
				{item.organization.organizationName}
			</Body>
			<Caption color="quaternary" style={{ marginTop: spacing[0.5] }}>
				{item.receiptNumber ? `Receipt ${item.receiptNumber} · ` : ""}
				{formatRelative(item.completedAt ?? item.createdAt)}
			</Caption>

			{item.status === "PENDING" && (
				<Caption color={colors.warning.ink} style={{ marginTop: spacing[2] }}>
					Waiting for the payment to be confirmed
				</Caption>
			)}
			{item.status === "FAILED" && (
				<>
					<Caption color="tertiary" style={{ marginTop: spacing[2] }}>
						Nothing was charged.
					</Caption>
					<Button
						size="sm"
						variant="outline"
						onPress={() => router.push(`/ngos/${item.organization.id}`)}
						style={{ alignSelf: "flex-start", marginTop: spacing[3] }}
					>
						Try again
					</Button>
				</>
			)}

			{/* Only completed payments have a receipt - the server refuses one for
			    anything still pending. */}
			{item.status === "COMPLETED" && (
				<Button
					size="sm"
					variant="outline"
					onPress={onReceipt}
					accessibilityLabel={`View receipt for ${formatMinor(item.amountMinor, item.currency)} to ${item.organization.organizationName}`}
					style={{ alignSelf: "flex-start", marginTop: spacing[3] }}
				>
					View receipt
				</Button>
			)}
		</Surface>
	);
}

/** The donation receipt, as an NGO would put on letterhead. */
function ReceiptSheet({
	id,
	onClose,
}: {
	id: string | null;
	onClose: () => void;
}) {
	const { spacing } = useTheme();
	const query = useDonationReceipt(id ?? undefined);
	const receipt = query.data;

	return (
		<Sheet
			visible={!!id}
			onClose={onClose}
			title="Receipt"
			footer={
				<Button variant="outline" onPress={onClose}>
					Done
				</Button>
			}
		>
			<View style={{ paddingTop: spacing[1], paddingBottom: spacing[2] }}>
				{query.isLoading ? (
					<LoadingState />
				) : query.isError || !receipt ? (
					<ErrorState
						message={apiErrorMessage(query.error)}
						onRetry={() => query.refetch()}
					/>
				) : (
					<>
						<View style={{ marginBottom: spacing[4] }}>
							<Caption color="tertiary">Receipt number</Caption>
							<H3>{receipt.receiptNumber ?? "-"}</H3>
						</View>
						<ListGroup>
							<ReceiptRow
								label="Amount"
								value={formatMinor(receipt.amountMinor, receipt.currency)}
							/>
							<ReceiptRow
								label="To"
								value={[receipt.organizationName, receipt.organizationCity]
									.filter(Boolean)
									.join(", ")}
							/>
							<ReceiptRow label="From" value={receipt.donorName ?? "-"} />
							<ReceiptRow
								label="Date"
								value={
									receipt.completedAt
										? formatDateTime(receipt.completedAt)
										: "-"
								}
							/>
						</ListGroup>
					</>
				)}
			</View>
		</Sheet>
	);
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
	const { spacing } = useTheme();
	return (
		<View
			style={{
				flexDirection: "row",
				justifyContent: "space-between",
				gap: spacing[4],
				paddingHorizontal: spacing[4],
				paddingVertical: spacing[3],
			}}
		>
			<Caption color="tertiary">{label}</Caption>
			<Body weight="medium" style={{ flex: 1, textAlign: "right" }}>
				{value}
			</Body>
		</View>
	);
}
