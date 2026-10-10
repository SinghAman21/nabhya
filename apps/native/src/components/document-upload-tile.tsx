import type { UploadPurpose } from "@nabhya/shared";
import { Check, FileText, Upload } from "lucide-react-native";
import { ActivityIndicator, View } from "react-native";
import { Surface } from "@/components/screen-shell";
import { StatusPill, verificationTone } from "@/components/status-pill";
import { TextAction } from "@/components/text-action";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption } from "@/components/ui/typography";
import { useOpenDocument } from "@/hooks/use-documents";
import { useTheme } from "@/hooks/use-theme";
import { useFileUpload } from "@/hooks/use-upload";
import { focusable } from "@/lib/focus";
import { formatDate } from "@/lib/format";
import type { AdminOrgDocument } from "@/lib/types";

/**
 * What each review state means to the person who uploaded the file - the pill
 * word and the line under the title. "Submitted" for every state left a
 * rejected copy looking like the job was done.
 */
const STATE_COPY: Record<
	"PENDING" | "VERIFIED" | "REJECTED",
	{ pill: string; line: (uploaded: string) => string }
> = {
	PENDING: {
		pill: "Waiting for review",
		line: (uploaded) => `Uploaded ${uploaded} · a reviewer will check it`,
	},
	VERIFIED: {
		pill: "Approved",
		line: (uploaded) => `Uploaded ${uploaded} · nothing more to do`,
	},
	REJECTED: {
		pill: "Sent back",
		line: () => "Upload a corrected copy to reopen review",
	},
};

/**
 * One document slot: shows what's already submitted and its review state, or a
 * dashed target to upload into. Picking a file uploads it straight to storage
 * and reports the resulting object key back to the parent.
 *
 * A **sent-back** document is the one state with something to do, so it is
 * the one that gets a real button ("Upload a new copy") and the reviewer's
 * note under a label saying whose words they are. Every other state keeps
 * View / Replace as quiet text actions - replacing an approved PAN card is
 * rare, and a primary button on it would invite resetting a review for
 * nothing.
 */
export function DocumentUploadTile({
	title,
	hint,
	purpose,
	existing,
	onUploaded,
	saving,
	readOnly = false,
}: {
	title: string;
	hint: string;
	purpose: UploadPurpose;
	existing?: AdminOrgDocument;
	onUploaded: (key: string) => void;
	saving?: boolean;
	/** The viewer may see the slot but not upload to it (a team role without `org.edit`). */
	readOnly?: boolean;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	const { pickAndUpload, isUploading, error } = useFileUpload(purpose, {
		fileNameHint: title,
	});
	const openDocument = useOpenDocument();

	const busy = isUploading || saving;

	const pick = async () => {
		const picked = await pickAndUpload();
		if (picked) onUploaded(picked.key);
	};

	if (existing) {
		const state = existing.verificationStatus ?? "PENDING";
		const copy = STATE_COPY[state];
		const sentBack = state === "REJECTED";

		return (
			<Surface>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[3],
					}}
				>
					<View
						style={{
							width: 36,
							height: 36,
							borderRadius: 18,
							alignItems: "center",
							justifyContent: "center",
							backgroundColor: colors.background.tertiary,
						}}
					>
						<FileText size={18} color={colors.text.secondary as string} />
					</View>
					<View style={{ flex: 1, minWidth: 0 }}>
						<Body weight="medium" numberOfLines={1}>
							{title}
						</Body>
						<Caption
							color={sentBack ? (colors.error.ink as string) : "tertiary"}
							numberOfLines={2}
						>
							{copy.line(formatDate(existing.uploadedAt))}
						</Caption>
					</View>
					<StatusPill label={copy.pill} tone={verificationTone(state)} />
				</View>

				{existing.remarks && (
					<View
						style={{
							marginTop: spacing[3],
							paddingLeft: spacing[3],
							borderLeftWidth: 2,
							borderLeftColor: sentBack
								? (colors.error.ink as string)
								: colors.border.dark,
							gap: spacing[0.5],
						}}
					>
						<Caption weight="medium" color="tertiary">
							Reviewer's note
						</Caption>
						<Caption color="secondary">{existing.remarks}</Caption>
					</View>
				)}

				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						flexWrap: "wrap",
						gap: spacing[3],
						marginTop: spacing[3],
					}}
				>
					{sentBack && !readOnly ? (
						<Button
							size="sm"
							onPress={pick}
							loading={!!busy}
							accessibilityLabel={`Upload a new copy of ${title}`}
						>
							Upload a new copy
						</Button>
					) : null}
					<TextAction
						label={openDocument.isPending ? "Opening…" : "View file"}
						onPress={() => openDocument.mutate(existing.documentKey)}
						accessibilityLabel={`View the ${title} you uploaded`}
					/>
					{!sentBack && !readOnly ? (
						<TextAction
							label={busy ? "Uploading…" : "Replace"}
							disabled={!!busy}
							onPress={pick}
							accessibilityLabel={`Replace ${title}`}
						/>
					) : null}
				</View>

				{error && (
					<Caption
						color={colors.error.ink as string}
						style={{ marginTop: spacing[2] }}
					>
						{error}
					</Caption>
				)}
			</Surface>
		);
	}

	return (
		<Pressable
			onPress={pick}
			disabled={busy || readOnly}
			accessibilityRole="button"
			accessibilityLabel={`${title}. ${hint}`}
			accessibilityState={{ disabled: Boolean(busy || readOnly) }}
			{...focusable}
			style={({ pressed }) => ({
				borderWidth: 2,
				borderColor: pressed ? colors.primary.ink : colors.border.medium,
				borderStyle: "dashed",
				borderRadius: borderRadius.lg,
				padding: spacing[6],
				alignItems: "center",
				opacity: busy || readOnly ? 0.6 : 1,
			})}
		>
			<Body weight="medium" style={{ marginBottom: spacing[1] }}>
				{title}
			</Body>
			<Caption color="tertiary" style={{ textAlign: "center" }}>
				{hint}
			</Caption>

			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[2],
					marginTop: spacing[3],
					paddingHorizontal: spacing[4],
					paddingVertical: spacing[2],
					borderRadius: borderRadius.sm,
					backgroundColor: colors.background.tertiary,
				}}
			>
				{busy ? (
					<ActivityIndicator
						size="small"
						color={colors.text.secondary as string}
					/>
				) : (
					<Upload size={14} color={colors.text.secondary as string} />
				)}
				<Caption color="secondary" weight="medium">
					{busy ? "Uploading…" : "Choose file"}
				</Caption>
			</View>

			<Caption color="quaternary" style={{ marginTop: spacing[2] }}>
				PDF, JPG, PNG or WebP · up to 10 MB
			</Caption>

			{error && (
				<Caption
					color={colors.error.ink as string}
					style={{ marginTop: spacing[2], textAlign: "center" }}
				>
					{error}
				</Caption>
			)}
		</Pressable>
	);
}

/** Compact confirmation used after a successful upload in a form flow. */
export function UploadedBadge({ label }: { label: string }) {
	const { colors, spacing } = useTheme();
	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: spacing[2],
				marginTop: spacing[2],
			}}
		>
			<Check size={14} color={colors.success.ink as string} />
			<Caption color={colors.success.ink as string}>{label}</Caption>
		</View>
	);
}
