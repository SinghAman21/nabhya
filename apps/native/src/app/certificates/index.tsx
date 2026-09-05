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
import { Pressable } from "@/components/ui/pressable";
import { Caption, H5 } from "@/components/ui/typography";
import { useCertificatePdf } from "@/hooks/use-engagement";
import { useTheme } from "@/hooks/use-theme";
import { Alert } from "@/lib/alert";
import { apiErrorMessage, certificatesApi, queryKeys } from "@/lib/api";
import { focusable } from "@/lib/focus";
import { formatDate } from "@/lib/format";
import type { MyCertificate } from "@/lib/types";

/**
 * Every certificate the volunteer has earned. Each card carries the event, the
 * NGO, the public code (which is what an employer checks), and a PDF download.
 */
export default function Certificates() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const pdf = useCertificatePdf();

	const { query, items, loadMore } = usePagedQuery({
		queryKey: queryKeys.certificates({ limit: PAGE_SIZE }),
		fetchPage: (page) => certificatesApi.listMine({ page, limit: PAGE_SIZE }),
	});

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
				subtitle="Each one can be checked by anyone using its code."
			/>

			<PagedList
				query={query}
				items={items}
				loadMore={loadMore}
				keyExtractor={(item) => item.id}
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
					return (
						<Surface>
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
								<StatusPill
									label={item.revokedAt ? "Revoked" : "Issued"}
									tone={item.revokedAt ? "error" : "success"}
								/>
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
								<Pressable
									onPress={() => router.push(`/certificates/${item.code}`)}
									hitSlop={8}
									accessibilityRole="button"
									accessibilityLabel={`Verify certificate ${item.code}`}
									{...focusable}
								>
									<Caption color="quaternary">Code {item.code}</Caption>
								</Pressable>
								{!item.revokedAt && (
									<Button
										size="sm"
										variant="outline"
										onPress={() => download(item)}
										loading={busy}
										accessibilityLabel={`Download PDF for ${item.event.title}`}
									>
										Download PDF
									</Button>
								)}
							</View>
						</Surface>
					);
				}}
			/>
		</Screen>
	);
}
