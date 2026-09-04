import type { UploadPurpose } from "@nabhya/shared";
import { Check, FileText, Upload } from "lucide-react-native";
import { ActivityIndicator, Pressable, View } from "react-native";
import {
	humanizeStatus,
	StatusPill,
	verificationTone,
} from "@/components/status-pill";
import { Body, Caption } from "@/components/ui/typography";
import { useOpenDocument } from "@/hooks/use-documents";
import { useFileUpload } from "@/hooks/use-upload";
import { useTheme } from "@/hooks/useTheme";
import type { AdminOrgDocument } from "@/lib/types";

/**
 * One document slot: shows what's already submitted and its review state, or a
 * dashed target to upload into. Picking a file uploads it straight to storage
 * and reports the resulting object key back to the parent.
 */
export function DocumentUploadTile({
	title,
	hint,
	purpose,
	organizationDocumentType,
	existing,
	onUploaded,
	saving,
}: {
	title: string;
	hint: string;
	purpose: UploadPurpose;
	organizationDocumentType?: string;
	existing?: AdminOrgDocument;
	onUploaded: (key: string) => void;
	saving?: boolean;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	const { pickAndUpload, isUploading, error } = useFileUpload(
		purpose,
		organizationDocumentType,
	);
	const openDocument = useOpenDocument();

	const busy = isUploading || saving;

	const pick = async () => {
		const picked = await pickAndUpload();
		if (picked) onUploaded(picked.key);
	};

	if (existing) {
		return (
			<View
				style={{
					borderWidth: 1,
					borderColor: colors.border.light,
					backgroundColor: colors.background.primary,
					borderRadius: borderRadius.lg,
					padding: spacing[4],
					marginBottom: spacing[3],
				}}
			>
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
					<View style={{ flex: 1 }}>
						<Body weight="medium" numberOfLines={1}>
							{title}
						</Body>
						<Caption color="tertiary">Submitted</Caption>
					</View>
					<StatusPill
						label={humanizeStatus(existing.verificationStatus)}
						tone={verificationTone(existing.verificationStatus)}
					/>
				</View>

				{existing.remarks && (
					<Caption color="secondary" style={{ marginTop: spacing[2] }}>
						“{existing.remarks}”
					</Caption>
				)}

				<View
					style={{
						flexDirection: "row",
						gap: spacing[4],
						marginTop: spacing[3],
					}}
				>
					<Pressable
						onPress={() => openDocument.mutate(existing.documentKey)}
						hitSlop={8}
					>
						<Caption weight="medium" color={colors.primary.main as string}>
							{openDocument.isPending ? "Opening…" : "View"}
						</Caption>
					</Pressable>
					<Pressable onPress={pick} disabled={busy} hitSlop={8}>
						<Caption weight="medium" color="secondary">
							{busy ? "Uploading…" : "Replace"}
						</Caption>
					</Pressable>
				</View>

				{error && (
					<Caption
						color={colors.error.main as string}
						style={{ marginTop: spacing[2] }}
					>
						{error}
					</Caption>
				)}
			</View>
		);
	}

	return (
		<Pressable
			onPress={pick}
			disabled={busy}
			style={({ pressed }) => ({
				borderWidth: 2,
				borderColor: pressed ? colors.primary.main : colors.border.medium,
				borderStyle: "dashed",
				borderRadius: borderRadius.lg,
				padding: spacing[6],
				alignItems: "center",
				marginBottom: spacing[3],
				opacity: busy ? 0.6 : 1,
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
					color={colors.error.main as string}
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
			<Check size={14} color={colors.success.main as string} />
			<Caption color={colors.success.main as string}>{label}</Caption>
		</View>
	);
}
