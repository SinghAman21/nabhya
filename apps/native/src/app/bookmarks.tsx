import { useRouter } from "expo-router";
import { Bookmark } from "lucide-react-native";
import { FlatList, RefreshControl, View } from "react-native";
import {
	EmptyState,
	ErrorState,
	LoadingState,
	Screen,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption } from "@/components/ui/typography";
import { useBookmarks, useToggleBookmark } from "@/hooks/use-engagement";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";

export default function Bookmarks() {
	const { colors, spacing } = useTheme();
	const _router = useRouter();

	const query = useBookmarks();
	const toggle = useToggleBookmark();

	return (
		<Screen>
			<ScreenHeader
				back
				title="Saved NGOs"
				subtitle="Organizations you're keeping an eye on."
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
									<Caption weight="medium" color={colors.error.ink as string}>
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
		</Screen>
	);
}
