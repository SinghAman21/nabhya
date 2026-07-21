import { FileText, Plus } from "lucide-react-native";
import { useState } from "react";
import { Alert, Linking, Pressable, View } from "react-native";
import { Surface } from "@/components/screen-shell";
import {
	humanizeStatus,
	StatusPill,
	verificationTone,
} from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Body, Caption, Label } from "@/components/ui/typography";
import { useTheme } from "@/hooks/useTheme";
import { formatRelative } from "@/lib/format";
import type { OwnedDocument } from "@/lib/types";

export interface DocumentTypeOption {
	value: string;
	label: string;
}

/**
 * Verification-document list + submit form, shared by the volunteer identity
 * section and the NGO legal-documents section. There is no file storage yet —
 * the API stores a link to the document, so the form takes a URL.
 */
export function DocumentsCard({
	title,
	hint,
	documents,
	isLoading,
	typeOptions,
	onSubmit,
	submitting,
}: {
	title: string;
	hint: string;
	documents: OwnedDocument[] | undefined;
	isLoading: boolean;
	typeOptions: DocumentTypeOption[];
	onSubmit: (
		input: { documentType: string; documentUrl: string },
		onDone: () => void,
	) => void;
	submitting: boolean;
}) {
	const { colors, spacing } = useTheme();
	const [adding, setAdding] = useState(false);
	const [documentType, setDocumentType] = useState(
		typeOptions[0]?.value ?? "OTHER",
	);
	const [documentUrl, setDocumentUrl] = useState("");

	const labelFor = (value: string) =>
		typeOptions.find((o) => o.value === value)?.label ?? humanizeStatus(value);

	const submit = () => {
		if (!documentUrl.trim()) {
			Alert.alert("Missing link", "Paste a link to the document first.");
			return;
		}
		onSubmit({ documentType, documentUrl: documentUrl.trim() }, () => {
			setAdding(false);
			setDocumentUrl("");
		});
	};

	return (
		<Surface>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
				}}
			>
				<Body weight="bold">{title}</Body>
				{!adding && (
					<Pressable
						onPress={() => setAdding(true)}
						hitSlop={8}
						style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
					>
						<Plus size={14} color={colors.primary.main as string} />
						<Caption weight="medium" color={colors.primary.main as string}>
							Add
						</Caption>
					</Pressable>
				)}
			</View>
			<Caption color="tertiary" style={{ marginTop: 2 }}>
				{hint}
			</Caption>

			{isLoading ? (
				<Caption color="quaternary" style={{ marginTop: spacing[3] }}>
					Loading documents…
				</Caption>
			) : (documents?.length ?? 0) === 0 && !adding ? (
				<View
					style={{
						alignItems: "center",
						paddingVertical: spacing[4],
						marginTop: spacing[2],
					}}
				>
					<FileText size={20} color={colors.text.quaternary as string} />
					<Caption color="quaternary" style={{ marginTop: spacing[1.5] }}>
						No documents submitted yet
					</Caption>
				</View>
			) : (
				(documents ?? []).map((doc) => (
					<Pressable
						key={doc.id}
						onPress={() => Linking.openURL(doc.documentUrl)}
						style={{
							marginTop: spacing[3],
							paddingTop: spacing[3],
							borderTopWidth: 1,
							borderTopColor: colors.border.light,
						}}
					>
						<View
							style={{
								flexDirection: "row",
								alignItems: "center",
								justifyContent: "space-between",
								gap: spacing[2],
							}}
						>
							<View style={{ flex: 1 }}>
								<Body numberOfLines={1}>{labelFor(doc.documentType)}</Body>
								<Caption color="quaternary">
									Submitted {formatRelative(doc.uploadedAt)}
								</Caption>
							</View>
							<StatusPill
								label={humanizeStatus(doc.verificationStatus ?? "PENDING")}
								tone={verificationTone(doc.verificationStatus)}
							/>
						</View>
						{doc.verificationStatus === "REJECTED" && doc.remarks && (
							<Caption
								color={colors.error.main as string}
								style={{ marginTop: spacing[1.5] }}
							>
								{doc.remarks}
							</Caption>
						)}
					</Pressable>
				))
			)}

			{adding && (
				<View
					style={{
						marginTop: spacing[4],
						paddingTop: spacing[4],
						borderTopWidth: 1,
						borderTopColor: colors.border.light,
					}}
				>
					<Label style={{ marginBottom: spacing[2] }}>Document type</Label>
					<View
						style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}
					>
						{typeOptions.map((option) => {
							const active = documentType === option.value;
							return (
								<Pressable
									key={option.value}
									onPress={() => setDocumentType(option.value)}
									style={{
										paddingHorizontal: spacing[3],
										paddingVertical: spacing[2],
										borderRadius: 999,
										backgroundColor: active
											? colors.primary.main
											: colors.background.tertiary,
									}}
								>
									<Caption
										weight={active ? "bold" : "normal"}
										color={
											active ? (colors.primary.contrast as string) : "secondary"
										}
									>
										{option.label}
									</Caption>
								</Pressable>
							);
						})}
					</View>

					<Label style={{ marginTop: spacing[4], marginBottom: spacing[1.5] }}>
						Link to the document
					</Label>
					<Input
						placeholder="https://drive.google.com/…"
						value={documentUrl}
						onChangeText={setDocumentUrl}
						autoCapitalize="none"
						keyboardType="url"
						style={{
							borderWidth: 0,
							borderRadius: 12,
							backgroundColor: colors.background.tertiary,
							paddingVertical: spacing[3.5],
						}}
					/>
					<Caption color="quaternary" style={{ marginTop: spacing[1.5] }}>
						Upload the file to a cloud drive and paste a shareable link.
					</Caption>

					<View
						style={{
							flexDirection: "row",
							gap: spacing[2],
							marginTop: spacing[4],
						}}
					>
						<Button
							onPress={submit}
							loading={submitting}
							style={{ flex: 1 }}
							size="sm"
						>
							Submit for review
						</Button>
						<Button
							variant="outline"
							onPress={() => setAdding(false)}
							disabled={submitting}
							size="sm"
						>
							Cancel
						</Button>
					</View>
				</View>
			)}
		</Surface>
	);
}
