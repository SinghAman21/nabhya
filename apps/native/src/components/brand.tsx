import {
	Award,
	HandHeart,
	type LucideIcon,
	ShieldCheck,
} from "lucide-react-native";
import { View } from "react-native";
import { Logo } from "@/components/logo";
import { Caption, Label } from "@/components/ui/typography";
import { panelInk } from "@/constants/design-system";
import { useTheme } from "@/hooks/use-theme";

/**
 * The brand's own pieces, drawn on the dark panel ground (`PanelWash`) beside
 * sign-in, sign-up and the onboarding wizards. Dark in both schemes: it is the
 * logotype's ground, not a theme surface. Type on it is white or `panelInk`,
 * so it reads the same on the warm sign-in ground and the blue rail.
 */

/**
 * The drawn wordmark (`components/logo.tsx`). `onDark` is the brand ground;
 * off it the letters take the theme's text ink. The sun in the n is the one
 * touch of brand fill, so nothing else here needs the orange tick it replaced.
 */
export function BrandMark({
	onDark = true,
	size = "sm",
}: {
	onDark?: boolean;
	size?: "sm" | "lg";
}) {
	const { colors } = useTheme();
	return (
		<View
			style={{ flexDirection: "row", alignItems: "center" }}
			accessible
			accessibilityRole="header"
			accessibilityLabel="Nabhya"
		>
			<Logo
				size={size === "lg" ? 36 : 24}
				color={onDark ? colors.brand.ink : (colors.text.primary as string)}
				label={null}
			/>
		</View>
	);
}

/**
 * What Nabhya promises, in the three things the product actually does - so the
 * panel says something checkable rather than a slogan. Each line maps to a real
 * mechanism: document review by a superadmin, needs with a quantity and a
 * progress bar, and certificates with a public verification page.
 */
export const BRAND_VALUES: ReadonlyArray<{
	icon: LucideIcon;
	title: string;
	body: string;
}> = [
	{
		icon: ShieldCheck,
		title: "Every NGO is checked by a person",
		body: "Registration certificate and PAN are reviewed before an NGO can post anything.",
	},
	{
		icon: HandHeart,
		title: "Needs you can actually meet",
		body: "Blankets for a shelter, hands at a Saturday drive - with how much is still needed.",
	},
	{
		icon: Award,
		title: "Proof you showed up",
		body: "Attend, and the NGO issues a certificate anyone can verify.",
	},
];

/**
 * The three lines as a quiet list: a hairline above each, the icon bare in the
 * brand fill, no wells. Ringed icon wells made it a feature grid - three more
 * objects on a panel whose job is a headline.
 */
export function BrandValues() {
	const { colors, spacing } = useTheme();

	return (
		<View>
			{BRAND_VALUES.map(({ icon: Icon, title, body }) => (
				<View
					key={title}
					style={{
						flexDirection: "row",
						gap: spacing[3.5],
						paddingVertical: spacing[4],
						borderTopWidth: 1,
						borderTopColor: panelInk.border,
					}}
				>
					<Icon
						size={18}
						strokeWidth={1.8}
						color={colors.primary.main}
						style={{ marginTop: 1 }}
					/>
					<View style={{ flex: 1, minWidth: 0, gap: spacing[0.5] }}>
						<Label weight="semibold" color={colors.brand.ink}>
							{title}
						</Label>
						<Caption color={panelInk.muted}>{body}</Caption>
					</View>
				</View>
			))}
		</View>
	);
}
