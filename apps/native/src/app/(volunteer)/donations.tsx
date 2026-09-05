import { formatMinor } from "@nabhya/shared";
import { HandCoins, Package } from "lucide-react-native";
import { useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import {
	EmptyState,
	ErrorState,
	FilterChips,
	LoadingState,
	Screen,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import {
	humanizeStatus,
	pledgeTone,
	StatusPill,
} from "@/components/status-pill";
import { Pressable } from "@/components/ui/pressable";
import { Sheet } from "@/components/ui/sheet";
import { Body, Caption } from "@/components/ui/typography";
import { useDonationReceipt, useMyDonations } from "@/hooks/use-engagement";
import { useMyPledges } from "@/hooks/use-needs";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";
import { formatDateTime, formatRelative } from "@/lib/format";

type Tab = "items" | "money";

const TABS: Array<{ value: Tab; label: string }> = [
	{ value: "items", label: "Items" },
	{ value: "money", label: "Money" },
];

/**
 * Everything the volunteer has given — item pledges and monetary donations.
 *
 * The two are rendered by separate components rather than one list with a
 * union type: their shapes share almost nothing, and forcing them together
 * needs casts that hide real mistakes.
 */
export default function Donations() {
	const [tab, setTab] = useState<Tab>("items");

	return (
		<Screen>
			<ScreenHeader
				title="My donations"
				subtitle="Items you've offered, and money you've given."
			/>

			<FilterChips options={TABS} value={tab} onChange={setTab} />

			{tab === "items" ? <ItemPledges /> : <MoneyDonations />}
		</Screen>
	);
}

function ItemPledges() {
	const { colors, spacing } = useTheme();
	const query = useMyPledges();

	if (query.isLoading) return <LoadingState label="Loading your pledges…" />;
	if (query.isError) {
		return (
			<ErrorState
				message={apiErrorMessage(query.error)}
				onRetry={() => query.refetch()}
			/>
		);
	}

	return (
		<FlatList
			data={query.data?.items ?? []}
			keyExtractor={(item) => item.id}
			showsVerticalScrollIndicator={false}
			contentContainerStyle={{ paddingBottom: spacing[10] }}
			ItemSeparatorComponent={() => <View style={{ height: spacing[3] }} />}
			refreshControl={
				<RefreshControl
					refreshing={query.isRefetching}
					onRefresh={() => query.refetch()}
					tintColor={colors.primary.main as string}
				/>
			}
			ListEmptyComponent={
				<EmptyState
					icon={Package}
					title="Nothing pledged yet"
					description="Head to Discover to see what NGOs need right now."
				/>
			}
			renderItem={({ item }) => (
				<Surface>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							justifyContent: "space-between",
							gap: spacing[3],
							marginBottom: spacing[2],
						}}
					>
						<Caption color="secondary" numberOfLines={1} style={{ flex: 1 }}>
							{item.organization?.organizationName}
						</Caption>
						<StatusPill
							label={humanizeStatus(item.status)}
							tone={pledgeTone(item.status)}
						/>
					</View>

					<Body weight="bold" numberOfLines={2}>
						{item.need?.title}
					</Body>
					<Caption color="tertiary" style={{ marginTop: 4 }}>
						{item.quantity
							? `${item.quantity}${item.need?.unit ? ` ${item.need.unit}` : ""} · `
							: ""}
						{formatRelative(item.createdAt)}
					</Caption>

					{item.reviewNote && (
						<Caption color="secondary" style={{ marginTop: spacing[2] }}>
							“{item.reviewNote}”
						</Caption>
					)}
				</Surface>
			)}
		/>
	);
}

function MoneyDonations() {
	const { colors, spacing } = useTheme();
	const [receiptId, setReceiptId] = useState<string | null>(null);
	const query = useMyDonations();

	if (query.isLoading) return <LoadingState label="Loading donations…" />;
	if (query.isError) {
		return (
			<ErrorState
				message={apiErrorMessage(query.error)}
				onRetry={() => query.refetch()}
			/>
		);
	}

	return (
		<>
			<FlatList
				data={query.data?.items ?? []}
				keyExtractor={(item) => item.id}
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ paddingBottom: spacing[10] }}
				ItemSeparatorComponent={() => <View style={{ height: spacing[3] }} />}
				refreshControl={
					<RefreshControl
						refreshing={query.isRefetching}
						onRefresh={() => query.refetch()}
						tintColor={colors.primary.main as string}
					/>
				}
				ListEmptyComponent={
					<EmptyState
						icon={HandCoins}
						title="No donations yet"
						description="Donations you make appear here with their receipt number."
					/>
				}
				renderItem={({ item }) => (
					<Surface>
						<View
							style={{
								flexDirection: "row",
								alignItems: "center",
								justifyContent: "space-between",
							}}
						>
							<Body weight="bold">
								{formatMinor(item.amountMinor, item.currency)}
							</Body>
							<StatusPill
								label={humanizeStatus(item.status)}
								tone={
									item.status === "COMPLETED"
										? "success"
										: item.status === "FAILED"
											? "error"
											: "warning"
								}
							/>
						</View>

						<Caption color="tertiary" style={{ marginTop: 2 }}>
							{item.organization.organizationName}
						</Caption>
						<Caption color="quaternary" style={{ marginTop: spacing[2] }}>
							{item.receiptNumber ? `${item.receiptNumber} · ` : ""}
							{formatRelative(item.completedAt ?? item.createdAt)}
						</Caption>

						{/* Only completed payments have a receipt — the server refuses
						    one for anything still pending. */}
						{item.status === "COMPLETED" && (
							<Pressable
								onPress={() => setReceiptId(item.id)}
								hitSlop={8}
								style={{ marginTop: spacing[3] }}
							>
								<Caption weight="medium" color={colors.primary.main as string}>
									View receipt
								</Caption>
							</Pressable>
						)}
					</Surface>
				)}
			/>

			<ReceiptSheet id={receiptId} onClose={() => setReceiptId(null)} />
		</>
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
		<Sheet visible={!!id} onClose={onClose} title="Receipt">
			<View style={{ paddingTop: spacing[1], paddingBottom: spacing[2] }}>
				{query.isLoading ? (
					<LoadingState />
				) : query.isError || !receipt ? (
					<ErrorState
						message={apiErrorMessage(query.error)}
						onRetry={() => query.refetch()}
					/>
				) : (
					<Surface>
						<Caption color="tertiary">Receipt number</Caption>
						<Body weight="bold" style={{ marginBottom: spacing[4] }}>
							{receipt.receiptNumber ?? "—"}
						</Body>

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
						<ReceiptRow label="From" value={receipt.donorName ?? "—"} />
						<ReceiptRow
							label="Date"
							value={
								receipt.completedAt ? formatDateTime(receipt.completedAt) : "—"
							}
							last
						/>
					</Surface>
				)}
			</View>
		</Sheet>
	);
}

function ReceiptRow({
	label,
	value,
	last,
}: {
	label: string;
	value: string;
	last?: boolean;
}) {
	const { colors, spacing } = useTheme();
	return (
		<View
			style={{
				flexDirection: "row",
				justifyContent: "space-between",
				gap: spacing[4],
				paddingVertical: spacing[2.5],
				borderBottomWidth: last ? 0 : 1,
				borderBottomColor: colors.border.light,
			}}
		>
			<Caption color="tertiary">{label}</Caption>
			<Caption weight="medium" style={{ flex: 1, textAlign: "right" }}>
				{value}
			</Caption>
		</View>
	);
}
