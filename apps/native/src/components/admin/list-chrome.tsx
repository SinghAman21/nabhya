import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import {
	Animated,
	Easing,
	RefreshControl,
	ScrollView,
	View,
	type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Caption, H5, Title } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { verticalScrollbar } from "@/lib/scroll";

/**
 * The console page: a full-width scroller, a title that scrolls away, and a
 * **pinned command bar** that keeps search, filters and the view switch reachable
 * from anywhere in a three-hundred-row list.
 *
 * ## The page is the scroller
 *
 * This used to be the other way round - a `Screen` capped at 1040 and centred,
 * holding a fixed header over a list that owned a `FlatList`. Three things went
 * wrong with that, all visible at once:
 *
 * 1. The scrollbar appeared at x=1040: a bar down the middle of a 1900px window,
 *    with the browser's own one sitting dead at the edge.
 * 2. The audit log's grouped list added a *second* scrollbar, inside its card.
 * 3. A table header cannot stick to a container it is not inside, so the column
 *    labels scrolled away with the rows.
 *
 * So the `ScrollView` is the full-width column. **Consequence: nothing inside a
 * console page may own a vertical scroller** - no `FlatList`, no nested
 * `ScrollView`. That is why `ConsoleList` renders rows inline. `DataTable`'s
 * horizontal scroller is fine; a different axis cannot compete.
 *
 * ## Full width, no content cap
 *
 * There is no `maxWidth` on a console page, deliberately. A cap is right for
 * reading (`WebContent`'s 720) and wrong for a table: the columns are fixed
 * except one, so the width a monitor offers goes to the identity column - the
 * NGO's name - which is exactly the column that wants it. A capped table on a
 * 2560px screen is a table with a field of empty page beside it. The desktop
 * rail already takes the first 264.
 *
 * ## Two-tier chrome, and why the toolbar is the tier that pins
 *
 * `title` scrolls away and the **toolbar stays**, with the title reappearing
 * *inside* the pinned bar once the big one is gone (`H5` beside the controls) so
 * the page never loses its name. The alternative - pinning the whole header -
 * spends 96pt of every screen restating a title the reader chose from the rail
 * two seconds ago, while the controls they actually reach for are the ones that
 * scroll off.
 *
 * **The handover is animated, and it has to be.** As a bare boolean the title
 * and the divider popped into existence mid-scroll, which reads as a glitch
 * rather than as chrome settling: one frame the bar is transparent and empty,
 * the next it has a rule and a heading, and the toolbar beside it jumps sideways
 * to make room. One `Animated.Value` drives all three - the title's opacity and
 * a 6pt rise, and the divider's opacity - so they arrive together. 180ms in,
 * 140ms out: slightly quicker to leave than to appear, because on the way back
 * up the reader is heading for the real title and does not want to wait for the
 * stand-in to get out of the way.
 *
 * `useNativeDriver` is false: `borderBottomColor` is not a transform or an
 * opacity, so the divider cannot be driven off the UI thread. It is three
 * interpolations on one value, not a per-frame layout pass.
 *
 * `DataTable`'s own sticky header then has to sit *below* this bar rather than
 * under it, which is what `ConsoleChromeContext` is for: the bar measures itself
 * and publishes its height, and the table offsets its `top` by it. Without that
 * the column labels pin at y=0 and the toolbar covers them.
 */

/** Published by `AdminScreen`, read by `DataTable`'s sticky header. */
const ConsoleChromeContext = createContext(0);

export function useStickyOffset() {
	return useContext(ConsoleChromeContext);
}

/** How close to the bottom counts as "load the next page". */
const NEAR_END = 320;

/** Scroll distance past which the big title is gone and the bar takes over. */
const COLLAPSE_AT = 44;

const STICKY_BAR: ViewStyle = {
	position: "sticky",
	top: 0,
	zIndex: 30,
} as unknown as ViewStyle;

export function AdminScreen({
	title,
	subtitle,
	action,
	toolbar,
	children,
	onNearEnd,
	refreshing,
	onRefresh,
}: {
	title: string;
	subtitle?: string;
	/** The page's primary action - a real button with a word on it. */
	action?: React.ReactNode;
	/** The command bar's contents: search, filters, the view switch. */
	toolbar?: React.ReactNode;
	children: React.ReactNode;
	/**
	 * Called on each approach to the bottom. The page owns this rather than the
	 * list, because the page is the only thing that scrolls - a list with no
	 * scroller of its own has no `onEndReached` to give.
	 */
	onNearEnd?: () => void;
	refreshing?: boolean;
	onRefresh?: () => void;
}) {
	const { colors, spacing } = useTheme();
	const { isDesktop } = useMedia();
	const insets = useSafeAreaInsets();
	const [collapsed, setCollapsed] = useState(false);
	const [barHeight, setBarHeight] = useState(0);
	// Read from a ref, not from state, so the scroll handler does not re-render
	// the page on every frame it fires - it only sets state on the one frame the
	// threshold is actually crossed.
	const collapsedRef = useRef(false);
	const handover = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		Animated.timing(handover, {
			toValue: collapsed ? 1 : 0,
			duration: collapsed ? 180 : 140,
			easing: collapsed ? Easing.out(Easing.quad) : Easing.in(Easing.quad),
			useNativeDriver: false,
		}).start();
	}, [collapsed, handover]);

	const titleOpacity = handover;
	const titleRise = handover.interpolate({
		inputRange: [0, 1],
		outputRange: [6, 0],
	});
	const dividerColor = handover.interpolate({
		inputRange: [0, 1],
		outputRange: ["rgba(0,0,0,0)", colors.border.hairline as string],
	});

	const gutter = isDesktop ? spacing[8] : spacing[5];

	const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
		const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;

		const past = contentOffset.y > COLLAPSE_AT;
		if (past !== collapsedRef.current) {
			collapsedRef.current = past;
			setCollapsed(past);
		}

		if (onNearEnd) {
			const remaining =
				contentSize.height - (contentOffset.y + layoutMeasurement.height);
			if (remaining < NEAR_END) onNearEnd();
		}
	};

	return (
		<View style={{ flex: 1, backgroundColor: colors.background.warm }}>
			<ScrollView
				{...verticalScrollbar}
				onScroll={onScroll}
				// 16ms would re-run the collapse comparison every frame for no gain;
				// the threshold is a 44pt band, not a pixel.
				scrollEventThrottle={64}
				{...(onRefresh
					? {
							refreshControl: (
								<RefreshControl
									refreshing={!!refreshing}
									onRefresh={onRefresh}
									tintColor={colors.text.quaternary as string}
								/>
							),
						}
					: {})}
				contentContainerStyle={{ paddingBottom: spacing[16] }}
			>
				{/* Tier one: the title. Scrolls away. */}
				<View
					style={{
						flexDirection: "row",
						flexWrap: "wrap",
						alignItems: "flex-end",
						justifyContent: "space-between",
						gap: spacing[3],
						paddingTop: insets.top + spacing[5],
						paddingHorizontal: gutter,
						paddingBottom: spacing[4],
					}}
				>
					{/* Wraps rather than squeezes: on a phone the overview's three
					    buttons left "Overview" a sliver to wrap in. With a 200pt floor
					    the action drops under the title instead. */}
					<View
						style={{ flexGrow: 1, flexShrink: 1, flexBasis: 200, minWidth: 0 }}
					>
						{subtitle && (
							<Caption color="tertiary" numberOfLines={2}>
								{subtitle}
							</Caption>
						)}
						{/* `Title`, sentence case. `H2` is the display face, which draws
						    only capitals - every console page read VOLUNTEERS, FINANCE. */}
						<Title accessibilityRole="header" numberOfLines={2}>
							{title}
						</Title>
					</View>
					{action}
				</View>

				{/* Tier two: the command bar. Pins, and picks up the title once the
				    big one is gone. */}
				<Animated.View
					onLayout={(event) => setBarHeight(event.nativeEvent.layout.height)}
					style={[
						STICKY_BAR,
						{
							paddingHorizontal: gutter,
							paddingVertical: spacing[2.5],
							backgroundColor: colors.background.warm,
							// The rule fades in only once the bar is doing the pinning;
							// unscrolled it would be a line under the title for no reason.
							borderBottomWidth: 1,
							borderBottomColor: dividerColor,
						},
					]}
				>
					{/* One row, centred. The toolbar carries no margin of its own
					    (see `Toolbar`) precisely so both halves sit on the same
					    centre line - a margin on either one tips the row. */}
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: spacing[4],
							minHeight: 40,
						}}
					>
						{/* Mounted throughout and faded, not mounted on the threshold:
						    mounting it mid-scroll would re-measure the bar and shove the
						    toolbar sideways in one frame. `collapsed` still gates the
						    width so an invisible heading cannot eat the toolbar's row
						    while the page is at the top. */}
						{isDesktop && (
							<Animated.View
								pointerEvents="none"
								style={{
									opacity: titleOpacity,
									transform: [{ translateY: titleRise }],
									flexShrink: 0,
									...(collapsed ? {} : { width: 0, overflow: "hidden" }),
								}}
							>
								<H5 numberOfLines={1}>{title}</H5>
							</Animated.View>
						)}
						<View style={{ flex: 1, minWidth: 0 }}>{toolbar}</View>
					</View>
				</Animated.View>

				<View style={{ paddingHorizontal: gutter, paddingTop: spacing[1] }}>
					<ConsoleChromeContext.Provider value={barHeight}>
						{children}
					</ConsoleChromeContext.Provider>
				</View>
			</ScrollView>
		</View>
	);
}

/**
 * How many rows matched, and how many are loaded of them.
 *
 * "20 of 340 NGOs" rather than "340 organizations": on a paged console the gap
 * between the two is the thing a reviewer needs to know before they sort, since
 * sorting re-runs the query server-side and hands back a different twenty.
 * Silent when there is nothing to count - the empty state says it better.
 */
export function ResultCount({
	total,
	loaded,
	noun,
	plural,
}: {
	total: number;
	loaded: number;
	noun: string;
	/** When it is not just `noun + "s"`. */
	plural?: string;
}) {
	const { spacing } = useTheme();
	if (total === 0) return null;

	return (
		<Caption color="tertiary" style={{ marginBottom: spacing[2] }}>
			{loaded < total ? `${loaded} of ${total}` : total}{" "}
			{total === 1 ? noun : (plural ?? `${noun}s`)}
		</Caption>
	);
}
