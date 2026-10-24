import {
	type CreateFinancialReportInput,
	createFinancialReportSchema,
	FINANCIAL_REPORT_LABELS,
	formatFinancialYear,
} from "@nabhya/shared";
import { useRouter } from "expo-router";
import { FileText, Image as ImageIcon, Upload } from "lucide-react-native";
import { useState } from "react";
import {
	ActivityIndicator,
	FlatList,
	RefreshControl,
	View,
} from "react-native";
import { ChoiceChips } from "@/components/choice-chips";
import { FeedMediaViewer } from "@/components/feed/feed-media";
import { Field, FieldError, useFieldInputStyle } from "@/components/form-field";
import { FormFooterRow, useFormButtonGrow } from "@/components/ngo/form-footer";
import {
	Banner,
	EmptyState,
	ErrorState,
	GridCell,
	Screen,
	ScreenHeader,
	SkeletonList,
	Surface,
} from "@/components/screen-shell";
import { TextAction } from "@/components/text-action";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { confirm, toast } from "@/components/ui/overlay";
import { Pressable } from "@/components/ui/pressable";
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
import { useGridColumns, useMedia } from "@/hooks/useMedia";
import { apiErrorMessage, uploadsApi } from "@/lib/api";
import { focusable } from "@/lib/focus";
import { formatDate } from "@/lib/format";
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

/** A report scanned as a photo opens in the app; a PDF goes to the OS viewer. */
function isImageKey(key: string) {
	return /\.(jpe?g|png|webp|gif|heic)$/i.test(key);
}

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
 *
 * **View** opens an image in the app's own viewer (`FeedMediaViewer`, the
 * feed's), and a PDF in the browser or the OS viewer, which renders one far
 * better than anything we would draw. It used to send both outside the app,
 * so a photographed certificate left the app to show one picture.
 */
export default function OrgReports() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const { isDesktop } = useMedia();
	const [composing, setComposing] = useState(false);
	const [viewer, setViewer] = useState<{ title: string; url: string } | null>(
		null,
	);
	const [opening, setOpening] = useState<string | null>(null);
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

	const view = async (report: FinancialReport) => {
		setOpening(report.id);
		try {
			if (isImageKey(report.documentKey)) {
				const { url } = await uploadsApi.downloadUrl(report.documentKey);
				setViewer({ title: report.title, url });
			} else {
				await openDocument.mutateAsync(report.documentKey);
			}
		} catch (error) {
			toast.error(apiErrorMessage(error));
		} finally {
			setOpening(null);
		}
	};

	const openCreate = () => setComposing(true);

	return (
		<Screen>
			<ScreenHeader
				// A rail destination on desktop; a pushed page on a phone.
				back={!isDesktop}
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
				<SkeletonList variant="card" columns={columns} count={3} />
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
							<ReportCard
								report={item}
								opening={opening === item.id}
								onView={() => view(item)}
								onWithdraw={canWithdraw ? () => confirmDelete(item) : undefined}
							/>
						</GridCell>
					)}
				/>
			)}

			<ReportSheet visible={composing} onClose={() => setComposing(false)} />

			{viewer && (
				<FeedMediaViewer
					visible
					media={[
						{ id: viewer.url, type: "IMAGE", url: viewer.url, sortOrder: 0 },
					]}
					initialIndex={0}
					// No like, comment, save or share on a report - the viewer
					// drops its action bar when none is given.
					actions={{
						headline: viewer.title,
						liked: false,
						saved: false,
						commentCount: 0,
					}}
					onClose={() => setViewer(null)}
				/>
			)}
		</Screen>
	);
}

/**
 * One report. The title leads (two lines, since "Audited statement of
 * accounts 2024-25" is a normal title), with what kind of document it is and
 * which year it covers under it, and the file kind on the tile so a donor
 * knows whether View leaves the app. The footer holds the date and the two
 * actions as separate controls.
 */
function ReportCard({
	report,
	opening,
	onView,
	onWithdraw,
}: {
	report: FinancialReport;
	opening: boolean;
	onView: () => void;
	onWithdraw?: () => void;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	const image = isImageKey(report.documentKey);
	const Icon = image ? ImageIcon : FileText;
	const typeLabel =
		FINANCIAL_REPORT_LABELS[
			report.type as keyof typeof FINANCIAL_REPORT_LABELS
		] ?? report.type;

	return (
		<Surface
			footer={
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						justifyContent: "space-between",
						gap: spacing[3],
						marginTop: spacing[3],
						paddingTop: spacing[3],
						borderTopWidth: 1,
						borderTopColor: colors.border.hairline,
					}}
				>
					<Caption color="quaternary" numberOfLines={1} style={{ flex: 1 }}>
						Published {formatDate(report.createdAt)}
					</Caption>
					<View style={{ flexDirection: "row", gap: spacing[4] }}>
						<TextAction
							label={opening ? "Opening..." : image ? "View" : "Open PDF"}
							tone="brand"
							disabled={opening}
							onPress={onView}
							accessibilityLabel={`View ${report.title}`}
						/>
						{onWithdraw && (
							<TextAction
								label="Withdraw"
								tone="danger"
								onPress={onWithdraw}
								accessibilityLabel={`Withdraw ${report.title}`}
							/>
						)}
					</View>
				</View>
			}
		>
			<View
				style={{
					flexDirection: "row",
					alignItems: "flex-start",
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
					<Icon
						size={18}
						color={colors.text.secondary as string}
						strokeWidth={1.75}
					/>
				</View>
				<View style={{ flex: 1, minWidth: 0 }}>
					<Body weight="bold" numberOfLines={2}>
						{report.title}
					</Body>
					<Caption
						color="tertiary"
						numberOfLines={1}
						style={{ marginTop: spacing[0.5] }}
					>
						{typeLabel} · {formatFinancialYear(report.financialYear)}
					</Caption>
					{report.notes ? (
						<Caption
							color="quaternary"
							numberOfLines={2}
							style={{ marginTop: spacing[1] }}
						>
							{report.notes}
						</Caption>
					) : null}
				</View>
			</View>
		</Surface>
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
	const grow = useFormButtonGrow();
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
		<Drawer
			visible={visible}
			onClose={close}
			wide
			title="Publish a report"
			subtitle="Visible to everyone on your public profile."
			footer={
				<View style={{ gap: spacing[2] }}>
					<FieldError message={errors.form} />
					<FormFooterRow
						primary={
							<Button
								onPress={submit}
								loading={create.isPending}
								disabled={isUploading}
								style={grow}
							>
								Publish report
							</Button>
						}
					/>
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
						placeholder="e.g. Annual report 2024-25"
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
									? "Uploading..."
									: (fileName ?? "Attach the document")}
							</Body>
							<Caption color="quaternary">
								{documentKey ? "Tap to replace" : "Opens your files"}
							</Caption>
						</View>
					</Pressable>
				</Field>
			</View>
		</Drawer>
	);
}
