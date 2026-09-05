import { useState } from "react";
import { View } from "react-native";
import { Surface } from "@/components/screen-shell";
import {
	humanizeStatus,
	StatusPill,
	verificationTone,
} from "@/components/status-pill";
import { Input } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption } from "@/components/ui/typography";
import { useReviewDocument } from "@/hooks/use-admin";
import { useOpenDocument } from "@/hooks/use-documents";
import { useTheme } from "@/hooks/useTheme";
import { Alert } from "@/lib/alert";
import { apiErrorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { AdminOrgDocument } from "@/lib/types";

/**
 * One document in a reviewer's queue: open it, then approve or reject.
 *
 * Rejection collects remarks inline rather than through Alert.prompt, which
 * only exists on iOS — on Android that would silently do nothing. The server
 * also requires remarks on rejection.
 */
export function DocumentReviewRow({
	document,
	kind,
	label,
	subtitle,
}: {
	document: AdminOrgDocument;
	kind: "organization" | "user";
	label: string;
	/** Who the document belongs to. Only the queue needs it — inside a dossier
	 * the owner is already the subject of the screen. */
	subtitle?: string;
}) {
	const { colors, spacing } = useTheme();
	const [rejecting, setRejecting] = useState(false);
	const [remarks, setRemarks] = useState("");

	const review = useReviewDocument(kind);
	const openDocument = useOpenDocument();

	const approve = () => {
		review.mutate(
			{ id: document.id, input: { verificationStatus: "VERIFIED" } },
			{
				onError: (error) =>
					Alert.alert("Could not approve", apiErrorMessage(error)),
			},
		);
	};

	const confirmReject = () => {
		if (!remarks.trim()) return;
		review.mutate(
			{
				id: document.id,
				input: { verificationStatus: "REJECTED", remarks: remarks.trim() },
			},
			{
				onSuccess: () => {
					setRejecting(false);
					setRemarks("");
				},
				onError: (error) =>
					Alert.alert("Could not reject", apiErrorMessage(error)),
			},
		);
	};

	const isPending = document.verificationStatus === "PENDING";
	const liveness = document.metadata?.liveness;
	const livenessChallenge = liveness?.challenge;
	const livenessFrameKey = liveness?.secondaryFrameKey;

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
				<Body weight="medium" style={{ flex: 1 }} numberOfLines={1}>
					{label}
				</Body>
				<StatusPill
					label={humanizeStatus(document.verificationStatus)}
					tone={verificationTone(document.verificationStatus)}
				/>
			</View>

			{subtitle && (
				<Caption color="secondary" numberOfLines={1}>
					{subtitle}
				</Caption>
			)}

			<Caption color="quaternary" style={{ marginTop: spacing[1] }}>
				Uploaded {formatDateTime(document.uploadedAt)}
			</Caption>

			{livenessChallenge && (
				<Caption color="quaternary" style={{ marginTop: spacing[1] }}>
					Liveness check: {livenessChallenge.replace(/_/g, " ").toLowerCase()}
				</Caption>
			)}

			{document.remarks && (
				<Caption color="secondary" style={{ marginTop: spacing[2] }}>
					“{document.remarks}”
				</Caption>
			)}

			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[4],
					marginTop: spacing[3],
				}}
			>
				<Pressable
					onPress={() => openDocument.mutate(document.documentKey)}
					hitSlop={8}
				>
					<Caption weight="medium" color={colors.primary.main as string}>
						{openDocument.isPending ? "Opening…" : "Open document"}
					</Caption>
				</Pressable>

				{livenessFrameKey && (
					<Pressable
						onPress={() =>
							livenessFrameKey && openDocument.mutate(livenessFrameKey)
						}
						hitSlop={8}
					>
						<Caption weight="medium" color={colors.primary.main as string}>
							Liveness frame
						</Caption>
					</Pressable>
				)}

				{isPending && !rejecting && (
					<>
						<Pressable
							onPress={approve}
							disabled={review.isPending}
							hitSlop={8}
						>
							<Caption weight="medium" color={colors.success.main as string}>
								Approve
							</Caption>
						</Pressable>
						<Pressable
							onPress={() => setRejecting(true)}
							disabled={review.isPending}
							hitSlop={8}
						>
							<Caption weight="medium" color={colors.error.main as string}>
								Reject
							</Caption>
						</Pressable>
					</>
				)}
			</View>

			{rejecting && (
				<View style={{ marginTop: spacing[3] }}>
					<Input
						placeholder="What's wrong with this document?"
						value={remarks}
						onChangeText={setRemarks}
						autoFocus
						style={{
							borderWidth: 0,
							borderRadius: 12,
							backgroundColor: colors.background.tertiary,
							paddingVertical: spacing[3],
						}}
					/>
					<View
						style={{
							flexDirection: "row",
							gap: spacing[4],
							marginTop: spacing[2],
						}}
					>
						<Pressable
							onPress={confirmReject}
							disabled={review.isPending || !remarks.trim()}
							hitSlop={8}
						>
							<Caption
								weight="medium"
								color={
									remarks.trim()
										? (colors.error.main as string)
										: (colors.text.disabled as string)
								}
							>
								Confirm rejection
							</Caption>
						</Pressable>
						<Pressable
							onPress={() => {
								setRejecting(false);
								setRemarks("");
							}}
							hitSlop={8}
						>
							<Caption weight="medium" color="secondary">
								Cancel
							</Caption>
						</Pressable>
					</View>
				</View>
			)}
		</Surface>
	);
}
