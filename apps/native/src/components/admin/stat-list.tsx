import { View } from "react-native";
import { Surface } from "@/components/screen-shell";
import { Caption, Label } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";

/**
 * Platform counters, as a list rather than a row of numerals.
 *
 * `MetricRow` from `screen-shell` is the right thing on a phone and in a wide
 * column: four `H2` numerals side by side, each one the loudest thing in its
 * cell. It is the wrong thing in a 320pt console aside, which is where the
 * Overview needs it - four stats at `minWidth: 92` wrap 3 + 1, so "Suspended"
 * ends up alone on a second line under a 28px zero, and three of those blocks
 * stacked read as a dashboard from 2013. Worse, the numeral gets the emphasis
 * whether or not the number means anything: a platform with 16 accounts and 0
 * suspended draws the 0 exactly as loudly as the 16.
 *
 * So: label left, number right, hairlines between, one line each. The number
 * is `Label` weight-bold rather than `H2` - big enough to find, small enough
 * that a column of six does not shout - and only a number that carries a
 * decision takes a tone. Everything else is ink, which is the same rule
 * `MetricRow` follows and the same rule the feed card follows.
 */
export interface Stat {
	label: string;
	value: number | string;
	/** Only for a number that needs acting on. Everything else stays ink. */
	tone?: "warning" | "success";
	/** Dims a zero that is good news, e.g. no suspended accounts. */
	muted?: boolean;
}

export function StatList({ stats }: { stats: Stat[] }) {
	const { colors, spacing } = useTheme();

	return (
		<Surface padded={false}>
			{stats.map((stat, index) => (
				<View key={stat.label}>
					{index > 0 && (
						<View
							style={{
								height: 1,
								marginLeft: spacing[3.5],
								backgroundColor: colors.border.hairline,
							}}
						/>
					)}
					<View
						accessible
						accessibilityRole="text"
						accessibilityLabel={`${stat.label}: ${stat.value}`}
						style={{
							flexDirection: "row",
							alignItems: "center",
							justifyContent: "space-between",
							gap: spacing[3],
							paddingHorizontal: spacing[3.5],
							paddingVertical: spacing[2.5],
							minHeight: 38,
						}}
					>
						<Caption color="tertiary" numberOfLines={1} style={{ flex: 1 }}>
							{stat.label}
						</Caption>
						<Label
							weight="bold"
							color={
								stat.tone === "warning"
									? colors.warning.ink
									: stat.tone === "success"
										? colors.success.ink
										: stat.muted
											? (colors.text.quaternary as string)
											: undefined
							}
						>
							{stat.value}
						</Label>
					</View>
				</View>
			))}
		</Surface>
	);
}
