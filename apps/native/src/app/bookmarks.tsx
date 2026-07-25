import { useRouter } from "expo-router";
import { Bookmark } from "lucide-react-native";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { BackButton } from "@/components/back-button";
import {
	EmptyState,
	ErrorState,
	LoadingState,
	Surface,
} from "@/components/screen-shell";
import { Body, Caption, H2 } from "@/components/ui/typography";
import { useBookmarks, useToggleBookmark } from "@/hooks/use-engagement";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";

export default function Bookmarks() {
	const { colors, spacing } = useTheme();
	const router = useRouter();

	const query = useBookmarks();
	const toggle = useToggleBookmark();

	return (
		<View
			style={{
				flex: 1,
				backgroundColor: colors.background.warm,
				paddingHorizontal: spacing[6],
				paddingTop: spacing[8],
			}}
		>
			<BackButton />

			<H2 style={{ marginBottom: spacing[1] }}>Saved NGOs</H2>
			<Body color="tertiary" style={{ marginBottom: spacing[5] }}>
				Organizations you're keeping an eye on.
			</Body>

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
							icon={Bookmark}
							title="Nothing saved yet"
							description="Save an NGO to find it again quickly."
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
								<View
									style={{
										width: 40,
										height: 40,
										borderRadius: 20,
										backgroundColor: colors.background.tertiary,
										alignItems: "center",
										justifyContent: "center",
									}}
								>
									<Body weight="bold" color="secondary">
										{item.organization.organizationName[0]?.toUpperCase()}
									</Body>
								</View>
								<View style={{ flex: 1 }}>
									<Body weight="bold" numberOfLines={1}>
										{item.organization.organizationName}
									</Body>
									<Caption color="tertiary" numberOfLines={1}>
										{[item.organization.city, item.organization.state]
											.filter(Boolean)
											.join(", ")}
									</Caption>
								</View>
								<Pressable
									onPress={() => toggle.mutate(item.organization.id)}
									disabled={toggle.isPending}
									hitSlop={8}
								>
									<Caption weight="medium" color={colors.error.main as string}>
										Remove
									</Caption>
								</Pressable>
							</View>

							{item.organization.description && (
								<Caption
									color="secondary"
									numberOfLines={2}
									style={{ marginTop: spacing[2] }}
								>
									{item.organization.description}
								</Caption>
							)}
						</Surface>
					)}
				/>
			)}
		</View>
	);
}
