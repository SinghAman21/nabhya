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

/**
 * Public certificate verification.
 *
 * Deliberately reachable without an account — a certificate is only worth
 * something if the person being shown it can check it independently.
 */
export default function VerifyCertificate() {
	const { code } = useLocalSearchParams<{ code: string }>();
	const { colors, spacing } = useTheme();

	const query = useVerifyCertificate(code);
	const certificate = query.data;

	return (
		<Screen>
			<ScreenHeader back title="Certificate" />

			{query.isLoading ? (
				<LoadingState label="Checking…" />
			) : query.isError || !certificate ? (
				<ErrorState
					message={apiErrorMessage(
						query.error,
						"No certificate exists with that code.",
					)}
				/>
			) : (
				<ScrollView showsVerticalScrollIndicator={false}>
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
								<BadgeCheck size={30} color={colors.success.main as string} />
							) : (
								<ShieldX size={30} color={colors.error.main as string} />
							)}
						</View>
						<H2
							style={{ textAlign: "center" }}
							color={
								certificate.valid
									? (colors.success.main as string)
									: (colors.error.main as string)
							}
						>
							{certificate.valid ? "Valid certificate" : "Revoked"}
						</H2>
						{certificate.revoked && certificate.revokedReason && (
							<Caption
								color="secondary"
								style={{ textAlign: "center", marginTop: spacing[2] }}
							>
								{certificate.revokedReason}
							</Caption>
						)}
					</View>

					<Surface>
						<Row label="Volunteer" value={certificate.volunteerName ?? "—"} />
						<Row label="Organization" value={certificate.organizationName} />
						<Row label="Event" value={certificate.eventTitle} />
						<Row label="Event date" value={formatDate(certificate.eventDate)} />
						<Row label="Issued" value={formatDate(certificate.issuedAt)} />
						<Row label="Certificate ID" value={certificate.code} last />
					</Surface>

					{certificate.note && (
						<Surface style={{ marginTop: spacing[3] }}>
							<Caption color="tertiary">Note from the organization</Caption>
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
				paddingBottom: last ? 0 : spacing[2.5],
				marginBottom: last ? 0 : spacing[2.5],
				borderBottomWidth: last ? 0 : 1,
				borderBottomColor: colors.border.light,
			}}
		>
			<Caption color="tertiary">{label}</Caption>
			<Caption
				weight="medium"
				style={{ flex: 1, textAlign: "right" }}
				numberOfLines={2}
			>
				{value}
			</Caption>
		</View>
	);
}
