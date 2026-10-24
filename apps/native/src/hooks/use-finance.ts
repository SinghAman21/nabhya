import type {
	AdminDonationFilter,
	AdminDonationQuery,
	AdminFinancialReportQuery,
	ExportFile,
	OrgDonationExportQuery,
} from "@nabhya/shared";
import { useMutation } from "@tanstack/react-query";
import { Linking } from "react-native";
import { PAGE_SIZE, usePagedQuery } from "@/components/paged-list";
import { donationsApi, financeApi, queryKeys } from "@/lib/api";

/**
 * The superadmin ledger, page by page, with the totals the server computes
 * over the whole filter (`summary`, on every page's envelope - read from the
 * first so it does not flicker as pages load).
 */
export function useAdminDonations(query: Partial<AdminDonationQuery>) {
	const {
		query: result,
		items,
		first,
		loadMore,
	} = usePagedQuery({
		queryKey: queryKeys.adminDonations(query),
		fetchPage: (page) =>
			financeApi.donations({ ...query, page, limit: PAGE_SIZE }),
		keepPrevious: true,
	});
	return {
		query: result,
		items,
		total: first?.meta.total ?? 0,
		summary: first?.summary ?? null,
		loadMore,
	};
}

export function useAdminFinancialReports(
	query: Partial<AdminFinancialReportQuery>,
) {
	const {
		query: result,
		items,
		first,
		loadMore,
	} = usePagedQuery({
		queryKey: queryKeys.adminFinancialReports(query),
		fetchPage: (page) =>
			financeApi.financialReports({ ...query, page, limit: PAGE_SIZE }),
		keepPrevious: true,
	});
	return {
		query: result,
		items,
		total: first?.meta.total ?? 0,
		loadMore,
	};
}

/**
 * Opens a signed link the server just minted. A file is not a screen, so the
 * device's own handler takes it - the browser on web (a download), the PDF or
 * spreadsheet viewer on a phone.
 */
async function openSignedUrl(url: string) {
	const canOpen = await Linking.canOpenURL(url);
	if (!canOpen) throw new Error("No app on this device can open this file.");
	await Linking.openURL(url);
}

export function useExportDonations() {
	return useMutation({
		mutationFn: async (filter: AdminDonationFilter): Promise<ExportFile> => {
			const file = await financeApi.exportDonations(filter);
			if (file.rowCount > 0) await openSignedUrl(file.url);
			return file;
		},
	});
}

export function useExportOrgDonations() {
	return useMutation({
		mutationFn: async (query: OrgDonationExportQuery): Promise<ExportFile> => {
			const file = await donationsApi.exportForOrg(query);
			if (file.rowCount > 0) await openSignedUrl(file.url);
			return file;
		},
	});
}

export function useDonationReceiptPdf() {
	return useMutation({
		mutationFn: async (id: string) => {
			const { url } = await donationsApi.receiptPdfUrl(id);
			await openSignedUrl(url);
			return url;
		},
	});
}

/**
 * Date presets for the ledger, as the server's inclusive IST calendar days.
 * Presets rather than two date fields: finance asks "this financial year" or
 * "last 30 days", and a preset is one tap where two typed dates are twenty.
 */
export type LedgerWindow = "ALL" | "7D" | "30D" | "THIS_FY" | "LAST_FY";

export const LEDGER_WINDOWS: Array<{ value: LedgerWindow; label: string }> = [
	{ value: "ALL", label: "All time" },
	{ value: "7D", label: "Last 7 days" },
	{ value: "30D", label: "Last 30 days" },
	{ value: "THIS_FY", label: "This financial year" },
	{ value: "LAST_FY", label: "Last financial year" },
];

/** `YYYY-MM-DD` for a date in India's calendar. */
function istDay(at: Date): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Kolkata",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(at);
}

export function ledgerRange(
	window: LedgerWindow,
	now = new Date(),
): { from?: string; to?: string } {
	const today = istDay(now);
	const daysAgo = (n: number) =>
		istDay(new Date(now.getTime() - n * 24 * 60 * 60 * 1000));
	// India's financial year runs April to March.
	const [year, month] = today.split("-").map(Number) as [number, number];
	const fyStart = month >= 4 ? year : year - 1;

	switch (window) {
		case "7D":
			return { from: daysAgo(6), to: today };
		case "30D":
			return { from: daysAgo(29), to: today };
		case "THIS_FY":
			return { from: `${fyStart}-04-01`, to: today };
		case "LAST_FY":
			return { from: `${fyStart - 1}-04-01`, to: `${fyStart}-03-31` };
		default:
			return {};
	}
}
