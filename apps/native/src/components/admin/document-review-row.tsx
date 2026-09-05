import { ExternalLink } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { Surface } from "@/components/screen-shell";
import {
	humanizeStatus,
	StatusPill,
	verificationTone,
} from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption } from "@/components/ui/typography";
import { useReviewDocument } from "@/hooks/use-admin";
import { useOpenDocument } from "@/hooks/use-documents";
import { useTheme } from "@/hooks/use-theme";
import { Alert } from "@/lib/alert";
import { apiErrorMessage } from "@/lib/api";
import { focusable } from "@/lib/focus";
import { formatDateTime } from "@/lib/format";
import type { AdminOrgDocument } from "@/lib/types";

/**
 * One document in a reviewer's queue: open it, then approve or reject.
 *
 * The row is built for volume. Everything a reviewer needs before deciding —
 * type, owner, upload time, the liveness challenge, any earlier remarks — is on
 * the card, the file opens from a link, and the two decisions are real buttons
 * in a fixed order (approve first) so a hundred rows train one motion.
 *
 * Rejection collects remarks inline rather than through Alert.prompt, which
 * only exists on iOS — on Android that would silently do nothing. The server
 * also requires remarks on rejection, so the field validates before it sends.
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
	 * the owner is already the subject of the sheet. */
	subtitle?: string;
}) {
	const { colors, spacing } = useTheme();
	const [rejecting, setRejecting] = useState(false);
	const [remarks, setRemarks] = useState("");
	const [remarksError, setRemarksError] = useState<string | null>(null);

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
		const text = remarks.trim();
		if (!text) {
			setRemarksError("Say what is wrong so the uploader can fix it.");
			return;
		}
		setRemarksError(null);
		review.mutate(
			{
				id: document.id,
				input: { verificationStatus: "REJECTED", remarks: text },
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

	const cancelReject = () => {
		setRejecting(false);
		setRemarks("");
		setRemarksError(null);
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
				<View style={{ flex: 1, minWidth: 0 }}>
					<Body weight="semibold" numberOfLines={1}>
						{label}
					</Body>
					{subtitle && (
						<Caption color="secondary" numberOfLines={1}>
							{subtitle}
						</Caption>
					)}
				</View>
				<StatusPill
					label={humanizeStatus(document.verificationStatus)}
					tone={verificationTone(document.verificationStatus)}
				/>
			</View>

			<Caption color="quaternary" style={{ marginTop: spacing[1.5] }}>
				Uploaded {formatDateTime(document.uploadedAt)}
				{livenessChallenge
					? ` · Liveness: ${livenessChallenge.replace(/_/g, " ").toLowerCase()}`
					: ""}
			</Caption>

			{document.remarks && (
				<Caption color="secondary" style={{ marginTop: spacing[2] }}>
					“{document.remarks}”
				</Caption>
			)}

			{/* Open the file(s). Links, not buttons: they leave the app. */}
			<View
				style={{
					flexDirection: "row",
					flexWrap: "wrap",
					alignItems: "center",
					gap: spacing[4],
					marginTop: spacing[3],
				}}
			>
				<FileLink
					label={openDocument.isPending ? "Opening…" : "Open document"}
					onPress={() => openDocument.mutate(document.documentKey)}
					disabled={openDocument.isPending}
				/>
				{livenessFrameKey && (
					<FileLink
						label="Liveness frame"
						onPress={() => openDocument.mutate(livenessFrameKey)}
						disabled={openDocument.isPending}
					/>
				)}
			</View>

			{isPending && !rejecting && (
				<View
					style={{
						flexDirection: "row",
						gap: spacing[2],
						marginTop: spacing[3],
					}}
				>
					<Button
						size="sm"
						onPress={approve}
						loading={review.isPending}
						accessibilityLabel={`Approve ${label}`}
						style={{ flex: 1 }}
					>
						Approve
					</Button>
					<Button
						size="sm"
						variant="outline"
						onPress={() => setRejecting(true)}
						disabled={review.isPending}
						accessibilityLabel={`Reject ${label}`}
						style={{ flex: 1 }}
					>
						Reject
					</Button>
				</View>
			)}

			{rejecting && (
				<View style={{ marginTop: spacing[3] }}>
					<Input
						placeholder="What's wrong with this document?"
						value={remarks}
						onChangeText={(text) => {
							setRemarks(text);
							if (remarksError && text.trim()) setRemarksError(null);
						}}
						autoFocus
						multiline
						accessibilityLabel="Rejection remarks"
						{...(remarksError ? { accessibilityHint: remarksError } : {})}
						style={{ minHeight: 72, textAlignVertical: "top" }}
					/>
					{remarksError && (
						<Caption
							color={colors.error.ink}
							accessibilityLiveRegion="polite"
							style={{ marginTop: spacing[1.5] }}
						>
							{remarksError}
						</Caption>
					)}
					<View
						style={{
							flexDirection: "row",
							gap: spacing[2],
							marginTop: spacing[2.5],
						}}
					>
						<Button
							size="sm"
							variant="destructive"
							onPress={confirmReject}
							loading={review.isPending}
							style={{ flex: 1 }}
						>
							Confirm rejection
						</Button>
						<Button
							size="sm"
							variant="ghost"
							onPress={cancelReject}
							disabled={review.isPending}
							style={{ flex: 1 }}
						>
							Cancel
						</Button>
					</View>
				</View>
			)}
		</Surface>
	);
}

function FileLink({
	label,
	onPress,
	disabled,
}: {
	label: string;
	onPress: () => void;
	disabled?: boolean;
}) {
	const { colors, spacing } = useTheme();

	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			accessibilityRole="link"
			accessibilityLabel={label}
			accessibilityState={{ disabled: !!disabled }}
			hitSlop={8}
			{...focusable}
			style={({ pressed }) => ({
				flexDirection: "row",
				alignItems: "center",
				gap: spacing[1],
				minHeight: 32,
				opacity: pressed || disabled ? 0.6 : 1,
			})}
		>
			<ExternalLink size={13} color={colors.primary.ink} strokeWidth={2} />
			<Caption weight="medium" color={colors.primary.ink}>
				{label}
			</Caption>
		</Pressable>
	);
}
