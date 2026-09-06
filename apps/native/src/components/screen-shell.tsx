import type { LucideIcon } from "lucide-react-native";
import {
	ActivityIndicator,
	Platform,
	ScrollView,
	type StyleProp,
	View,
	type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/back-button";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption, H2, H3, Label } from "@/components/ui/typography";
import { typography } from "@/constants/design-system";
import { useTheme } from "@/hooks/use-theme";
import { useGridColumns } from "@/hooks/useMedia";
import { focusable } from "@/lib/focus";

/**
 * Shared screen furniture.
 *
 * The visual language here is deliberately quiet: one raised surface, hairline
 * dividers instead of stacked outlines, numerals as the loudest element, and the
 * brand orange reserved for actions. If a screen needs a box it needs a
 * `Surface`; if it needs a list of boxes it needs a `ListGroup`.
 */

/** react-native-web reports `focused`/`hovered` here; native only sets `pressed`. */
type PressState = { pressed: boolean; focused?: boolean; hovered?: boolean };

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The page container every screen sits in: page background, gutters, and the
 * top safe-area inset.
 *
 * Screens each hardcoded `paddingTop: spacing[8]`, which is not an inset — it is
 * a guess at one. With `headerShown: false` the content box starts at y=0, so on
 * a device with a 47pt notch the title was 15pt into the status bar, and on a
 * device without one it was 32pt of dead space.
 */
export function Screen({
	children,
	style,
}: {
	children: React.ReactNode;
	/** View styles are typed so callers get React Native/CSS-like autocomplete. */
	style?: StyleProp<ViewStyle>;
}) {
	const { colors, spacing } = useTheme();
	const insets = useSafeAreaInsets();

	return (
		<View
			style={{
				flex: 1,
				backgroundColor: colors.background.warm,
				paddingTop: insets.top + spacing[5],
				paddingHorizontal: spacing[5],
				...style,
			}}
		>
			{children}
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Screen header                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Two shapes, one component. A top-level tab gets the display-face title on
 * its own line. A pushed page passes `back`, which puts the back button, a
 * smaller title and the action on one 40pt row — the title no longer floats
 * under a lone arrow with a gap that changes from screen to screen.
 */
export function ScreenHeader({
	title,
	subtitle,
	action,
	back,
}: {
	title: string;
	subtitle?: string;
	action?: React.ReactNode;
	/** Render the back button inline, left of the title. */
	back?: boolean;
}) {
	const { spacing } = useTheme();

	if (back) {
		return (
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					gap: spacing[3],
					marginBottom: spacing[5],
					minHeight: 40,
				}}
			>
				<BackButton />
				<View style={{ alignItems: "flex-end" }}>
					<H3
						accessibilityRole="header"
						numberOfLines={1}
						style={{ fontFamily: typography.fontFamily.display }}
					>
						{title}
					</H3>
					{subtitle && (
						<Caption color="tertiary" numberOfLines={2}>
							{subtitle}
						</Caption>
					)}
				</View>
				{action}
			</View>
		);
	}

	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				justifyContent: "space-between",
				gap: spacing[3],
				marginBottom: spacing[5],
				minHeight: 40,
			}}
		>
			<View style={{ flex: 1 }}>
				{subtitle && (
					<Caption
						color="tertiary"
						numberOfLines={1}
						style={{ marginBottom: spacing[0.5] }}
					>
						{subtitle}
					</Caption>
				)}
				<H2 accessibilityRole="header">{title}</H2>
			</View>
			{action}
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Surface                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The one card recipe. No outline: light mode separates with a shallow shadow,
 * dark mode with a lifted `background.card`. An outline *and* a shadow *and* a
 * fill is three separations doing one job.
 */
export function Surface({
	children,
	onPress,
	style,
	padded = true,
}: {
	children: React.ReactNode;
	onPress?: () => void;
	style?: StyleProp<ViewStyle>;
	padded?: boolean;
}) {
	const { colors, spacing, borderRadius, elevation, isDark } = useTheme();

	const base = {
		backgroundColor: colors.background.card,
		borderRadius: borderRadius.xl,
		// 16, not 20: matches `ListRow`'s gutter, and buys roughly one extra row
		// per screen on a small phone. Radius and elevation carry the separation.
		padding: padded ? spacing[4] : 0,
		...(isDark ? {} : elevation.card),
		...style,
	};

	if (!onPress) return <View style={base}>{children}</View>;

	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			{...focusable}
			style={(state) => {
				const { pressed, hovered } = state as PressState;
				return {
					...base,
					backgroundColor:
						pressed || hovered
							? colors.background.subtle
							: colors.background.card,
					// Feedback on press-down, not on release.
					transform: [{ scale: pressed ? 0.995 : 1 }],
				};
			}}
		>
			{children}
		</Pressable>
	);
}

/* -------------------------------------------------------------------------- */
/* Grid cell                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * One cell in a multi-column `FlatList` (`numColumns={useGridColumns()}`).
 *
 * On a phone this renders nothing extra — the card is the row. On desktop it
 * takes an equal share of the row and caps its width at one column, so a
 * half-empty last row keeps its cards aligned instead of ballooning to fill
 * the row. Pair with `key={\`grid-${columns}\`}` (a `numColumns` change needs
 * a remount to re-layout) and `columnWrapperStyle` carrying the gutter.
 */
export function GridCell({ children }: { children: React.ReactNode }) {
	const columns = useGridColumns();

	if (columns === 1) return <>{children}</>;

	return (
		<View style={{ flex: 1, maxWidth: `${100 / columns}%` }}>{children}</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Section title                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Quiet section label. The old treatment — 13px bold, uppercase, letter-spaced,
 * with a leading icon — shouted louder than the content under it.
 */
export function SectionTitle({
	children,
	action,
}: {
	children: string;
	action?: React.ReactNode;
}) {
	const { spacing } = useTheme();

	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				justifyContent: "space-between",
				marginBottom: spacing[3],
			}}
		>
			<Label color="tertiary">{children}</Label>
			{action}
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Grouped list                                                               */
/* -------------------------------------------------------------------------- */

/**
 * One surface holding many rows, divided by hairlines — instead of a stack of
 * individually outlined cards, which is what made these screens read as noise.
 */
export function ListGroup({ children }: { children: React.ReactNode }) {
	const { colors } = useTheme();
	const rows = (Array.isArray(children) ? children.flat() : [children]).filter(
		Boolean,
	);

	return (
		<Surface padded={false} style={{ overflow: "hidden" }}>
			{rows.map((row, index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
				<View key={index}>
					{index > 0 && (
						<View
							style={{
								height: 1,
								marginLeft: 16,
								backgroundColor: colors.border.hairline,
							}}
						/>
					)}
					{row}
				</View>
			))}
		</Surface>
	);
}

export function ListRow({
	icon: Icon,
	label,
	hint,
	value,
	onPress,
	chevron = true,
}: {
	icon?: LucideIcon;
	label: string;
	hint?: string;
	/** Trailing content — a count, a pill, a switch. Replaces the chevron. */
	value?: React.ReactNode;
	onPress?: () => void;
	/** Set false for an action row (sign out) that does not navigate anywhere. */
	chevron?: boolean;
}) {
	const { colors, spacing } = useTheme();

	const content = (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: spacing[3.5],
				paddingHorizontal: spacing[4],
				paddingVertical: hint ? spacing[3.5] : spacing[4],
				minHeight: 56,
			}}
		>
			{Icon && (
				<Icon
					size={19}
					color={colors.text.tertiary as string}
					strokeWidth={1.75}
				/>
			)}
			<View style={{ flex: 1 }}>
				<Body weight="medium" numberOfLines={1}>
					{label}
				</Body>
				{hint && (
					<Caption color="tertiary" numberOfLines={1}>
						{hint}
					</Caption>
				)}
			</View>
			{value ?? (onPress && chevron ? <Chevron /> : null)}
		</View>
	);

	if (!onPress) return content;

	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={hint ? `${label}. ${hint}` : label}
			{...focusable}
			style={(state) => {
				const { pressed, hovered } = state as PressState;
				return {
					backgroundColor:
						pressed || hovered ? colors.background.subtle : "transparent",
				};
			}}
		>
			{content}
		</Pressable>
	);
}

function Chevron() {
	const { colors } = useTheme();

	// Drawn rather than imported: a 7px caret at hairline weight, so a list of
	// twelve rows does not read as a column of arrows.
	return (
		<View
			style={{
				width: 7,
				height: 7,
				borderRightWidth: 1.5,
				borderTopWidth: 1.5,
				borderColor: colors.text.quaternary as string,
				transform: [{ rotate: "45deg" }],
				marginRight: 2,
			}}
		/>
	);
}

/* -------------------------------------------------------------------------- */
/* Metrics                                                                    */
/* -------------------------------------------------------------------------- */

export interface Stat {
	label: string;
	value: number | string;
	/** Only for a number that needs a decision. Everything else stays ink. */
	tone?: "warning" | "success";
}

/**
 * Numerals share one surface and are separated by hairlines. Each stat used to
 * be its own outlined card in its own colour, which turned a summary into a
 * mosaic — six boxes, four hues, no hierarchy.
 */
export function MetricRow({ stats }: { stats: Stat[] }) {
	const { colors, spacing } = useTheme();

	return (
		<Surface padded={false}>
			<View style={{ flexDirection: "row", flexWrap: "wrap" }}>
				{stats.map((stat, index) => (
					<View
						key={stat.label}
						style={{
							flexGrow: 1,
							flexBasis: stats.length > 4 ? "33%" : 0,
							minWidth: 92,
							paddingVertical: spacing[4],
							paddingHorizontal: spacing[4],
							borderLeftWidth: index === 0 ? 0 : 1,
							borderLeftColor: colors.border.hairline,
						}}
					>
						<H2
							color={
								stat.tone === "warning"
									? colors.warning.ink
									: stat.tone === "success"
										? colors.success.ink
										: undefined
							}
							style={{ marginBottom: spacing[0.5] }}
						>
							{stat.value}
						</H2>
						<Caption color="tertiary" numberOfLines={2}>
							{stat.label}
						</Caption>
					</View>
				))}
			</View>
		</Surface>
	);
}

/* -------------------------------------------------------------------------- */
/* Banner                                                                     */
/* -------------------------------------------------------------------------- */

/** Inline notice. Tinted fill, ink text, no outline. */
export function Banner({
	tone = "info",
	title,
	description,
	onPress,
}: {
	tone?: "info" | "warning" | "success" | "error";
	title: string;
	description?: string;
	onPress?: () => void;
}) {
	const { colors, spacing, borderRadius } = useTheme();

	const palette = {
		info: { bg: colors.info.bg, ink: colors.info.ink },
		warning: { bg: colors.warning.bg, ink: colors.warning.ink },
		success: { bg: colors.success.bg, ink: colors.success.ink },
		error: { bg: colors.error.bg, ink: colors.error.ink },
	}[tone];

	const inner = (
		<>
			<Body weight="bold" color={palette.ink}>
				{title}
			</Body>
			{description && (
				<Caption color="secondary" style={{ marginTop: spacing[0.5] }}>
					{description}
				</Caption>
			)}
		</>
	);

	const base = {
		backgroundColor: palette.bg,
		borderRadius: borderRadius.lg,
		padding: spacing[4],
	};

	if (!onPress) return <View style={base}>{inner}</View>;

	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={description ? `${title}. ${description}` : title}
			{...focusable}
			style={(state) => {
				const { pressed } = state as PressState;
				return {
					...base,
					opacity: pressed ? 0.85 : 1,
				};
			}}
		>
			{inner}
		</Pressable>
	);
}

/* -------------------------------------------------------------------------- */
/* States                                                                     */
/* -------------------------------------------------------------------------- */

export function EmptyState({
	icon: Icon,
	title,
	description,
	action,
}: {
	icon?: LucideIcon;
	title: string;
	description?: string;
	action?: React.ReactNode;
}) {
	const { colors, spacing } = useTheme();

	return (
		<View
			style={{
				alignItems: "center",
				paddingVertical: spacing[14],
				paddingHorizontal: spacing[6],
			}}
		>
			{Icon && (
				<Icon
					size={22}
					color={colors.text.quaternary as string}
					strokeWidth={1.5}
				/>
			)}
			<Body weight="bold" style={{ marginTop: spacing[4] }}>
				{title}
			</Body>
			{description && (
				<Caption
					color="tertiary"
					style={{ textAlign: "center", marginTop: spacing[1] }}
				>
					{description}
				</Caption>
			)}
			{action && <View style={{ marginTop: spacing[5] }}>{action}</View>}
		</View>
	);
}

export function LoadingState({ label }: { label?: string }) {
	const { colors, spacing } = useTheme();

	return (
		<View
			accessible
			accessibilityRole="progressbar"
			accessibilityLabel={label ?? "Loading"}
			style={{ alignItems: "center", paddingVertical: spacing[14] }}
		>
			<ActivityIndicator
				size="small"
				color={colors.text.quaternary as string}
			/>
			{label && (
				<Caption color="tertiary" style={{ marginTop: spacing[3] }}>
					{label}
				</Caption>
			)}
		</View>
	);
}

export function ErrorState({
	message,
	onRetry,
}: {
	message: string;
	onRetry?: () => void;
}) {
	const { colors, spacing } = useTheme();

	return (
		<View
			style={{
				alignItems: "center",
				paddingVertical: spacing[14],
				paddingHorizontal: spacing[6],
			}}
		>
			<Body weight="bold" color={colors.error.ink}>
				Something went wrong
			</Body>
			<Caption
				color="tertiary"
				style={{ textAlign: "center", marginTop: spacing[1] }}
			>
				{message}
			</Caption>
			{onRetry && (
				<Pressable
					onPress={onRetry}
					accessibilityRole="button"
					hitSlop={8}
					style={{ marginTop: spacing[4] }}
				>
					<Label color={colors.primary.ink}>Try again</Label>
				</Pressable>
			)}
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Filter chips                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Selection is monochrome — an ink pill, not an orange one. Orange is the
 * colour of *doing* something in this app; a filter is not an action, and
 * spending the brand on it left nothing to spend on the primary button.
 */
export function FilterChips<T extends string>({
	options,
	value,
	onChange,
	inline,
}: {
	options: Array<{ value: T; label: string }>;
	value: T;
	onChange: (value: T) => void;
	/** Drops the bottom margin, for sitting beside a search field on one row. */
	inline?: boolean;
}) {
	const { colors, spacing } = useTheme();

	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			accessibilityRole="tablist"
			style={{
				height: 32,
				maxHeight: 32,
				flexGrow: 0,
				marginBottom: inline ? 0 : spacing[5],
			}}
			contentContainerStyle={{
				flexDirection: "row",
				alignItems: "center",
				gap: spacing[2],
			}}
		>
			{options.map((option) => {
				const active = option.value === value;
				return (
					<Pressable
						key={option.value}
						onPress={() => onChange(option.value)}
						hitSlop={8}
						accessibilityRole="tab"
						accessibilityState={{ selected: active }}
						accessibilityLabel={option.label}
						{...focusable}
						style={(state) => {
							const { pressed } = state as PressState;
							return {
								minHeight: 32,
								justifyContent: "center",
								paddingHorizontal: spacing[3.5],
								borderRadius: 999,
								backgroundColor: active
									? (colors.text.primary as string)
									: pressed
										? colors.background.subtle
										: "transparent",
								borderWidth: active ? 0 : 1,
								borderColor: colors.border.medium,
							};
						}}
					>
						<Caption
							weight="medium"
							color={active ? (colors.text.inverse as string) : "secondary"}
						>
							{option.label}
						</Caption>
					</Pressable>
				);
			})}
		</ScrollView>
	);
}

/* -------------------------------------------------------------------------- */
/* Web                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Constrains content width and centres it on desktop web. Passes through on
 * mobile — no extra wrapper, no layout shift.
 */
export function WebContent({ children }: { children: React.ReactNode }) {
	const { spacing } = useTheme();

	if (Platform.OS !== "web") return <>{children}</>;

	return (
		<View
			style={{
				width: "100%",
				maxWidth: 720,
				alignSelf: "center",
				paddingHorizontal: spacing[6],
			}}
		>
			{children}
		</View>
	);
}
