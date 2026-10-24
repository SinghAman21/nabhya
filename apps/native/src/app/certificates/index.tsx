import { useRouter } from "expo-router";
import { Award } from "lucide-react-native";
import { Linking, View } from "react-native";
import { PAGE_SIZE, PagedList, usePagedQuery } from "@/components/paged-list";
import {
	EmptyState,
	Screen,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/overlay";
import { Caption, H5, Mono } from "@/components/ui/typography";
import { useCertificatePdf } from "@/hooks/use-engagement";
import { useTheme } from "@/hooks/use-theme";
import { useGridColumns } from "@/hooks/useMedia";
import { apiErrorMessage, certificatesApi, queryKeys } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { publicUrl, shareLink } from "@/lib/share-link";
import type { MyCertificate } from "@/lib/types";

/**
 * Every certificate the volunteer has earned. Each card carries the event, the
 * NGO, the public code (which is what an employer checks), and two ways to hand
 * it on: **Share link** (the public verification page, which anyone can open
 * without an account) and the PDF.
 *
 * The card opens that verification page too. It used to be reachable only by
 * tapping "Code ABC123" in grey caption type, which read as a label rather than
 * a control - so nobody found the one thing that makes a certificate worth
 * having: proof someone else can check.
 *
 * Two across on a desktop window (a certificate card is short, and one
 * 1000pt-wide card per row put the PDF button a hand-span from the title it
 * belongs to); one column on a phone. The status pill only appears when it
 * says something - "Revoked". Every other card is issued, and a green "Issued"
 * on each was a column of noise.
 */
const COLUMN = { width: "100%", maxWidth: 1040, alignSelf: "center" } as const;
export default function Certificates() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const pdf = useCertificatePdf();
	const columns = Math.min(useGridColumns(), 2);

	const { query, items, loadMore } = usePagedQuery({
		queryKey: queryKeys.certificates({ limit: PAGE_SIZE }),
		fetchPage: (page) => certificatesApi.listMine({ page, limit: PAGE_SIZE }),
	});

	const share = (certificate: MyCertificate) =>
		shareLink({
			message: `My volunteering certificate for ${certificate.event.title} with ${certificate.organization.organizationName} - verify it on Nabhya (code ${certificate.code}).`,
			url: publicUrl(`/certificates/${certificate.code}`),
		});

	const download = (certificate: MyCertificate) => {
		pdf.mutate(certificate.id, {
			onSuccess: async ({ url }) => {
				const canOpen = await Linking.canOpenURL(url);
				if (canOpen) await Linking.openURL(url);
				else toast.error("No app on this device can open a PDF.");
			},
			onError: (error) => toast.error(apiErrorMessage(error)),
		});
	};

	return (
		<Screen style={COLUMN}>
			<ScreenHeader
				back
				title="Certificates"
				subtitle="Share the link - anyone can check it, no account needed."
			/>

			<PagedList
				query={query}
				items={items}
				loadMore={loadMore}
				keyExtractor={(item) => item.id}
				numColumns={columns}
				noun="certificates"
				empty={
					<EmptyState
						icon={Award}
						title="No certificates yet"
						description="Volunteer at an event and, once the NGO marks you present, your certificate appears here."
						action={
							<Button
								size="sm"
								variant="outline"
								onPress={() => router.push("/events")}
							>
								Find an event
							</Button>
						}
					/>
				}
				renderItem={(item) => {
					const busy = pdf.isPending && pdf.variables === item.id;
					// The actions ride in `footer`, outside the card's press target:
					// a button inside a button is invalid on the web.
					const actions = (
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
							<View style={{ flex: 1, minWidth: 0 }}>
								<Caption color="tertiary">Code</Caption>
								<Mono selectable numberOfLines={1}>
									{item.code}
								</Mono>
							</View>
							{!item.revokedAt && (
								<View style={{ flexDirection: "row", gap: spacing[2] }}>
									<Button
										size="sm"
										variant="outline"
										onPress={() => share(item)}
										accessibilityLabel={`Share the verification link for ${item.event.title}`}
									>
										Share link
									</Button>
									<Button
										size="sm"
										variant="ghost"
										onPress={() => download(item)}
										loading={busy}
										accessibilityLabel={`Download PDF for ${item.event.title}`}
									>
										PDF
									</Button>
								</View>
							)}
						</View>
					);
					return (
						<Surface
							onPress={() => router.push(`/certificates/${item.code}`)}
							footer={actions}
							style={columns > 1 ? { flex: 1 } : undefined}
						>
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									justifyContent: "space-between",
									gap: spacing[2],
									marginBottom: spacing[1],
								}}
							>
								<Caption color="tertiary" numberOfLines={1} style={{ flex: 1 }}>
									{item.organization.organizationName}
								</Caption>
								{item.revokedAt ? (
									<StatusPill label="Revoked" tone="error" />
								) : null}
							</View>

							<H5 numberOfLines={2}>{item.event.title}</H5>
							<Caption color="tertiary" style={{ marginTop: spacing[0.5] }}>
								{formatDate(item.event.startAt)}
								{item.event.city ? ` · ${item.event.city}` : ""}
							</Caption>

							{item.note && (
								<Caption color="secondary" style={{ marginTop: spacing[2] }}>
									{item.note}
								</Caption>
							)}
						</Surface>
					);
				}}
			/>
		</Screen>
	);
}
