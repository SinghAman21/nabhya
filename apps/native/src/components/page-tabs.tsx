import { ScrollView, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { Body } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { focusable } from "@/lib/focus";

/** react-native-web reports `focused`/`hovered` here; native only sets `pressed`. */
type PressState = { pressed: boolean; focused?: boolean; hovered?: boolean };

/**
 * Tabs that divide one page, not one app.
 *
 * Distinct from two things already in the codebase, and the difference is the
 * point:
 *
 * - `components/tab-bar.tsx` is the bottom bar - app destinations, each its own
 *   route and its own history entry.
 * - `FilterChips` narrows *one* list to a subset of the same kind of row, which
 *   is why its selected state is a filled pill.
 *
 * This is neither: the tabs show different *facets of one subject*, so the
 * treatment is the flat underline convention every settings page on the web
 * uses. A filled pill here would read as "filtered to Settings", and a route
 * per tab would put four entries in the back stack for what is one page.
 *
 * The row keeps a full-width hairline under it and each tab draws a 2px ink
 * border that overlaps it, so the active tab connects to its panel rather than
 * floating above it. Horizontal scroll for a phone that cannot fit four labels;
 * the indicator is suppressed on purpose here, unlike vertical panes - see the
 * scrolling note in `apps/native/AGENTS.md`.
 */
export function PageTabs<T extends string>({
	tabs,
	value,
	onChange,
}: {
	tabs: Array<{
		value: T;
		label: string;
		/** Draws a dot after the label - something on this tab needs attention. */
		alert?: boolean;
	}>;
	value: T;
	onChange: (value: T) => void;
}) {
	const { colors, spacing } = useTheme();

	return (
		<View
			style={{
				borderBottomWidth: 1,
				borderBottomColor: colors.border.hairline,
				marginBottom: spacing[6],
			}}
		>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				accessibilityRole="tablist"
				style={{ flexGrow: 0 }}
				contentContainerStyle={{
					flexDirection: "row",
					gap: spacing[6],
					paddingHorizontal: spacing[0.5],
				}}
			>
				{tabs.map((tab) => {
					const active = tab.value === value;
					return (
						<Pressable
							key={tab.value}
							onPress={() => onChange(tab.value)}
							accessibilityRole="tab"
							accessibilityState={{ selected: active }}
							accessibilityLabel={
								tab.alert ? `${tab.label}, needs attention` : tab.label
							}
							{...focusable}
							style={(state) => {
								const { pressed, hovered } = state as PressState;
								return {
									flexDirection: "row",
									alignItems: "center",
									gap: spacing[1.5],
									paddingVertical: spacing[3],
									// Overlaps the container's hairline by 1px so the
									// active border replaces it instead of stacking on it.
									marginBottom: -1,
									borderBottomWidth: 2,
									borderBottomColor: active
										? (colors.text.primary as string)
										: pressed || hovered
											? colors.border.medium
											: "transparent",
								};
							}}
						>
							<Body
								weight={active ? "bold" : "medium"}
								color={active ? undefined : "tertiary"}
							>
								{tab.label}
							</Body>
							{tab.alert && (
								<View
									style={{
										width: 6,
										height: 6,
										borderRadius: 3,
										backgroundColor: colors.warning.main,
									}}
								/>
							)}
						</Pressable>
					);
				})}
			</ScrollView>
		</View>
	);
}
