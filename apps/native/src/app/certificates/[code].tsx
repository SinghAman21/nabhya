import { useLocalSearchParams } from "expo-router";
import { BadgeCheck, ShieldX } from "lucide-react-native";
import { ScrollView, View } from "react-native";
import {
	ErrorState,
	LoadingState,
	Screen,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { Body, Caption, H3, Label, Mono } from "@/components/ui/typography";
import { useVerifyCertificate } from "@/hooks/use-engagement";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { apiErrorMessage } from "@/lib/api";
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

	return (
		<Screen measure="reading" style={COLUMN}>
			<ScreenHeader
				back
				title="Verify certificate"
				// This page *is* the proof, so it is the thing to pass on - to an
				// employer, a college, a LinkedIn post.
				{...(certificate?.valid
					? {
							action: (
								<Button
									size="sm"
									variant="outline"
									onPress={() =>
										shareLink({
											message: `Volunteering certificate for ${certificate.eventTitle} with ${certificate.organizationName}, verified on Nabhya.`,
											url: publicUrl(`/certificates/${certificate.code}`),
										})
									}
									accessibilityLabel="Share this certificate's verification link"
								>
									Share link
								</Button>
							),
						}
					: {})}
			/>

			{query.isLoading ? (
				<LoadingState label="Checking the code" />
			) : query.isError || !certificate ? (
				<ErrorState
					title="No certificate found"
					message={apiErrorMessage(
						query.error,
						"No certificate exists with that code. Check it for typos and try again.",
					)}
					onRetry={() => query.refetch()}
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

						{/* What, and who */}
						<View
							style={{
								paddingHorizontal: isDesktop ? spacing[6] : spacing[4],
								paddingVertical: isDesktop ? spacing[6] : spacing[5],
								gap: spacing[1],
							}}
						>
							<Caption color="tertiary">Certificate of volunteering</Caption>
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
								half={isDesktop}
								label="Issued by"
								value={certificate.organizationName}
							/>
							<Fact
								half={isDesktop}
								label="Event date"
								value={formatDate(certificate.eventDate)}
							/>
							<Fact
								half={isDesktop}
								label="Issued on"
								value={formatDate(certificate.issuedAt)}
							/>
							<Fact
								half={isDesktop}
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
