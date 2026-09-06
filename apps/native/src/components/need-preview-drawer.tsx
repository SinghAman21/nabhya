import { useRouter } from "expo-router";
import { View } from "react-native";
import { KindPill, NeedFacts, UrgentPill } from "@/components/feed/feed-card";
import { Surface } from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption, Label } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { formatRelative } from "@/lib/format";
import type { FeedNeedItem } from "@/lib/types";

/**
 * What "I can help" / "Claim this" opens on the NGO feed.
 *
 * Pledging is volunteers-only on the server (`POST /needs/:id/pledges` is
 * `@Roles("volunteer")`), so for an organisation this used to push the whole
 * NGO page — a long detour for a glance. Now the need previews in place: the
 * ask, its progress, who posted it with a follow action, and one button into
 * the full NGO page for the rare case that is actually wanted.
 */
export function NeedPreviewDrawer({
	item,
	onClose,
	onToggleFollow,
}: {
	item: FeedNeedItem | null;
	onClose: () => void;
	onToggleFollow: (organizationId: string, following: boolean) => void;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	const router = useRouter();

	if (!item) return null;

	const org = item.organization;
	const place = [item.city, item.state].filter(Boolean).join(", ");

	return (
		<Drawer
			visible={!!item}
			onClose={onClose}
			title={item.title || "Need details"}
			subtitle={org?.organizationName}
			footer={
				org ? (
					<Button
						variant="outline"
						onPress={() => {
							onClose();
							router.push(`/ngos/${org.id}` as never);
						}}
					>
						View NGO
					</Button>
				) : undefined
			}
		>
			<View style={{ gap: spacing[4] }}>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[2],
						flexWrap: "wrap",
					}}
				>
					<KindPill kind="need" needType={item.need.type} />
					{item.isUrgent && <UrgentPill />}
				</View>

				{item.description ? (
					<Body color="secondary">{item.description}</Body>
				) : null}

				<NeedFacts item={item} />

				{org && (
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
									borderRadius: borderRadius.md,
									backgroundColor: colors.background.subtle,
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								<Label weight="bold" style={{ fontSize: 16 }}>
									{org.organizationName.charAt(0).toUpperCase() || "N"}
								</Label>
							</View>
							<View style={{ flex: 1 }}>
								<Label weight="semibold" numberOfLines={1}>
									{org.organizationName}
								</Label>
								<Caption color="quaternary" numberOfLines={1}>
									{place ? `${place} · ` : ""}
									{formatRelative(item.postedAt)}
								</Caption>
							</View>
							{!item.isFollowing && (
								<Pressable
									onPress={() => onToggleFollow(org.id, false)}
									accessibilityRole="button"
									accessibilityLabel={`Follow ${org.organizationName}`}
									hitSlop={8}
									style={({ pressed }) => ({
										paddingHorizontal: spacing[3.5],
										paddingVertical: spacing[1.5],
										borderRadius: 999,
										backgroundColor: pressed
											? (colors.primary.ink as string)
											: (colors.primary.main as string),
									})}
								>
									<Caption
										weight="semibold"
										style={{ color: "#FFFFFF", fontSize: 12 }}
									>
										Follow
									</Caption>
								</Pressable>
							)}
						</View>
					</Surface>
				)}
			</View>
		</Drawer>
	);
}
