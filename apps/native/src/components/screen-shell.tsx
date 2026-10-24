import type { LucideIcon } from "lucide-react-native";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Animated,
	Easing,
	Platform,
	ScrollView,
	type StyleProp,
	View,
	type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton, useShowBack } from "@/components/back-button";
import {
	CHIP_HEIGHT,
	CHIP_RING_ROOM,
	Chip,
	type ChipOption,
} from "@/components/choice-chips";
import { Pressable } from "@/components/ui/pressable";
import {
	Body,
	Caption,
	H2,
	H3,
	Label,
	Title,
} from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { useGridColumns, useMedia } from "@/hooks/useMedia";
import { focusable, type PressState } from "@/lib/focus";
import { useReducedMotion } from "@/lib/motion";

/**
 * Shared screen furniture.
 *
 * The visual language here is deliberately quiet: one raised surface, hairline
 * dividers instead of stacked outlines, numerals as the loudest element, and the
 * brand orange reserved for actions. If a screen needs a box it needs a
 * `Surface`; if it needs a list of boxes it needs a `ListGroup`.
 */

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The page container every screen sits in: page background, gutters, and the
 * top safe-area inset.
 *
 * Screens each hardcoded `paddingTop: spacing[8]`, which is not an inset - it is
 * a guess at one. With `headerShown: false` the content box starts at y=0, so on
 * a device with a 47pt notch the title was 15pt into the status bar, and on a
 * device without one it was 32pt of dead space.
 */
export function Screen({
	children,
	style,
	measure = "page",
}: {
	children: React.ReactNode;
	/** View styles are typed so callers get React Native/CSS-like autocomplete. */
	style?: StyleProp<ViewStyle>;
	/**
	 * How wide the page reads inside the desktop `AppShell`. `page` (the
	 * default) caps at `SHELL_PAGE_MAX_WIDTH` for lists and timelines;
	 * `reading` at `SHELL_READING_MAX_WIDTH` for a form or a single document.
	 * Ignored everywhere else - a phone, and the role groups' own layouts.
	 */
	measure?: "page" | "reading";
}) {
	const { colors, spacing } = useTheme();
	const insets = useSafeAreaInsets();
	const frame = useContext(ShellFrameContext);

	return (
		<View
			style={[
				{
					flex: 1,
					backgroundColor: colors.background.warm,
					paddingTop: insets.top + spacing[5],
					paddingHorizontal: spacing[5],
				},
				style,
				frame ? shellMeasure(frame, measure) : null,
			]}
		>
			{children}
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Desktop shell frame                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Which desktop chrome a shared screen is drawn inside, published by
 * `AppShell` (`null` on a phone and inside the role groups, which lay out
 * their own pages). Lives here rather than in `app-shell.tsx` so `Screen` can
 * read it without importing the sidebar.
 */
export type ShellFrame = "rail" | "topbar";
export const ShellFrameContext = createContext<ShellFrame | null>(null);

/** A list or timeline page beside the rail / under the top bar. */
export const SHELL_PAGE_MAX_WIDTH = 1040;
/** A form or one document - `edit-profile`, a certificate. */
export const SHELL_READING_MAX_WIDTH = 760;

/**
 * The width rule for a shared screen on desktop, applied over whatever the
 * screen passed (most pass `READING_COLUMN`, a 720 column centred in the
 * window - which beside a 264pt rail floated a narrow card in the middle of
 * the content area with dead space on both sides).
 *
 * - **Beside the rail** the page is left-aligned in the content area, so its
 *   edge sits one gutter from the rail like every `(ngo)` page.
 * - **Under the top bar** there is no rail to align to, so it is centred, the
 *   way the volunteer's own pages sit under the same bar.
 */
function shellMeasure(
	frame: ShellFrame,
	measure: "page" | "reading",
): ViewStyle {
	return {
		width: "100%",
		maxWidth:
			measure === "reading" ? SHELL_READING_MAX_WIDTH : SHELL_PAGE_MAX_WIDTH,
		alignSelf: frame === "rail" ? "flex-start" : "center",
	};
}

/* -------------------------------------------------------------------------- */
/* Screen header                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Two shapes, one component. A top-level page gets `Title` - the text face,
 * sentence case - on its own line. A pushed page passes `back`, which puts
 * the back button, a smaller sentence-case title (`H3`) and the action on one
 * 40pt row - the title no longer floats under a lone arrow with a gap that
 * changes from screen to screen.
 *
 * Titles used to be the display face (`H2`, and `H3` forced into it), which
 * only draws capitals: every page shouted NOTIFICATIONS, YOUR GIVING. The
 * display face is for brand panels.
 *
 * **`back` is a request, not a guarantee.** On desktop web a page listed in
 * `NAV_DESTINATIONS` (back-button.tsx) is reached from the rail or the top
 * bar, which stay on screen - so it draws the top-level shape with no
 * chevron. See `useShowBack`.
 */
export function ScreenHeader({
	title,
	subtitle,
	action,
	back: wantsBack,
}: {
	title: string;
	subtitle?: string | undefined;
	action?: React.ReactNode;
	/** Render the back button inline, left of the title. */
	back?: boolean;
}) {
	const { spacing } = useTheme();
	const { isDesktop } = useMedia();
	const showBack = useShowBack();
	const back = wantsBack && showBack;

	if (back) {
		/*
		 * On a phone the action gets its own row under the title. Chevron,
		 * title and "Download report" on one 390pt row cut the title to
		 * "DONATI…" - the one word that says where you are was the thing that
		 * gave way. Indented by the chevron's width so it lines up with the
		 * title it belongs to.
		 */
		const stackAction = Boolean(action) && !isDesktop;
		return (
			<View style={{ marginBottom: spacing[5], gap: spacing[3] }}>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						justifyContent: "space-between",
						gap: spacing[3],
						minHeight: 40,
					}}
				>
					<BackButton />
					{/* Title beside the chevron, not pushed to the far edge: with
					    space-between and no flex it floated to the middle when
					    there was an action and to the right edge when there
					    wasn't. */}
					<View style={{ flex: 1, minWidth: 0 }}>
						<H3 accessibilityRole="header" numberOfLines={2}>
							{title}
						</H3>
						{subtitle ? (
							<Caption color="tertiary" numberOfLines={2}>
								{subtitle}
							</Caption>
						) : null}
					</View>
					{stackAction ? null : action}
				</View>
				{stackAction ? (
					<View
						style={{
							flexDirection: "row",
							paddingLeft: 40 + spacing[3],
						}}
					>
						{action}
					</View>
				) : null}
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
			<View style={{ flex: 1, minWidth: 0 }}>
				<Title accessibilityRole="header" numberOfLines={2}>
					{title}
				</Title>
				{subtitle ? (
					<Caption
						color="tertiary"
						numberOfLines={2}
						style={{ marginTop: spacing[0.5] }}
					>
						{subtitle}
					</Caption>
				) : null}
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
	footer,
}: {
	children: React.ReactNode;
	onPress?: () => void;
	style?: StyleProp<ViewStyle>;
	padded?: boolean;
	/**
	 * Controls that belong to the card but not to its press - Edit, Remove.
	 * They render inside the card, below the pressable body, rather than inside
	 * it: a button inside a button is invalid HTML on the web (React warns and
	 * the inner press also fires the outer one's focus), and a screen reader
	 * reads the whole card as one button with no way to reach the controls.
	 */
	footer?: React.ReactNode;
}) {
	const { colors, spacing, borderRadius, elevation, isDark } = useTheme();
	// Only the footer variant needs it: see below.
	const [bodyPressed, setBodyPressed] = useState(false);

	const base = {
		backgroundColor: colors.background.card,
		borderRadius: borderRadius.xl,
		// 16, not 20: matches `ListRow`'s gutter, and buys roughly one extra row
		// per screen on a small phone. Radius and elevation carry the separation.
		padding: padded ? spacing[4] : 0,
		...(isDark ? {} : elevation.card),
		...(style as ViewStyle),
	};

	if (!onPress) {
		return (
			<View style={base}>
				<RowCorners.Provider value={padded ? NO_CORNERS : CARD_CORNERS}>
					{children}
				</RowCorners.Provider>
				{footer}
			</View>
		);
	}

	if (footer) {
		/*
		 * The whole card lights up, not the top two thirds of it. The body used
		 * to be the only pressable, so hovering it tinted a block that stopped
		 * dead above the footer - on the needs and events cards, half a card.
		 *
		 * The card is now an outer `Pressable` with **no role** and no tab stop:
		 * on the web it is a `<div>`, so the footer's buttons are not nested in
		 * a `<button>`, and it exists to (a) draw the hover tint across the
		 * whole card and (b) take a mouse press anywhere that is not a control.
		 * The *body* is still the real button - it carries the role, the focus
		 * ring and the accessible name from its text - and the footer controls
		 * sit beside it as separate press targets. Inner responders win, so a
		 * footer button never fires the card.
		 *
		 * A press on the body makes the body the responder, which the outer
		 * card cannot see; `bodyPressed` carries that one bit so the press tint
		 * also covers the whole card. Children are props, so this re-renders the
		 * card's own views, not the content inside them.
		 */
		const { padding: _padding, ...shell } = base;
		return (
			<Pressable
				onPress={onPress}
				accessible={false}
				focusable={false}
				style={(state) => {
					const { pressed, hovered } = state as PressState;
					const lit = pressed || hovered || bodyPressed;
					return {
						...shell,
						overflow: "hidden",
						backgroundColor: lit
							? colors.background.subtle
							: colors.background.card,
					};
				}}
			>
				<Pressable
					onPress={onPress}
					onPressIn={() => setBodyPressed(true)}
					onPressOut={() => setBodyPressed(false)}
					accessibilityRole="button"
					{...focusable}
					style={{
						padding: padded ? spacing[4] : 0,
						paddingBottom: 0,
						borderTopLeftRadius: borderRadius.xl,
						borderTopRightRadius: borderRadius.xl,
					}}
				>
					{children}
				</Pressable>
				<View
					style={{
						paddingHorizontal: padded ? spacing[4] : 0,
						paddingBottom: padded ? spacing[4] : 0,
					}}
				>
					{footer}
				</View>
			</Pressable>
		);
	}

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
 * On a phone this renders nothing extra - the card is the row. On desktop it
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
 * Quiet section label. The old treatment - 13px bold, uppercase, letter-spaced,
 * with a leading icon - shouted louder than the content under it.
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
 * One surface holding many rows, divided by hairlines - instead of a stack of
 * individually outlined cards, which is what made these screens read as noise.
 */
export function ListGroup({ children }: { children: React.ReactNode }) {
	const { colors } = useTheme();
	const rows = (Array.isArray(children) ? children.flat() : [children]).filter(
		(row) => Boolean(row) && typeof row !== "string",
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
					<RowCorners.Provider
						value={cornersFor(index === 0, index === rows.length - 1)}
					>
						{row}
					</RowCorners.Provider>
				</View>
			))}
		</Surface>
	);
}

/**
 * Which of a row's corners touch its card's rounded corners.
 *
 * A row's hover tint is a rectangle, and the card's `overflow: hidden` is the
 * only thing that rounds it - which a row outside a `ListGroup` (a lone
 * disclosure row in a `Surface`, as on Team) or a card whose clip does not
 * reach the row cannot rely on. So the row rounds its own tint: `ListGroup`
 * says first / last, and an unpadded `Surface` says "both" for a row placed in
 * it directly.
 */
interface Corners {
	top: boolean;
	bottom: boolean;
}
const NO_CORNERS: Corners = { top: false, bottom: false };
const CARD_CORNERS: Corners = { top: true, bottom: true };
const FIRST_CORNERS: Corners = { top: true, bottom: false };
const LAST_CORNERS: Corners = { top: false, bottom: true };
const RowCorners = createContext<Corners>(NO_CORNERS);

function cornersFor(first: boolean, last: boolean): Corners {
	if (first && last) return CARD_CORNERS;
	if (first) return FIRST_CORNERS;
	if (last) return LAST_CORNERS;
	return NO_CORNERS;
}

export function ListRow({
	icon: Icon,
	label,
	hint,
	value,
	onPress,
	chevron = true,
	accessibilityLabel,
	action,
}: {
	icon?: LucideIcon;
	label: string;
	hint?: string;
	/**
	 * Trailing content - a count, a pill. Replaces the chevron. Drawn *inside*
	 * the row's press target, so it must not be a control: use `action`.
	 */
	value?: React.ReactNode;
	/**
	 * A control of its own at the row's end - "remove this recent search".
	 * Rendered beside the row's pressable, never inside it: inside, it was a
	 * `<button>` in a `<button>` on the web, and a screen reader read the row
	 * as one button with no way to reach the second.
	 */
	action?: React.ReactNode;
	onPress?: () => void;
	/** Set false for an action row (sign out) that does not navigate anywhere. */
	chevron?: boolean;
	/**
	 * Override the spoken label. The row's own label is announced instead of
	 * its children, so a `value` that carries meaning - a queue's waiting
	 * count - has to be spelled into the sentence here or it is simply not
	 * read out.
	 */
	accessibilityLabel?: string;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	const corners = useContext(RowCorners);
	const radius = borderRadius.xl;

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
				{hint ? (
					<Caption color="tertiary" numberOfLines={1}>
						{hint}
					</Caption>
				) : null}
			</View>
			{value ?? (onPress && chevron ? <Chevron /> : null)}
		</View>
	);

	if (!onPress) return content;

	// With an `action` beside it the press target stops short of the card's
	// right edge, so only its left corners can meet the card's.
	const right = !action;

	const row = (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={
				accessibilityLabel ?? (hint ? `${label}. ${hint}` : label)
			}
			{...focusable}
			style={(state) => {
				const { pressed, hovered } = state as PressState;
				return {
					borderTopLeftRadius: corners.top ? radius : 0,
					borderTopRightRadius: corners.top && right ? radius : 0,
					borderBottomLeftRadius: corners.bottom ? radius : 0,
					borderBottomRightRadius: corners.bottom && right ? radius : 0,
					backgroundColor: pressed
						? colors.background.overlay
						: hovered
							? colors.background.subtle
							: "transparent",
				};
			}}
		>
			{content}
		</Pressable>
	);

	if (!action) return row;

	return (
		<View style={{ flexDirection: "row", alignItems: "center" }}>
			<View style={{ flex: 1, minWidth: 0 }}>{row}</View>
			<View style={{ paddingRight: spacing[2] }}>{action}</View>
		</View>
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
/* Facts                                                                      */
/* -------------------------------------------------------------------------- */

export interface Fact {
	label: string;
	/** Rendered as `Body` when a string. Falsy values drop the whole row. */
	value?: React.ReactNode;
}

/**
 * A record's own details - label above value, hairline between rows.
 *
 * Deliberately *not* a `ListRow` with a trailing `value`. That shape puts the
 * label hard left and the value hard right, which works for a short state word
 * on a phone and falls apart everywhere else: on a 660pt column a phone number
 * ends up a hand's width from the word "Phone", and a two-line address wraps
 * against the label. Stacking removes the question of how wide the gap should
 * be, and reads the same at every column width.
 *
 * Empty facts are dropped rather than shown blank, so a sparse organisation
 * gets a short card instead of a column of dashes - unless `showEmpty` says
 * otherwise. The one audience it is wrong for is a reviewer: a missing
 * registration number is *the* finding on an NGO awaiting verification, and
 * dropping the row hides it. So the admin dossiers ask for the dashes.
 */
export function FactList({
	facts,
	showEmpty,
}: {
	facts: Fact[];
	/** Keep absent facts as an em dash. For a reviewer, a gap is a fact. */
	showEmpty?: boolean;
}) {
	const { colors, spacing } = useTheme();
	const present = showEmpty
		? facts
		: facts.filter((fact) => Boolean(fact.value));

	if (present.length === 0) return null;

	return (
		<Surface padded={false}>
			{present.map((fact, index) => (
				<View key={fact.label}>
					{index > 0 && (
						<View
							style={{
								height: 1,
								marginLeft: spacing[4],
								backgroundColor: colors.border.hairline,
							}}
						/>
					)}
					<View
						style={{
							paddingHorizontal: spacing[4],
							paddingVertical: spacing[3.5],
							gap: spacing[0.5],
						}}
					>
						<Caption color="tertiary">{fact.label}</Caption>
						{/* Selectable: half of these are an email, a phone number or a
						    registration number that someone is about to copy. */}
						{typeof fact.value === "string" ? (
							fact.value ? (
								<Body selectable>{fact.value}</Body>
							) : (
								<Dash />
							)
						) : (
							fact.value || <Dash />
						)}
					</View>
				</View>
			))}
		</Surface>
	);
}

function Dash() {
	return <Body color="quaternary">-</Body>;
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
 * mosaic - six boxes, four hues, no hierarchy.
 */
/** Narrowest a stat cell may get before the row breaks into a grid. */
const METRIC_MIN_CELL = 104;

/**
 * Columns for `count` stats in `width`, balanced so a wrap never leaves one
 * cell alone on its row: five stats at four-across become 3 + 2, four on a
 * phone become 2 + 2.
 */
function metricColumns(count: number, width: number) {
	if (count <= 1) return 1;
	if (width <= 0) return Math.min(count, 4);
	const fit = Math.max(1, Math.min(count, Math.floor(width / METRIC_MIN_CELL)));
	const rows = Math.ceil(count / fit);
	return Math.ceil(count / rows);
}

/*
 * Dividers are drawn from the cell's *position in the grid*, never from its
 * index in the list. The old row was a flex-wrap with `borderLeftWidth` on
 * every cell but the first, so whichever cell wrapped to a new line kept its
 * divider and drew it down the card's left edge. The grid is now computed from
 * the measured width: a vertical rule only between cells on the same row, a
 * horizontal one only between rows.
 */
export function MetricRow({ stats }: { stats: Stat[] }) {
	const { colors, spacing } = useTheme();
	const [width, setWidth] = useState(0);
	const columns = metricColumns(stats.length, width);

	return (
		<Surface padded={false}>
			<View
				onLayout={(event) => {
					const next = Math.round(event.nativeEvent.layout.width);
					setWidth((prev) => (prev === next ? prev : next));
				}}
				style={{ flexDirection: "row", flexWrap: "wrap" }}
			>
				{stats.map((stat, index) => (
					<View
						key={stat.label}
						style={{
							width: `${100 / columns}%`,
							paddingVertical: spacing[4],
							paddingHorizontal: spacing[4],
							borderLeftWidth: index % columns === 0 ? 0 : 1,
							borderLeftColor: colors.border.hairline,
							borderTopWidth: index >= columns ? 1 : 0,
							borderTopColor: colors.border.hairline,
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
			{description ? (
				<Caption color="secondary" style={{ marginTop: spacing[0.5] }}>
					{description}
				</Caption>
			) : null}
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
			{description ? (
				<Caption
					color="tertiary"
					style={{ textAlign: "center", marginTop: spacing[1] }}
				>
					{description}
				</Caption>
			) : null}
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
			{label ? (
				<Caption color="tertiary" style={{ marginTop: spacing[3] }}>
					{label}
				</Caption>
			) : null}
		</View>
	);
}

export function ErrorState({
	message,
	onRetry,
	title = "Something went wrong",
}: {
	message: string;
	onRetry?: () => void;
	/** Defaults to "Something went wrong". Name the thing when you can. */
	title?: string;
}) {
	const { colors, spacing } = useTheme();

	return (
		<View
			// Announced when it replaces a list: a spinner that silently turns
			// into an error is, to a screen reader, a spinner that stopped.
			accessibilityLiveRegion="polite"
			style={{
				alignItems: "center",
				paddingVertical: spacing[14],
				paddingHorizontal: spacing[6],
			}}
		>
			<Body weight="bold" color={colors.error.ink}>
				{title}
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
					{...focusable}
					style={(state) => {
						const { pressed } = state as PressState;
						// 44pt tall, so the target is the row and not just the word.
						return {
							marginTop: spacing[2],
							minHeight: 44,
							justifyContent: "center",
							paddingHorizontal: spacing[3],
							opacity: pressed ? 0.6 : 1,
						};
					}}
				>
					<Label color={colors.primary.ink}>Try again</Label>
				</Pressable>
			)}
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Skeleton                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * One placeholder block, the shape of the text or media it stands in for.
 *
 * `LoadingState` is a centred spinner in 112pt of padding, which is right for
 * a page whose shape is unknown and wrong for a list: the spinner sits where
 * the first row will be, then the rows arrive taller and the header above them
 * stays put while everything below it jumps. A skeleton holds the rows' height
 * from the first frame, so loading only changes what is *in* the boxes.
 *
 * The pulse is one shared opacity loop per `SkeletonList`, not one per block,
 * and it holds still when the person has asked for reduced motion - a page of
 * throbbing grey bars is exactly the motion that setting exists to stop.
 */
export function Skeleton({
	width = "100%",
	height = 12,
	radius,
	style,
}: {
	width?: number | `${number}%`;
	height?: number;
	/** Defaults to a pill for text-height blocks and `md` for anything taller. */
	radius?: number;
	style?: StyleProp<ViewStyle>;
}) {
	const { colors, borderRadius } = useTheme();

	return (
		<View
			style={[
				{
					width,
					height,
					borderRadius: radius ?? (height <= 16 ? 999 : borderRadius.md),
					backgroundColor: colors.background.subtle,
				},
				style,
			]}
		/>
	);
}

/**
 * A list's worth of placeholder rows, for the first load of a list.
 *
 * `row` is a `ListGroup` line (title and hint inside one surface, divided by
 * hairlines); `card` is a `Surface` per item with a title, two lines of body
 * and a short footer - roughly the height of the cards the paged screens draw,
 * so the first page lands without moving the scroll extent much.
 */
export function SkeletonList({
	count = 4,
	variant = "card",
	columns = 1,
	label = "Loading",
}: {
	count?: number;
	variant?: "card" | "row";
	/** Lays the cards out as a grid, matching a `numColumns` list. */
	columns?: number;
	/** Spoken in place of the blocks, which mean nothing to a screen reader. */
	label?: string;
}) {
	const { colors, spacing } = useTheme();
	const reduce = useReducedMotion();
	const pulse = useRef(new Animated.Value(1)).current;

	useEffect(() => {
		if (reduce) {
			pulse.setValue(1);
			return;
		}
		const loop = Animated.loop(
			Animated.sequence([
				Animated.timing(pulse, {
					toValue: 0.55,
					duration: 700,
					easing: Easing.inOut(Easing.quad),
					useNativeDriver: Platform.OS !== "web",
				}),
				Animated.timing(pulse, {
					toValue: 1,
					duration: 700,
					easing: Easing.inOut(Easing.quad),
					useNativeDriver: Platform.OS !== "web",
				}),
			]),
		);
		loop.start();
		return () => loop.stop();
	}, [pulse, reduce]);

	const items = Array.from({ length: count }, (_, index) => index);

	const body =
		variant === "row" ? (
			<Surface padded={false} style={{ overflow: "hidden" }}>
				{items.map((index) => (
					<View key={index}>
						{index > 0 && (
							<View
								style={{
									height: 1,
									marginLeft: spacing[4],
									backgroundColor: colors.border.hairline,
								}}
							/>
						)}
						<View
							style={{
								minHeight: 56,
								justifyContent: "center",
								paddingHorizontal: spacing[4],
								paddingVertical: spacing[3.5],
								gap: spacing[2],
							}}
						>
							<Skeleton width={index % 2 ? "45%" : "60%"} height={12} />
							<Skeleton width="30%" height={10} />
						</View>
					</View>
				))}
			</Surface>
		) : (
			<View
				style={{
					flexDirection: columns > 1 ? "row" : "column",
					flexWrap: columns > 1 ? "wrap" : "nowrap",
					...(columns > 1
						? { marginHorizontal: -spacing[1.5] }
						: { gap: spacing[3] }),
				}}
			>
				{items.map((index) => (
					<View
						key={index}
						style={
							columns > 1
								? { width: `${100 / columns}%`, padding: spacing[1.5] }
								: undefined
						}
					>
						<Surface>
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									gap: spacing[3],
								}}
							>
								<Skeleton width={36} height={36} radius={999} />
								<View style={{ flex: 1, gap: spacing[1.5] }}>
									<Skeleton width="45%" height={12} />
									<Skeleton width="25%" height={10} />
								</View>
							</View>
							<View style={{ gap: spacing[2], marginTop: spacing[4] }}>
								<Skeleton width="92%" height={12} />
								<Skeleton width={index % 2 ? "70%" : "80%"} height={12} />
							</View>
							<Skeleton
								width={112}
								height={36}
								style={{ marginTop: spacing[4] }}
							/>
						</Surface>
					</View>
				))}
			</View>
		);

	return (
		<Animated.View
			accessible
			accessibilityRole="progressbar"
			accessibilityLabel={label}
			style={{ opacity: pulse }}
		>
			{body}
		</Animated.View>
	);
}

/* -------------------------------------------------------------------------- */
/* Filter chips                                                               */
/* -------------------------------------------------------------------------- */

/**
 * One row of filters over one list: the chip recipe from `choice-chips.tsx`
 * (36pt, one line, ink fill when selected, quiet fill otherwise) in a
 * horizontal scroller.
 *
 * **Nothing in the row can be clipped.** A horizontal `ScrollView` is
 * `overflow: hidden` on both axes, so a chip flush with its edge loses the
 * first pixels of its pill and every pixel of its focus ring (2px at a 2px
 * offset). The content carries `CHIP_RING_ROOM` of padding on every side and
 * the scroller takes the same amount back as negative margin, so the first
 * chip still lines up with the page's text edge while its fill and ring sit
 * inside the clip. The height is fixed, so a column parent cannot squeeze it.
 */
export function FilterChips<T extends string>({
	options,
	value,
	onChange,
	inline,
	label,
}: {
	options: ReadonlyArray<ChipOption<T>>;
	value: T;
	onChange: (value: T) => void;
	/** Drops the bottom margin, for sitting beside a search field on one row. */
	inline?: boolean;
	/** Names the row for assistive tech - "Filter applicants". */
	label?: string;
}) {
	const { spacing } = useTheme();
	const room = CHIP_RING_ROOM;

	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			accessibilityRole="tablist"
			{...(label ? { accessibilityLabel: label } : {})}
			style={{
				height: CHIP_HEIGHT + room * 2,
				minHeight: CHIP_HEIGHT + room * 2,
				maxHeight: CHIP_HEIGHT + room * 2,
				flexGrow: 0,
				margin: -room,
				marginBottom: (inline ? 0 : spacing[5]) - room,
			}}
			contentContainerStyle={{
				flexDirection: "row",
				alignItems: "center",
				gap: spacing[2],
				padding: room,
			}}
		>
			{options.map((option) => (
				<Chip
					key={option.value}
					label={option.label}
					count={option.count}
					active={option.value === value}
					role="tab"
					onPress={() => onChange(option.value)}
				/>
			))}
		</ScrollView>
	);
}

/* -------------------------------------------------------------------------- */
/* Web                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Constrains content width and centres it on desktop web. Passes through on
 * mobile - no extra wrapper, no layout shift.
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
