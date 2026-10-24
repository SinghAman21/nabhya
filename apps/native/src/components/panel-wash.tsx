import { useId } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { type PanelGround, panelGrounds } from "@/constants/design-system";

/**
 * The ground of a brand panel: a dark colour with one faint wash of tone
 * rising from a corner, so the panel has depth without anything on it that
 * asks to be looked at. Fills its parent, which should set `overflow: hidden`.
 *
 * An SVG radial gradient, not a blur or an image: it costs no asset, has no
 * Android blur to fake, and stays smooth at any size.
 */
export function PanelWash({
	ground,
	from = "bottom-left",
}: {
	ground: PanelGround;
	from?: "bottom-left" | "top-left";
}) {
	const { ground: base, wash, strength } = panelGrounds[ground];
	// Gradient ids are document-global on the web; two panels on one page
	// would otherwise share one `url(#…)`.
	const id = `wash-${useId().replace(/:/g, "")}`;

	return (
		<View
			pointerEvents="none"
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			style={[StyleSheet.absoluteFill, { backgroundColor: base }]}
		>
			<Svg width="100%" height="100%">
				<Defs>
					<RadialGradient
						id={id}
						cx="0%"
						cy={from === "bottom-left" ? "100%" : "0%"}
						r="100%"
					>
						<Stop offset="0" stopColor={wash} stopOpacity={strength} />
						<Stop offset="0.6" stopColor={wash} stopOpacity={strength * 0.25} />
						<Stop offset="1" stopColor={wash} stopOpacity={0} />
					</RadialGradient>
				</Defs>
				<Rect width="100%" height="100%" fill={`url(#${id})`} />
			</Svg>
		</View>
	);
}
