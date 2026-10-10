import { useCallback, useEffect, useRef, useState } from "react";
import {
	Animated,
	Easing,
	Modal,
	ScrollView,
	useWindowDimensions,
	View,
} from "react-native";
import { OverlayHost } from "@/components/ui/overlay";
import { Pressable } from "@/components/ui/pressable";
import { Sheet, SheetHeader } from "@/components/ui/sheet";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { motionDuration, useReducedMotion } from "@/lib/motion";
import { verticalScrollbar } from "@/lib/scroll";

/**
 * The slide-over panel.
 *
 * Same contract as `Sheet` (title, subtitle, body, pinned footer) and the same
 * header - screens never know which one rendered. On desktop web, where a
 * bottom sheet sliding up a 1400px window reads as a mistake and there is
 * horizontal space to spend, this docks a panel to the right edge instead:
 * the feed stays visible on the left, the decision happens on the right, and
 * nothing pushes a new page. Everywhere else it *is* a `Sheet` (gorhom bottom
 * sheet on native, centred dialog on narrow web).
 */
export interface DrawerProps {
	visible: boolean;
	onClose: () => void;
	title: string;
	subtitle?: string;
	children: React.ReactNode;
	/** Pinned below the body: the primary action lives here, never in the scroll. */
	footer?: React.ReactNode;
	/**
	 * Widens the desktop panel from 440 to 520, and the narrow-web dialog with
	 * it. For a body that is not a column of short fields - a writing canvas, a
	 * strip of media tiles - where 440 crams the measure.
	 */
	wide?: boolean;
	/**
	 * 720 instead. For a **dossier**: a record with fact tables, a document list
	 * and a decision, read side by side with the list it was opened from. At 520
	 * an org's two-column fact rows wrap and its document cards stack their own
	 * buttons; at 720 both sit flat, and there is still 600px of list visible on
	 * a 1440 window - which is the whole reason a reviewer gets a panel instead
	 * of a page.
	 */
	xl?: boolean;
}

export function Drawer(props: DrawerProps) {
	const { isDesktop } = useMedia();
	if (!isDesktop) {
		const { visible, onClose, title, subtitle, children, footer, wide, xl } =
			props;
		return (
			<Sheet
				visible={visible}
				onClose={onClose}
				title={title}
				subtitle={subtitle}
				footer={footer}
				// `xl` has no meaning on a phone - the sheet is the window's width
				// either way - so it collapses into the sheet's own `wide`.
				wide={wide || xl}
			>
				{children}
			</Sheet>
		);
	}
	return <DesktopDrawer {...props} />;
}

/* -------------------------------------------------------------------------- */
/* Desktop slide-over                                                         */
/* -------------------------------------------------------------------------- */

const PANEL_WIDTH = 440;
const WIDE_PANEL_WIDTH = 520;
const XL_PANEL_WIDTH = 720;

function DesktopDrawer({
	visible,
	onClose,
	title,
	subtitle,
	children,
	footer,
	wide,
	xl,
}: DrawerProps) {
	const { colors, spacing, elevation, isDark } = useTheme();
	const { width, height } = useWindowDimensions();
	const [scrolled, setScrolled] = useState(false);
	// The slide is decoration; with reduced motion the panel simply appears.
	const reduce = useReducedMotion();

	const panelWidth = Math.min(
		xl ? XL_PANEL_WIDTH : wide ? WIDE_PANEL_WIDTH : PANEL_WIDTH,
		// Never the whole window: the point of a slide-over is that the list it
		// was opened from stays visible behind it.
		Math.max(320, width - 64),
	);
	const slide = useRef(new Animated.Value(panelWidth)).current;
	const [mounted, setMounted] = useState(visible);
	const mountedRef = useRef(visible);
	const closingRef = useRef(false);

	// Mounted until the slide-out finishes; `onClose` fires only for a
	// user-initiated dismiss, never when the parent flips `visible` itself.
	useEffect(() => {
		if (visible) {
			mountedRef.current = true;
			closingRef.current = false;
			setMounted(true);
			setScrolled(false);
			slide.setValue(panelWidth);
			Animated.timing(slide, {
				toValue: 0,
				duration: motionDuration(280, reduce),
				easing: Easing.bezier(0.22, 1, 0.36, 1),
				useNativeDriver: true,
			}).start();
		} else if (mountedRef.current) {
			Animated.timing(slide, {
				toValue: panelWidth,
				duration: motionDuration(200, reduce),
				easing: Easing.in(Easing.cubic),
				useNativeDriver: true,
			}).start(() => {
				mountedRef.current = false;
				setMounted(false);
			});
		}
	}, [visible, panelWidth, slide, reduce]);

	// `closing` guards the second request: a scrim press during the slide-out,
	// or the Modal's own Escape arriving while one is already running, used to
	// start a second animation whose callback called `onClose` again.
	const requestClose = useCallback(() => {
		if (!mountedRef.current || closingRef.current) return;
		closingRef.current = true;
		Animated.timing(slide, {
			toValue: panelWidth,
			duration: motionDuration(200, reduce),
			easing: Easing.in(Easing.cubic),
			useNativeDriver: true,
		}).start(() => {
			closingRef.current = false;
			mountedRef.current = false;
			setMounted(false);
			onClose();
		});
	}, [onClose, panelWidth, slide, reduce]);

	/*
	 * Escape is the Modal's: react-native-web's `Modal` calls `onRequestClose`
	 * on Escape keyup, and traps focus inside itself. This used to add its own
	 * window keydown listener as well, which closed the drawer twice per press -
	 * and closed it underneath an open confirm dialog, whose Escape was meant
	 * to cancel only the question (see `ConfirmDialog` in `overlay.tsx`).
	 */

	if (!mounted) return null;

	return (
		<Modal
			visible
			transparent
			animationType="none"
			statusBarTranslucent
			onRequestClose={requestClose}
		>
			<View style={{ flex: 1 }}>
				<Pressable
					onPress={requestClose}
					accessibilityRole="button"
					accessibilityLabel="Dismiss"
					// Not a tab stop - see the same scrim in `sheet.tsx`.
					focusable={false}
					style={{
						position: "absolute",
						top: 0,
						right: 0,
						bottom: 0,
						left: 0,
						backgroundColor: "rgba(17, 17, 17, 0.45)",
					}}
				/>
				<Animated.View
					accessibilityLabel={title}
					accessibilityViewIsModal
					style={{
						position: "absolute",
						top: 0,
						bottom: 0,
						right: 0,
						width: panelWidth,
						maxHeight: height,
						backgroundColor: colors.background.sheet,
						transform: [{ translateX: slide }],
						...(isDark ? {} : elevation.raised),
					}}
				>
					<SheetHeader
						title={title}
						subtitle={subtitle}
						onClose={requestClose}
						divided={scrolled}
						grabber={false}
					/>
					<ScrollView
						keyboardShouldPersistTaps="handled"
						{...verticalScrollbar}
						onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > 4)}
						scrollEventThrottle={32}
						contentContainerStyle={{
							paddingHorizontal: spacing[5],
							paddingTop: spacing[4],
							paddingBottom: spacing[4],
						}}
					>
						{children}
					</ScrollView>
					{footer && (
						<View
							style={{
								paddingHorizontal: spacing[5],
								paddingTop: spacing[3],
								paddingBottom: spacing[4],
								borderTopWidth: 1,
								borderTopColor: colors.border.hairline,
							}}
						>
							{footer}
						</View>
					)}
				</Animated.View>
			</View>
			{/* Same reason as the sheet's: the root host is below this Modal. */}
			<OverlayHost />
		</Modal>
	);
}
