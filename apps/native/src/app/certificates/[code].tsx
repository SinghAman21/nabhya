import { useLocalSearchParams } from "expo-router";
import { BadgeCheck, Download, SearchX, ShieldX } from "lucide-react-native";
import { Linking, ScrollView, View } from "react-native";
import { QrCode } from "@/components/qr-code";
import {
	EmptyState,
	ErrorState,
	LoadingState,
	Screen,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/overlay";
import { Body, Caption, H3, Label, Mono } from "@/components/ui/typography";
import { useVerifyCertificate } from "@/hooks/use-engagement";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { apiErrorMessage, apiErrorStatus } from "@/lib/api";
import { API_URL } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { verticalScrollbar } from "@/lib/scroll";
import { publicUrl, shareLink } from "@/lib/share-link";

/** A document, not a list: narrower than the reading column on purpose. */
const COLUMN = { width: "100%", maxWidth: 760, alignSelf: "center" } as const;

/**
 * Public certificate verification.
 *
 * Deliberately reachable without an account - a certificate is only worth
 * something if the person being shown it can check it independently.
 *
 * One card that reads like the certificate itself: the verdict as a quiet line
 * at the top (icon, tone ink, one sentence), then what was done and by whom in
 * the type hierarchy a reader expects - the event is the headline, the
 * volunteer's name under it - and the record's facts in a grid, two across on
 * desktop. The verdict used to be a 64pt disc and a display-face headline in
 * capitals, centred over a table of right-aligned values.
 */
export default function VerifyCertificate() {
	const { code } = useLocalSearchParams<{ code: string }>();
	const { colors, spacing } = useTheme();
	const { isDesktop } = useMedia();

	const query = useVerifyCertificate(code);
	const certificate = query.data;
	const verifyUrl = publicUrl(`/certificates/${certificate?.code ?? code}`);

	// The server renders the PDF on request - no stored file to go missing -
	// and the route is public by code, like this page, so it opens directly:
	// a download tab on the web, the PDF viewer or browser on a phone.
	const downloadPdf = () => {
		if (!certificate) return;
		const url = `${API_URL}/api/certificates/${encodeURIComponent(certificate.code)}/pdf`;
		Linking.openURL(url).catch(() =>
			toast.error("Couldn't open the PDF. Try again in a moment."),
		);
	};

	return (
		<Screen measure="reading" style={COLUMN}>
			<ScreenHeader back title="Verify certificate" />

			{query.isLoading ? (
				<LoadingState label="Checking the code" />
			) : query.isError && apiErrorStatus(query.error) !== 404 ? (
				<ErrorState
					title="Couldn't check this code"
					message={apiErrorMessage(query.error)}
					onRetry={() => query.refetch()}
				/>
			) : !certificate ? (
				// An unknown code is an answer, not a failure: no red title and no
				// "Try again", which would only ask the server the same question.
				<EmptyState
					icon={SearchX}
					title="No certificate with this code"
					description={`Nothing on Nabhya matches ${code ?? "this code"}. Check the code against the one printed on the certificate.`}
				/>
			) : (
				<ScrollView
					{...verticalScrollbar}
					contentContainerStyle={{ paddingBottom: spacing[10] }}
				>
					<Surface padded={false}>
						{/* Verdict */}
						<View
							accessibilityLiveRegion="polite"
							style={{
								flexDirection: "row",
								alignItems: "flex-start",
								gap: spacing[3],
								padding: isDesktop ? spacing[6] : spacing[4],
								paddingBottom: spacing[4],
							}}
						>
							<View
								style={{
									width: 36,
									height: 36,
									borderRadius: 18,
									alignItems: "center",
									justifyContent: "center",
									backgroundColor: certificate.valid
										? colors.success.bg
										: colors.error.bg,
								}}
							>
								{certificate.valid ? (
									<BadgeCheck
										size={18}
										strokeWidth={2}
										color={colors.success.ink as string}
									/>
								) : (
									<ShieldX
										size={18}
										strokeWidth={2}
										color={colors.error.ink as string}
									/>
								)}
							</View>
							<View style={{ flex: 1, minWidth: 0 }}>
								<Label
									weight="bold"
									color={
										(certificate.valid
											? colors.success.ink
											: colors.error.ink) as string
									}
								>
									{certificate.valid
										? "Valid certificate"
										: "Revoked certificate"}
								</Label>
								<Caption color="tertiary" style={{ marginTop: spacing[0.5] }}>
									{certificate.valid
										? "Issued by a verified NGO on Nabhya and not withdrawn."
										: certificate.revokedReason ||
											"This certificate has been withdrawn by the NGO that issued it."}
								</Caption>
							</View>
						</View>

						<Rule />

						<View style={{ flexDirection: isDesktop ? "row" : "column" }}>
							<View style={{ flex: 1, minWidth: 0 }}>
								{/* What, and who */}
								<View
									style={{
										paddingHorizontal: isDesktop ? spacing[6] : spacing[4],
										paddingVertical: isDesktop ? spacing[6] : spacing[5],
										gap: spacing[1],
									}}
								>
									<Caption color="tertiary">
										Certificate of volunteering
									</Caption>
									<H3 accessibilityRole="header">{certificate.eventTitle}</H3>
									<Body color="secondary">
										{certificate.volunteerName
											? `Awarded to ${certificate.volunteerName}`
											: "Awarded to a Nabhya volunteer"}
									</Body>
								</View>

								<Rule />

								{/* The record */}
								<View
									style={{
										flexDirection: "row",
										flexWrap: "wrap",
										paddingHorizontal: isDesktop ? spacing[6] : spacing[4],
										paddingVertical: spacing[4],
										rowGap: spacing[4],
									}}
								>
									<Fact
										half
										label="Issued by"
										value={certificate.organizationName}
									/>
									<Fact
										half
										label="Event date"
										value={formatDate(certificate.eventDate)}
									/>
									<Fact
										half
										label="Issued on"
										value={formatDate(certificate.issuedAt)}
									/>
									<Fact
										half
										label="Certificate code"
										value={certificate.code}
										mono
									/>
								</View>

								{certificate.note ? (
									<>
										<Rule />
										<View
											style={{
												paddingHorizontal: isDesktop ? spacing[6] : spacing[4],
												paddingVertical: spacing[4],
												gap: spacing[1],
											}}
										>
											<Caption color="tertiary">Note from the NGO</Caption>
											<Body color="secondary">{certificate.note}</Body>
										</View>
									</>
								) : null}
							</View>

							{certificate.valid ? (
								// The QR is the verification, for paper: point a phone at
								// the printed certificate and this page opens. Beside the
								// record on desktop, between it and the actions on a phone.
								<View
									style={{
										alignItems: "center",
										justifyContent: "center",
										gap: spacing[2],
										padding: isDesktop ? spacing[6] : spacing[5],
										...(isDesktop
											? {
													width: 260,
													borderLeftWidth: 1,
													borderLeftColor: colors.border.hairline,
												}
											: {
													borderTopWidth: 1,
													borderTopColor: colors.border.hairline,
												}),
									}}
								>
									<QrCode
										value={verifyUrl}
										size={isDesktop ? 168 : 148}
										label={`QR code linking to this certificate's verification page, code ${certificate.code}`}
									/>
									<Label weight="semibold" style={{ marginTop: spacing[1] }}>
										Scan to verify
									</Label>
									<Caption color="tertiary" style={{ textAlign: "center" }}>
										Opens this page on any phone.
									</Caption>
								</View>
							) : null}
						</View>

						{certificate.valid ? (
							<>
								<Rule />
								<View
									style={{
										flexDirection: "row",
										flexWrap: "wrap",
										gap: spacing[3],
										padding: isDesktop ? spacing[6] : spacing[4],
										justifyContent: isDesktop ? "flex-start" : "center",
									}}
								>
									<Button
										onPress={downloadPdf}
										leading={
											<Download
												size={16}
												strokeWidth={2.2}
												color={colors.primary.contrast}
											/>
										}
										accessibilityLabel="Download this certificate as a PDF"
									>
										Download PDF
									</Button>
									<Button
										variant="outline"
										onPress={() =>
											shareLink({
												message: `Volunteering certificate for ${certificate.eventTitle} with ${certificate.organizationName}, verified on Nabhya.`,
												url: verifyUrl,
											})
										}
										accessibilityLabel="Share this certificate's verification link"
									>
										Share link
									</Button>
								</View>
							</>
						) : null}
					</Surface>

					<Caption
						color="quaternary"
						style={{ marginTop: spacing[4], textAlign: "center" }}
					>
						Anyone can open this page with the code - no account needed.
					</Caption>
				</ScrollView>
			)}
		</Screen>
	);
}

function Rule() {
	const { colors } = useTheme();
	return (
		<View style={{ height: 1, backgroundColor: colors.border.hairline }} />
	);
}

function Fact({
	label,
	value,
	half,
	mono,
}: {
	label: string;
	value: string;
	half: boolean;
	mono?: boolean;
}) {
	const { spacing } = useTheme();
	return (
		<View
			style={{
				width: half ? "50%" : "100%",
				paddingRight: half ? spacing[4] : 0,
				gap: spacing[0.5],
			}}
		>
			<Caption color="tertiary">{label}</Caption>
			{mono ? (
				<Mono selectable>{value}</Mono>
			) : (
				<Body weight="medium" selectable>
					{value}
				</Body>
			)}
		</View>
	);
}
