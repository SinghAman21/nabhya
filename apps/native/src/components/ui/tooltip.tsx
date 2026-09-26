import { useState } from "react";
import { Platform, View } from "react-native";
import { Caption } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";

/**
 * A hover label for an icon-only control.
 *
 * **Web only, and only ever an aid.** On a touch screen there is no hover, so
 * on native this renders its child and nothing else. That is why the rule
 * "never icon-only without a label" still stands everywhere except a fixed
 * toolbar: a tooltip that only exists on desktop cannot be the sole
 * explanation of a button. The `accessibilityLabel` on the control underneath
 * is the real answer for assistive tech, and this is the answer for a sighted
 * person with a mouse wondering what the fourth icon does.
 *
 * **Deliberately not a portal.** Every portalling primitive in this app fails
 * inside a sheet or drawer - see the note at the top of `ui/sheet.tsx` - and a
 * tooltip is small enough to position against its own wrapper instead.
 * react-native-web's `View` does not clip by default (no `overflow: hidden` in
 * its base style), so an absolutely positioned bubble escapes the toolbar row
 * without anything having to opt in.
 *
 * Left-aligned rather than centred: a toolbar's first icon sits on the panel's
 * left gutter, and a centred bubble on it would hang off the edge. Growing
 * rightwards is always safe.
 */
export function Tooltip({
	label,
	children,
}: {
	/** Short. A sentence belongs in the toolbar's own note line, not up here. */
	label: string;
	children: React.ReactNode;
}) {
	const { colors, spacing, borderRadius, elevation, isDark } = useTheme();
	const [shown, setShown] = useState(false);

	if (Platform.OS !== "web") return <>{children}</>;

	return (
		<View
			style={{ position: "relative" }}
			onPointerEnter={() => setShown(true)}
			onPointerLeave={() => setShown(false)}
		>
			{children}
			{shown && (
				<View
					// Not focusable, not hit-testable, and hidden from assistive tech:
					// the control underneath already carries the same words as its
					// accessibility label, and announcing them twice is worse than
					// not announcing them here at all.
					pointerEvents="none"
					accessibilityElementsHidden
					importantForAccessibility="no-hide-descendants"
					style={{
						position: "absolute",
						bottom: "100%",
						left: 0,
						marginBottom: spacing[1.5],
						paddingHorizontal: spacing[2],
						paddingVertical: spacing[1],
						borderRadius: borderRadius.sm,
						backgroundColor: colors.text.primary,
						...(isDark ? {} : elevation.card),
					}}
				>
					<Caption
						weight="medium"
						numberOfLines={1}
						style={{ color: colors.text.inverse as string }}
					>
						{label}
					</Caption>
				</View>
			)}
		</View>
	);
}
