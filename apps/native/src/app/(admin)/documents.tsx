import { FileCheck } from "lucide-react-native";
import { useState } from "react";
import {
	Alert,
	FlatList,
	Linking,
	Pressable,
	RefreshControl,
	View,
} from "react-native";
import {
	EmptyState,
	ErrorState,
	FilterChips,
	LoadingState,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import {
	humanizeStatus,
	StatusPill,
	verificationTone,
} from "@/components/status-pill";
import { Input } from "@/components/ui/input";
import { Body, Caption } from "@/components/ui/typography";
import {
	useAdminOrgDocuments,
	useAdminUserDocuments,
	useReviewOrgDocument,
	useReviewUserDocument,
} from "@/hooks/use-admin";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import type { DocVerificationStatus } from "@/lib/types";

type Queue = "ORG" | "USER";
type StatusFilter = "ALL" | DocVerificationStatus;

const QUEUES: Array<{ value: Queue; label: string }> = [
	{ value: "ORG", label: "NGO documents" },
	{ value: "USER", label: "Identity documents" },
];

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
	{ value: "PENDING", label: "Pending" },
	{ value: "VERIFIED", label: "Approved" },
	{ value: "REJECTED", label: "Rejected" },
	{ value: "ALL", label: "All" },
];

/** Flattened row shape shared by both verification queues. */
interface QueueRow {
	id: string;
	documentType: string;
	documentUrl: string;
	verificationStatus: DocVerificationStatus | null;
	remarks: string | null;
	uploadedAt: string;
	ownerName: string;
	ownerDetail: string;
}

export default function AdminDocuments() {
	const { colors, spacing } = useTheme();
	const [queue, setQueue] = useState<Queue>("ORG");
	const [status, setStatus] = useState<StatusFilter>("PENDING");

	const statusQuery = status === "ALL" ? {} : { status };
	const orgDocs = useAdminOrgDocuments(statusQuery);
	const userDocs = useAdminUserDocuments(statusQuery);
	const reviewOrgDoc = useReviewOrgDocument();
	const reviewUserDoc = useReviewUserDocument();

	const query = queue === "ORG" ? orgDocs : userDocs;
	const review = queue === "ORG" ? reviewOrgDoc : reviewUserDoc;

	const rows: QueueRow[] =
		queue === "ORG"
			? (orgDocs.data?.items ?? []).map((doc) => ({
					id: doc.id,
					documentType: doc.documentType,
					documentUrl: doc.documentUrl,
					verificationStatus: doc.verificationStatus,
					remarks: doc.remarks,
					uploadedAt: doc.uploadedAt,
					ownerName: doc.organization.organizationName,
					ownerDetail: `NGO · ${humanizeStatus(doc.organization.verificationStatus ?? "PENDING")}`,
				}))
			: (userDocs.data?.items ?? []).map((doc) => ({
					id: doc.id,
					documentType: doc.documentType,
					documentUrl: doc.documentUrl,
					verificationStatus: doc.verificationStatus,
					remarks: doc.remarks,
					uploadedAt: doc.uploadedAt,
					ownerName: doc.user.fullName ?? doc.user.email,
					ownerDetail: doc.user.email,
				}));

	const decide = (
		row: QueueRow,
		verificationStatus: "VERIFIED" | "REJECTED",
		remarks?: string,
	) => {
		review.mutate(
			{
				id: row.id,
				input: { verificationStatus, remarks },
			},
			{
				onError: (error) =>
					Alert.alert("Could not update", apiErrorMessage(error)),
			},
		);
	};

	return (
		<View
			style={{
				flex: 1,
				backgroundColor: colors.background.warm,
				paddingHorizontal: spacing[6],
				paddingTop: spacing[8],
			}}
		>
			<ScreenHeader
				title="Documents"
				subtitle="Verify what NGOs and volunteers have submitted."
			/>

			<FilterChips options={QUEUES} value={queue} onChange={setQueue} />
			<View style={{ height: spacing[2] }} />
			<FilterChips
				options={STATUS_FILTERS}
				value={status}
				onChange={setStatus}
			/>

			{query.isLoading ? (
				<LoadingState label="Loading documents…" />
			) : query.isError ? (
				<ErrorState
					message={apiErrorMessage(query.error)}
					onRetry={() => query.refetch()}
				/>
			) : (
				<FlatList
					data={rows}
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
							icon={FileCheck}
							title="Queue is clear"
							description={
								status === "PENDING"
									? "New submissions will land here for review."
									: "Nothing matches this filter."
							}
						/>
					}
					renderItem={({ item }) => (
						<DocumentRow
							row={item}
							busy={review.isPending}
							onDecide={(verificationStatus, remarks) =>
								decide(item, verificationStatus, remarks)
							}
						/>
					)}
				/>
			)}
		</View>
	);
}

function DocumentRow({
	row,
	busy,
	onDecide,
}: {
	row: QueueRow;
	busy: boolean;
	onDecide: (status: "VERIFIED" | "REJECTED", remarks?: string) => void;
}) {
	const { colors, spacing } = useTheme();
	const [rejecting, setRejecting] = useState(false);
	const [remarks, setRemarks] = useState("");
	const isPending = row.verificationStatus === "PENDING";

	const confirmReject = () => {
		if (!remarks.trim()) {
			Alert.alert("Remarks needed", "Say why this document was rejected.");
			return;
		}
		onDecide("REJECTED", remarks.trim());
		setRejecting(false);
		setRemarks("");
	};

	return (
		<Surface>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					gap: spacing[2],
				}}
			>
				<View style={{ flex: 1 }}>
					<Body weight="bold" numberOfLines={1}>
						{humanizeStatus(row.documentType)}
					</Body>
					<Caption color="tertiary" numberOfLines={1}>
						{row.ownerName}
					</Caption>
					<Caption color="quaternary" numberOfLines={1}>
						{row.ownerDetail} · {formatRelative(row.uploadedAt)}
					</Caption>
				</View>
				<StatusPill
					label={humanizeStatus(row.verificationStatus ?? "PENDING")}
					tone={verificationTone(row.verificationStatus)}
				/>
			</View>

			{row.verificationStatus === "REJECTED" && row.remarks && (
				<Caption
					color={colors.error.main as string}
					style={{ marginTop: spacing[2] }}
				>
					{row.remarks}
				</Caption>
			)}

			<Pressable
				onPress={() => Linking.openURL(row.documentUrl)}
				hitSlop={8}
				style={{ marginTop: spacing[3] }}
			>
				<Caption weight="medium" color={colors.primary.main as string}>
					Open document
				</Caption>
			</Pressable>

			{isPending && !rejecting && (
				<View
					style={{
						flexDirection: "row",
						gap: spacing[2],
						marginTop: spacing[4],
					}}
				>
					<Pressable
						disabled={busy}
						onPress={() => onDecide("VERIFIED")}
						style={{
							flex: 1,
							alignItems: "center",
							paddingVertical: spacing[2.5],
							borderRadius: 12,
							backgroundColor: colors.primary.main,
							opacity: busy ? 0.5 : 1,
						}}
					>
						<Body weight="bold" color={colors.primary.contrast as string}>
							Approve
						</Body>
					</Pressable>
					<Pressable
						disabled={busy}
						onPress={() => setRejecting(true)}
						style={{
							flex: 1,
							alignItems: "center",
							paddingVertical: spacing[2.5],
							borderRadius: 12,
							borderWidth: 1,
							borderColor: colors.border.medium,
							opacity: busy ? 0.5 : 1,
						}}
					>
						<Body weight="medium">Reject</Body>
					</Pressable>
				</View>
			)}

			{isPending && rejecting && (
				<View style={{ marginTop: spacing[4] }}>
					<Input
						placeholder="Why is this document being rejected?"
						value={remarks}
						onChangeText={setRemarks}
						multiline
						style={{
							borderWidth: 0,
							borderRadius: 12,
							backgroundColor: colors.background.tertiary,
							paddingVertical: spacing[3],
							minHeight: 72,
							textAlignVertical: "top",
						}}
					/>
					<View
						style={{
							flexDirection: "row",
							gap: spacing[2],
							marginTop: spacing[3],
						}}
					>
						<Pressable
							disabled={busy}
							onPress={confirmReject}
							style={{
								flex: 1,
								alignItems: "center",
								paddingVertical: spacing[2.5],
								borderRadius: 12,
								backgroundColor: colors.error.main,
								opacity: busy ? 0.5 : 1,
							}}
						>
							<Body weight="bold" color={colors.primary.contrast as string}>
								Confirm reject
							</Body>
						</Pressable>
						<Pressable
							disabled={busy}
							onPress={() => setRejecting(false)}
							style={{
								flex: 1,
								alignItems: "center",
								paddingVertical: spacing[2.5],
								borderRadius: 12,
								borderWidth: 1,
								borderColor: colors.border.medium,
							}}
						>
							<Body weight="medium">Cancel</Body>
						</Pressable>
					</View>
				</View>
			)}
		</Surface>
	);
}
