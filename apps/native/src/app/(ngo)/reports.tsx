import {
	type CreateFinancialReportInput,
	createFinancialReportSchema,
	FINANCIAL_REPORT_LABELS,
	formatFinancialYear,
} from "@nabhya/shared";
import { useRouter } from "expo-router";
import { FileText, Upload } from "lucide-react-native";
import { useState } from "react";
import {
	ActivityIndicator,
	FlatList,
	RefreshControl,
	View,
} from "react-native";
import { ChoiceChips } from "@/components/choice-chips";
import { Field, FieldError, useFieldInputStyle } from "@/components/form-field";
import {
	Banner,
	EmptyState,
	ErrorState,
	GridCell,
	LoadingState,
	Screen,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import { TextAction } from "@/components/text-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirm, toast } from "@/components/ui/overlay";
import { Pressable } from "@/components/ui/pressable";
import { Sheet } from "@/components/ui/sheet";
import { Body, Caption } from "@/components/ui/typography";
import {
	useCreateFinancialReport,
	useDeleteFinancialReport,
	useFinancialReports,
} from "@/hooks/use-directory";
import { useOpenDocument } from "@/hooks/use-documents";
import { useOrgAccess } from "@/hooks/use-org-access";
import { useMe } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { useFileUpload } from "@/hooks/use-upload";
import { useGridColumns } from "@/hooks/useMedia";
import { apiErrorMessage } from "@/lib/api";
import { focusable } from "@/lib/focus";
import { formatRelative } from "@/lib/format";
import { verticalScrollbar } from "@/lib/scroll";
import type { FinancialReport } from "@/lib/types";

type ReportType = CreateFinancialReportInput["type"];

const TYPES: Array<{ value: ReportType; label: string }> = (
	[
		"ANNUAL_REPORT",
		"AUDITED_STATEMENT",
		"FCRA_RETURN",
		"UTILISATION_CERTIFICATE",
		"OTHER",
	] as ReportType[]
).map((value) => ({ value, label: FINANCIAL_REPORT_LABELS[value] }));

/**
 * Transparency documents an NGO publishes voluntarily.
 *
 * Distinct from verification documents, which are private and reviewed by a
 * superadmin - everything here is public, and is what a donor reads before
 * deciding to trust the organization. The endpoint returns the full list, so
 * there is no paging here.
 *
 * The list is the *public* endpoint, which 404s for an NGO that is not yet
 * verified - and such an NGO cannot have published one (`reports.manage` plus
 * verification, server-side). So the query waits for verification and the
 * screen says what unlocks it, instead of opening on an error.
 */
export default function OrgReports() {
	const { colors, spacing, borderRadius } = useTheme();
	const router = useRouter();
	const [composing, setComposing] = useState(false);
	const access = useOrgAccess();

	const me = useMe();
	const query = useFinancialReports(
		access.isVerified && !access.isSuspended
			? me.data?.organization?.id
			: undefined,
	);
	const publishBlocked = access.blocked("reports.manage", { public: true });
	const canWithdraw = !access.blocked("reports.manage");
	const columns = useGridColumns();
	const remove = useDeleteFinancialReport();
	const openDocument = useOpenDocument();

	const items = query.data ?? [];

	const confirmDelete = async (report: FinancialReport) => {
		const ok = await confirm({
			title: "Withdraw this report?",
			message: `"${report.title}" will no longer be visible on your public profile. Transparency reports are what donors look for, so withdrawing one is visible by its absence.`,
			confirmLabel: "Withdraw",
		});
		if (!ok) return;
		remove.mutate(report.id, {
			onSuccess: () => toast.success("Report withdrawn."),
			onError: (error) => toast.error(apiErrorMessage(error)),
		});
	};

	const openCreate = () => setComposing(true);

	return (
		<Screen>
			<ScreenHeader
				back
				title="Reports"
				subtitle="Public on your profile"
				action={
					<Button size="sm" onPress={openCreate} disabled={!!publishBlocked}>
						Publish
					</Button>
				}
			/>

			{publishBlocked && (
				<View style={{ marginBottom: spacing[4] }}>
					{!access.isVerified && !access.isSuspended ? (
						<Banner
							tone="warning"
							title="Reports unlock once you're verified"
							description="Everything here is public on your profile, so publishing waits for your documents to be approved."
							onPress={() => router.push("/(ngo)/verification")}
						/>
					) : (
						<Banner
							tone="info"
							title="View only"
							description={publishBlocked}
						/>
					)}
				</View>
			)}

			{!access.isVerified || access.isSuspended ? null : me.isLoading ||
				query.isLoading ? (
				<LoadingState />
			) : me.isError || query.isError ? (
				<ErrorState
					message={apiErrorMessage(me.error ?? query.error)}
					onRetry={() => (me.isError ? me.refetch() : query.refetch())}
				/>
			) : (
				<FlatList
					key={`grid-${columns}`}
					numColumns={columns}
					columnWrapperStyle={columns > 1 ? { gap: spacing[3] } : undefined}
					data={items}
					keyExtractor={(item) => item.id}
					{...verticalScrollbar}
					contentContainerStyle={{ paddingBottom: spacing[10] }}
					ItemSeparatorComponent={() => <View style={{ height: spacing[3] }} />}
					refreshControl={
						<RefreshControl
							refreshing={query.isRefetching}
							onRefresh={() => query.refetch()}
							tintColor={colors.text.quaternary as string}
						/>
					}
					ListEmptyComponent={
						<EmptyState
							icon={FileText}
							title="Nothing published yet"
							description="Annual reports, audited statements and FCRA returns. Publishing them here is the strongest trust signal you can give a donor."
							action={
								publishBlocked ? undefined : (
									<Button onPress={openCreate}>Publish a report</Button>
								)
							}
						/>
					}
					renderItem={({ item }) => (
						<GridCell>
							<Surface onPress={() => openDocument.mutate(item.documentKey)}>
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
											borderRadius: borderRadius.md,
											alignItems: "center",
											justifyContent: "center",
											backgroundColor: colors.background.subtle,
										}}
									>
										<FileText
											size={18}
											color={colors.text.secondary as string}
											strokeWidth={1.75}
										/>
									</View>
									<View style={{ flex: 1, minWidth: 0 }}>
										<Body weight="bold" numberOfLines={1}>
											{item.title}
										</Body>
										<Caption color="tertiary" numberOfLines={1}>
											{FINANCIAL_REPORT_LABELS[
												item.type as keyof typeof FINANCIAL_REPORT_LABELS
											] ?? item.type}{" "}
											· {formatFinancialYear(item.financialYear)}
										</Caption>
									</View>
								</View>

								<View
									style={{
										flexDirection: "row",
										alignItems: "center",
										justifyContent: "space-between",
										marginTop: spacing[3],
										paddingTop: spacing[3],
										borderTopWidth: 1,
										borderTopColor: colors.border.hairline,
									}}
								>
									<Caption color="quaternary">
										Published {formatRelative(item.createdAt)}
									</Caption>
									<View style={{ flexDirection: "row", gap: spacing[3] }}>
										<TextAction
											label={
												openDocument.isPending &&
												openDocument.variables === item.documentKey
													? "Opening…"
													: "View"
											}
											tone="brand"
											disabled={openDocument.isPending}
											onPress={() => openDocument.mutate(item.documentKey)}
											accessibilityLabel={`View ${item.title}`}
										/>
										{canWithdraw && (
											<TextAction
												label="Withdraw"
												tone="danger"
												onPress={() => confirmDelete(item)}
												accessibilityLabel={`Withdraw ${item.title}`}
											/>
										)}
									</View>
								</View>
							</Surface>
						</GridCell>
					)}
				/>
			)}

			<ReportSheet visible={composing} onClose={() => setComposing(false)} />
		</Screen>
	);
}

function ReportSheet({
	visible,
	onClose,
}: {
	visible: boolean;
	onClose: () => void;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	const inputStyle = useFieldInputStyle();
	const currentYear = new Date().getFullYear();

	const [type, setType] = useState<ReportType>("ANNUAL_REPORT");
	const [title, setTitle] = useState("");
	const [year, setYear] = useState(String(currentYear - 1));
	// The hint explains the convention; a half-typed year falls back to last
	// year's rather than printing "NaN".
	const yearForHint = /^\d{4}$/.test(year) ? Number(year) : currentYear - 1;
	const [documentKey, setDocumentKey] = useState<string | null>(null);
	const [fileName, setFileName] = useState<string | null>(null);
	const [errors, setErrors] = useState<Record<string, string>>({});

	const create = useCreateFinancialReport();
	// Reports have their own storage purpose; `ORG_DOCUMENT` is for
	// verification documents and the server refuses it without a document type.
	const {
		pickAndUpload,
		isUploading,
		error: uploadError,
	} = useFileUpload("FINANCIAL_REPORT");

	const reset = () => {
		setType("ANNUAL_REPORT");
		setTitle("");
		setYear(String(currentYear - 1));
		setDocumentKey(null);
		setFileName(null);
		setErrors({});
	};

	const close = () => {
		reset();
		onClose();
	};

	const attach = async () => {
		const picked = await pickAndUpload();
		if (picked) {
			setDocumentKey(picked.key);
			setFileName(picked.fileName);
			setErrors((e) => ({ ...e, documentKey: "" }));
		}
	};

	const submit = () => {
		const parsed = createFinancialReportSchema.safeParse({
			type,
			title,
			financialYear: year,
			documentKey: documentKey ?? "",
		});
		if (!parsed.success) {
			const fieldErrors: Record<string, string> = {};
			for (const issue of parsed.error.issues) {
				const key = String(issue.path[0] ?? "form");
				if (!fieldErrors[key]) fieldErrors[key] = issue.message;
			}
			setErrors(fieldErrors);
			return;
		}
		setErrors({});
		create.mutate(parsed.data, {
			onSuccess: () => {
				toast.success("Report published on your profile.");
				close();
			},
			onError: (e) => setErrors({ form: apiErrorMessage(e) }),
		});
	};

	return (
		<Sheet
			visible={visible}
			onClose={close}
			title="Publish a report"
			subtitle="Visible to everyone on your public profile."
			footer={
				<View style={{ gap: spacing[2] }}>
					<FieldError message={errors.form} />
					<Button
						onPress={submit}
						loading={create.isPending}
						disabled={isUploading}
					>
						Publish
					</Button>
				</View>
			}
		>
			<View style={{ paddingTop: spacing[2] }}>
				<Field label="Document type" error={errors.type}>
					<ChoiceChips
						label="Document type"
						options={TYPES}
						value={type}
						onChange={setType}
					/>
				</Field>

				<Field label="Title" error={errors.title}>
					<Input
						placeholder="e.g. Annual Report 2024–25"
						value={title}
						onChangeText={setTitle}
						style={inputStyle}
					/>
				</Field>

				<Field
					label="Financial year starting"
					error={errors.financialYear}
					hint={`${yearForHint} means ${formatFinancialYear(yearForHint)}`}
				>
					<Input
						placeholder={String(currentYear - 1)}
						value={year}
						onChangeText={(v) => setYear(v.replace(/\D/g, ""))}
						keyboardType="number-pad"
						maxLength={4}
						style={[inputStyle, { maxWidth: 140 }]}
					/>
				</Field>

				<Field
					label="Document"
					error={errors.documentKey || uploadError || undefined}
					hint="PDF, JPG, PNG or WebP · up to 10 MB"
				>
					<Pressable
						onPress={attach}
						disabled={isUploading}
						accessibilityRole="button"
						accessibilityLabel={
							documentKey ? "Replace the attached file" : "Attach the document"
						}
						accessibilityState={{ busy: isUploading, disabled: isUploading }}
						{...focusable}
						style={({ pressed }) => ({
							flexDirection: "row",
							alignItems: "center",
							gap: spacing[3],
							padding: spacing[4],
							borderRadius: borderRadius.md,
							borderWidth: documentKey ? 0 : 1.5,
							borderStyle: "dashed",
							borderColor: pressed ? colors.text.primary : colors.border.dark,
							backgroundColor: documentKey
								? colors.background.tertiary
								: pressed
									? colors.background.subtle
									: "transparent",
							opacity: isUploading ? 0.7 : 1,
						})}
					>
						{isUploading ? (
							<ActivityIndicator
								size="small"
								color={colors.text.secondary as string}
							/>
						) : documentKey ? (
							<FileText
								size={18}
								color={colors.success.ink}
								strokeWidth={1.75}
							/>
						) : (
							<Upload
								size={18}
								color={colors.text.secondary as string}
								strokeWidth={1.75}
							/>
						)}
						<View style={{ flex: 1, minWidth: 0 }}>
							<Body weight="medium" numberOfLines={1}>
								{isUploading
									? "Uploading…"
									: (fileName ?? "Attach the document")}
							</Body>
							<Caption color="quaternary">
								{documentKey ? "Tap to replace" : "Opens your files"}
							</Caption>
						</View>
					</Pressable>
				</Field>
			</View>
		</Sheet>
	);
}
