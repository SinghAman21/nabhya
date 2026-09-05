import { Award } from "lucide-react-native";
import { FlatList, Linking, RefreshControl, View } from "react-native";
import {
	EmptyState,
	ErrorState,
	LoadingState,
	Screen,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import { StatusPill } from "@/components/status-pill";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption } from "@/components/ui/typography";
import { useCertificatePdf, useMyCertificates } from "@/hooks/use-engagement";
import { useTheme } from "@/hooks/useTheme";
import { Alert } from "@/lib/alert";
import { apiErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { MyCertificate } from "@/lib/types";

export default function Certificates() {
	const { colors, spacing } = useTheme();

	const query = useMyCertificates();
	const pdf = useCertificatePdf();

	const download = (certificate: MyCertificate) => {
		pdf.mutate(certificate.id, {
			onSuccess: async ({ url }) => {
				const canOpen = await Linking.canOpenURL(url);
				if (canOpen) await Linking.openURL(url);
				else Alert.alert("Could not open", "No app available to open the PDF.");
			},
			onError: (error) =>
				Alert.alert("Could not download", apiErrorMessage(error)),
		});
	};

	return (
		<Screen>
			<ScreenHeader
				back
				title="Certificates"
				subtitle="Proof of the events you've volunteered at, each verifiable by its code."
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
					data={query.data?.items ?? []}
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
							icon={Award}
							title="No certificates yet"
							description="Once an NGO confirms you attended an event, your certificate appears here."
						/>
					}
					renderItem={({ item }) => (
						<Surface>
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									justifyContent: "space-between",
									gap: spacing[2],
								}}
							>
								<Caption
									color="secondary"
									numberOfLines={1}
									style={{ flex: 1 }}
								>
									{item.organization.organizationName}
								</Caption>
								{item.revokedAt && <StatusPill label="Revoked" tone="error" />}
							</View>

							<Body weight="bold" numberOfLines={2} style={{ marginTop: 2 }}>
								{item.event.title}
							</Body>
							<Caption color="tertiary" style={{ marginTop: 4 }}>
								{formatDate(item.event.startAt)}
								{item.event.city ? ` · ${item.event.city}` : ""}
							</Caption>

							{item.note && (
								<Caption color="secondary" style={{ marginTop: spacing[2] }}>
									{item.note}
								</Caption>
							)}

							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									justifyContent: "space-between",
									marginTop: spacing[3],
									paddingTop: spacing[3],
									borderTopWidth: 1,
									borderTopColor: colors.border.light,
								}}
							>
								<Caption color="quaternary">{item.code}</Caption>
								{!item.revokedAt && (
									<Pressable onPress={() => download(item)} hitSlop={8}>
										<Caption
											weight="medium"
											color={colors.primary.ink as string}
										>
											{pdf.isPending ? "Preparing…" : "Download PDF"}
										</Caption>
									</Pressable>
								)}
							</View>
						</Surface>
					)}
				/>
			)}
		</Screen>
	);
}
