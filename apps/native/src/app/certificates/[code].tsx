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
import { Body, Caption, H2 } from "@/components/ui/typography";
import { useVerifyCertificate } from "@/hooks/use-engagement";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { verticalScrollbar } from "@/lib/scroll";

/**
 * Public certificate verification.
 *
 * Deliberately reachable without an account - a certificate is only worth
 * something if the person being shown it can check it independently. The
 * verdict comes first and unmissable; the facts follow.
 */
export default function VerifyCertificate() {
	const { code } = useLocalSearchParams<{ code: string }>();
	const { colors, spacing } = useTheme();

	const query = useVerifyCertificate(code);
	const certificate = query.data;

	return (
		<Screen>
			<ScreenHeader back title="Verify certificate" />

			{query.isLoading ? (
				<LoadingState label="Checking the code" />
			) : query.isError || !certificate ? (
				<ErrorState
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
					<View style={{ alignItems: "center", marginBottom: spacing[6] }}>
						<View
							style={{
								width: 64,
								height: 64,
								borderRadius: 32,
								alignItems: "center",
								justifyContent: "center",
								backgroundColor: certificate.valid
									? colors.success.bg
									: colors.error.bg,
								marginBottom: spacing[3],
							}}
						>
							{certificate.valid ? (
								<BadgeCheck size={30} color={colors.success.ink} />
							) : (
								<ShieldX size={30} color={colors.error.ink} />
							)}
						</View>
						<H2
							accessibilityRole="header"
							style={{ textAlign: "center" }}
							color={certificate.valid ? colors.success.ink : colors.error.ink}
						>
							{certificate.valid ? "Valid certificate" : "Revoked certificate"}
						</H2>
						<Caption
							color="tertiary"
							style={{ textAlign: "center", marginTop: spacing[1] }}
						>
							{certificate.valid
								? "Issued by a verified NGO on Nabhya."
								: certificate.revokedReason ||
									"This certificate has been withdrawn by the NGO that issued it."}
						</Caption>
					</View>

					<Surface padded={false}>
						<Row label="Volunteer" value={certificate.volunteerName ?? "-"} />
						<Row label="Organisation" value={certificate.organizationName} />
						<Row label="Event" value={certificate.eventTitle} />
						<Row label="Event date" value={formatDate(certificate.eventDate)} />
						<Row label="Issued on" value={formatDate(certificate.issuedAt)} />
						<Row label="Certificate code" value={certificate.code} last />
					</Surface>

					{certificate.note && (
						<Surface style={{ marginTop: spacing[3] }}>
							<Caption color="tertiary">Note from the organisation</Caption>
							<Body color="secondary" style={{ marginTop: spacing[1] }}>
								{certificate.note}
							</Body>
						</Surface>
					)}
				</ScrollView>
			)}
		</Screen>
	);
}

function Row({
	label,
	value,
	last,
}: {
	label: string;
	value: string;
	last?: boolean;
}) {
	const { colors, spacing } = useTheme();
	return (
		<View
			style={{
				flexDirection: "row",
				justifyContent: "space-between",
				gap: spacing[4],
				paddingHorizontal: spacing[4],
				paddingVertical: spacing[3],
				borderBottomWidth: last ? 0 : 1,
				borderBottomColor: colors.border.hairline,
			}}
		>
			<Caption color="tertiary">{label}</Caption>
			<Body
				weight="medium"
				style={{ flex: 1, textAlign: "right" }}
				numberOfLines={2}
			>
				{value}
			</Body>
		</View>
	);
}
