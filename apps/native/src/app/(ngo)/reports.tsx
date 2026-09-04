import type { CreateFinancialReportInput } from "@nabhya/shared";
import { FINANCIAL_REPORT_LABELS, formatFinancialYear } from "@nabhya/shared";
import { useRouter } from "expo-router";
import { ArrowLeft, FileText, Plus, X } from "lucide-react-native";
import { useState } from "react";
import {
	Alert,
	FlatList,
	Modal,
	Pressable,
	RefreshControl,
	View,
} from "react-native";
import {
	EmptyState,
	ErrorState,
	LoadingState,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Body, Caption, H2, Label } from "@/components/ui/typography";
import {
	useCreateFinancialReport,
	useDeleteFinancialReport,
	useFinancialReports,
} from "@/hooks/use-directory";
import { useOpenDocument } from "@/hooks/use-documents";
import { useMe } from "@/hooks/use-profile";
import { useFileUpload } from "@/hooks/use-upload";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";
import type { FinancialReport } from "@/lib/types";

const TYPES: CreateFinancialReportInput["type"][] = [
	"ANNUAL_REPORT",
	"AUDITED_STATEMENT",
	"FCRA_RETURN",
	"UTILISATION_CERTIFICATE",
	"OTHER",
];

/**
 * Transparency documents an NGO publishes voluntarily.
 *
 * Distinct from verification documents, which are private and reviewed by a
 * superadmin — everything here is public, and is what a donor reads before
 * deciding to trust the organization.
 */
export default function OrgReports() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const [composing, setComposing] = useState(false);

	const { data: me } = useMe();
	const query = useFinancialReports(me?.organization?.id);
	const remove = useDeleteFinancialReport();
	const openDocument = useOpenDocument();

	const confirmDelete = (report: FinancialReport) => {
		Alert.alert(
			"Withdraw report",
			`"${report.title}" will no longer be visible on your public profile.`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Withdraw",
					style: "destructive",
					onPress: () =>
						remove.mutate(report.id, {
							onError: (error) =>
								Alert.alert("Could not withdraw", apiErrorMessage(error)),
						}),
				},
			],
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
			<Pressable
				onPress={() => router.back()}
				hitSlop={12}
				style={{ marginBottom: spacing[4] }}
			>
				<ArrowLeft size={22} color={colors.text.secondary as string} />
			</Pressable>

			<ScreenHeader
				title="Transparency"
				subtitle="Annual reports and audited statements, shown publicly."
				action={
					<Pressable
						onPress={() => setComposing(true)}
						style={{
							width: 44,
							height: 44,
							borderRadius: 22,
							alignItems: "center",
							justifyContent: "center",
							backgroundColor: colors.primary.main,
						}}
					>
						<Plus size={22} color={colors.primary.contrast as string} />
					</Pressable>
				}
			/>

			{query.isLoading ? (
				<LoadingState />
			) : query.isError ? (
				<ErrorState
					message={apiErrorMessage(query.error)}
					onRetry={() => query.refetch()}
				/>
			) : (
				<FlatList
					data={query.data ?? []}
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
							icon={FileText}
							title="Nothing published yet"
							description="Publishing your annual report is the strongest trust signal you can give a donor."
							action={
								<Button onPress={() => setComposing(true)}>
									Publish a report
								</Button>
							}
						/>
					}
					renderItem={({ item }) => (
						<Surface>
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									gap: spacing[3],
								}}
							>
								<FileText size={18} color={colors.text.secondary as string} />
								<View style={{ flex: 1 }}>
									<Body weight="medium" numberOfLines={1}>
										{item.title}
									</Body>
									<Caption color="tertiary">
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
									gap: spacing[4],
									marginTop: spacing[3],
								}}
							>
								<Pressable
									onPress={() => openDocument.mutate(item.documentKey)}
									hitSlop={8}
								>
									<Caption
										weight="medium"
										color={colors.primary.main as string}
									>
										{openDocument.isPending ? "Opening…" : "View"}
									</Caption>
								</Pressable>
								<Pressable onPress={() => confirmDelete(item)} hitSlop={8}>
									<Caption weight="medium" color={colors.error.main as string}>
										Withdraw
									</Caption>
								</Pressable>
							</View>
						</Surface>
					)}
				/>
			)}

			<ReportSheet visible={composing} onClose={() => setComposing(false)} />
		</View>
	);
}

function ReportSheet({
	visible,
	onClose,
}: {
	visible: boolean;
	onClose: () => void;
}) {
	const { colors, spacing } = useTheme();
	const currentYear = new Date().getFullYear();

	const [type, setType] =
		useState<CreateFinancialReportInput["type"]>("ANNUAL_REPORT");
	const [title, setTitle] = useState("");
	const [year, setYear] = useState(String(currentYear - 1));
	const [documentKey, setDocumentKey] = useState<string | null>(null);
	const [fileName, setFileName] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const create = useCreateFinancialReport();
	const {
		pickAndUpload,
		isUploading,
		error: uploadError,
	} = useFileUpload("FINANCIAL_REPORT");

	const attach = async () => {
		const picked = await pickAndUpload();
		if (picked) {
			setDocumentKey(picked.key);
			setFileName(picked.fileName);
		}
	};

	const submit = () => {
		if (!documentKey) {
			setError("Attach the document first.");
			return;
		}
		setError(null);
		create.mutate(
			{
				type,
				title: title.trim(),
				financialYear: Number(year),
				documentKey,
			},
			{
				onSuccess: () => {
					setTitle("");
					setDocumentKey(null);
					setFileName(null);
					onClose();
				},
				onError: (e) => setError(apiErrorMessage(e)),
			},
		);
	};

	const inputStyle = {
		borderWidth: 0,
		borderRadius: 12,
		backgroundColor: colors.background.tertiary,
		paddingVertical: spacing[3.5],
	} as const;

	return (
		<Modal
			visible={visible}
			animationType="slide"
			presentationStyle="pageSheet"
			onRequestClose={onClose}
		>
			<View style={{ flex: 1, backgroundColor: colors.background.warm }}>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						justifyContent: "space-between",
						paddingHorizontal: spacing[6],
						paddingTop: spacing[6],
						paddingBottom: spacing[2],
					}}
				>
					<H2>Publish report</H2>
					<Pressable onPress={onClose} hitSlop={12}>
						<X size={22} color={colors.text.tertiary as string} />
					</Pressable>
				</View>

				<View style={{ padding: spacing[6], paddingTop: spacing[4] }}>
					<Label style={{ marginBottom: spacing[2] }}>Document type</Label>
					<View
						style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}
					>
						{TYPES.map((option) => {
							const active = type === option;
							return (
								<Pressable
									key={option}
									onPress={() => setType(option)}
									style={{
										paddingHorizontal: spacing[3.5],
										paddingVertical: spacing[2],
										borderRadius: 999,
										backgroundColor: active
											? colors.primary.main
											: colors.background.tertiary,
									}}
								>
									<Caption
										weight={active ? "bold" : "medium"}
										color={
											active ? (colors.primary.contrast as string) : "secondary"
										}
									>
										{FINANCIAL_REPORT_LABELS[option]}
									</Caption>
								</Pressable>
							);
						})}
					</View>

					<Label style={{ marginTop: spacing[5], marginBottom: spacing[1.5] }}>
						Title
					</Label>
					<Input
						placeholder="e.g. Annual Report 2024-25"
						value={title}
						onChangeText={setTitle}
						style={inputStyle}
					/>

					<Label style={{ marginTop: spacing[5], marginBottom: spacing[1.5] }}>
						Financial year starting
					</Label>
					<Input
						placeholder={String(currentYear - 1)}
						value={year}
						onChangeText={(v) => setYear(v.replace(/\D/g, ""))}
						keyboardType="number-pad"
						maxLength={4}
						style={[inputStyle, { maxWidth: 140 }]}
					/>

					<Pressable
						onPress={attach}
						disabled={isUploading}
						style={{
							marginTop: spacing[5],
							borderWidth: 2,
							borderStyle: "dashed",
							borderColor: documentKey
								? colors.success.main
								: colors.border.medium,
							borderRadius: 16,
							padding: spacing[5],
							alignItems: "center",
						}}
					>
						<Caption
							color={documentKey ? "primary" : "secondary"}
							weight="medium"
						>
							{isUploading ? "Uploading…" : (fileName ?? "Attach the PDF")}
						</Caption>
					</Pressable>

					{(error || uploadError) && (
						<Caption
							color={colors.error.main as string}
							style={{ marginTop: spacing[3] }}
						>
							{error ?? uploadError}
						</Caption>
					)}

					<Button
						onPress={submit}
						loading={create.isPending}
						style={{ marginTop: spacing[6] }}
					>
						Publish
					</Button>
				</View>
			</View>
		</Modal>
	);
}
