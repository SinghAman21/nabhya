import type { UploadPurpose } from "@nabhya/shared";
import { Check, FileText, Upload } from "lucide-react-native";
import { ActivityIndicator, View } from "react-native";
import { FieldError } from "@/components/form-field";
import { Surface } from "@/components/screen-shell";
import {
	humanizeStatus,
	StatusPill,
	verificationTone,
} from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption } from "@/components/ui/typography";
import { useOpenDocument } from "@/hooks/use-documents";
import { useTheme } from "@/hooks/use-theme";
import { useFileUpload } from "@/hooks/use-upload";
import { focusable } from "@/lib/focus";
import { formatRelative } from "@/lib/format";
import type { AdminOrgDocument } from "@/lib/types";

/**
 * One document slot in four states.
 *
 * - **empty** — a dashed target; tapping picks a file and uploads it.
 * - **uploading** — the same target, busy, with the picker disabled.
 * - **uploaded** — a surface with the file, when it went up, and its review
 *   state as a pill (pending, under review, verified).
 * - **rejected** — the surface again, with the reviewer's remark in the error
 *   tint and one primary action: upload a new copy.
 *
 * Picking a file uploads it straight to storage and reports the resulting
 * object key back to the parent, which attaches it to the record.
 */
export function DocumentUploadTile({
	title,
	hint,
	purpose,
	existing,
	onUploaded,
	saving,
	required,
}: {
	title: string;
	hint: string;
	purpose: UploadPurpose;
	existing?: AdminOrgDocument;
	onUploaded: (key: string) => void;
	/** The parent is attaching the key to the record — keep the tile busy. */
	saving?: boolean;
	/** Draws "Required" / "Optional" under the title. */
	required?: boolean;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	const { pickAndUpload, isUploading, error } = useFileUpload(purpose);
	const openDocument = useOpenDocument();

	const busy = isUploading || saving;
	const requirement =
		required === undefined ? null : required ? "Required" : "Optional";

	const pick = async () => {
		const picked = await pickAndUpload();
		if (picked) onUploaded(picked.key);
	};

	/* Uploaded / rejected --------------------------------------------------- */
	if (existing) {
		const rejected = existing.verificationStatus === "REJECTED";
		const verified = existing.verificationStatus === "VERIFIED";

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
							width: 40,
							height: 40,
							borderRadius: 12,
							alignItems: "center",
							justifyContent: "center",
							backgroundColor: verified
								? colors.success.bg
								: colors.background.subtle,
						}}
					>
						{verified ? (
							<Check size={18} color={colors.success.ink} strokeWidth={2.4} />
						) : (
							<FileText
								size={18}
								color={colors.text.secondary as string}
								strokeWidth={1.75}
							/>
						)}
					</View>
					<View style={{ flex: 1, minWidth: 0 }}>
						<Body weight="medium" numberOfLines={1}>
							{title}
						</Body>
						<Caption color="tertiary" numberOfLines={1}>
							{[requirement, `Uploaded ${formatRelative(existing.uploadedAt)}`]
								.filter(Boolean)
								.join(" · ")}
						</Caption>
					</View>
					<StatusPill
						label={humanizeStatus(existing.verificationStatus ?? "PENDING")}
						tone={verificationTone(existing.verificationStatus)}
					/>
				</View>

				{rejected && (
					<View
						style={{
							marginTop: spacing[3],
							padding: spacing[3],
							borderRadius: borderRadius.md,
							backgroundColor: colors.error.bg,
						}}
					>
						<Caption weight="bold" color={colors.error.ink}>
							Reviewer's note
						</Caption>
						<Caption color="secondary" style={{ marginTop: spacing[0.5] }}>
							{existing.remarks ??
								"This copy could not be accepted. Upload a clearer or more recent one."}
						</Caption>
					</View>
				)}
				{!rejected && existing.remarks && (
					<Caption color="secondary" style={{ marginTop: spacing[2] }}>
						“{existing.remarks}”
					</Caption>
				)}

				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[2],
						marginTop: spacing[3],
					}}
				>
					{rejected ? (
						<Button
							size="sm"
							onPress={pick}
							disabled={busy}
							loading={!!busy}
							style={{ flex: 1 }}
						>
							Upload a new copy
						</Button>
					) : (
						<Button
							variant="outline"
							size="sm"
							onPress={pick}
							disabled={busy}
							loading={!!busy}
							accessibilityLabel={`Replace ${title}`}
						>
							Replace
						</Button>
					)}
					<Button
						variant="ghost"
						size="sm"
						onPress={() => openDocument.mutate(existing.documentKey)}
						disabled={openDocument.isPending}
						loading={openDocument.isPending}
						accessibilityLabel={`View ${title}`}
					>
						View
					</Button>
				</View>

				<FieldError message={error} />
			</Surface>
		);
	}

	/* Empty / uploading ----------------------------------------------------- */
	return (
		<Pressable
			onPress={pick}
			disabled={busy}
			accessibilityRole="button"
			accessibilityLabel={`Upload ${title}`}
			accessibilityHint={hint}
			accessibilityState={{ disabled: !!busy, busy: !!busy }}
			{...focusable}
			style={({ pressed }) => ({
				borderWidth: 1.5,
				borderStyle: "dashed",
				borderColor: pressed ? colors.text.primary : colors.border.dark,
				borderRadius: borderRadius.xl,
				padding: spacing[4],
				backgroundColor: pressed ? colors.background.subtle : "transparent",
				opacity: busy ? 0.7 : 1,
			})}
		>
			<View
				style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}
			>
				<View
					style={{
						width: 40,
						height: 40,
						borderRadius: 12,
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: colors.background.subtle,
					}}
				>
					{busy ? (
						<ActivityIndicator
							size="small"
							color={colors.text.secondary as string}
						/>
					) : (
						<Upload
							size={18}
							color={colors.text.secondary as string}
							strokeWidth={1.75}
						/>
					)}
				</View>
				<View style={{ flex: 1, minWidth: 0 }}>
					<Body weight="medium" numberOfLines={1}>
						{title}
					</Body>
					<Caption color="tertiary" numberOfLines={2}>
						{busy ? "Uploading…" : hint}
					</Caption>
				</View>
				{requirement && (
					<Caption
						weight="medium"
						color={required ? "secondary" : "quaternary"}
					>
						{requirement}
					</Caption>
				)}
			</View>
			<Caption color="quaternary" style={{ marginTop: spacing[3] }}>
				PDF, JPG, PNG or WebP · up to 10 MB
			</Caption>
			<FieldError message={error} />
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
			<Check size={14} color={colors.success.ink} strokeWidth={2.4} />
			<Caption color={colors.success.ink}>{label}</Caption>
		</View>
	);
}
