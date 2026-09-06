import { useCallback, useEffect, useRef, useState } from "react";
import {
	Animated,
	Easing,
	Modal,
	ScrollView,
	useWindowDimensions,
	View,
} from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { Sheet, SheetHeader } from "@/components/ui/sheet";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";

/**
 * The slide-over panel.
 *
 * Same contract as `Sheet` (title, subtitle, body, pinned footer) and the same
 * header — screens never know which one rendered. On desktop web, where a
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
}

export function Drawer(props: DrawerProps) {
	const { isDesktop } = useMedia();
	if (!isDesktop) {
		const { visible, onClose, title, subtitle, children, footer } = props;
		return (
			<Sheet
				visible={visible}
				onClose={onClose}
				title={title}
				subtitle={subtitle}
				footer={footer}
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

function DesktopDrawer({
	visible,
	onClose,
	title,
	subtitle,
	children,
	footer,
}: DrawerProps) {
	const { colors, spacing, elevation, isDark } = useTheme();
	const { width, height } = useWindowDimensions();
	const [scrolled, setScrolled] = useState(false);

	const panelWidth = Math.min(PANEL_WIDTH, Math.max(320, width - 64));
	const slide = useRef(new Animated.Value(panelWidth)).current;
	const [mounted, setMounted] = useState(visible);
	const mountedRef = useRef(visible);

	// Mounted until the slide-out finishes; `onClose` fires only for a
	// user-initiated dismiss, never when the parent flips `visible` itself.
	useEffect(() => {
		if (visible) {
			mountedRef.current = true;
			setMounted(true);
			setScrolled(false);
			slide.setValue(panelWidth);
			Animated.timing(slide, {
				toValue: 0,
				duration: 280,
				easing: Easing.bezier(0.22, 1, 0.36, 1),
				useNativeDriver: true,
			}).start();
		} else if (mountedRef.current) {
			Animated.timing(slide, {
				toValue: panelWidth,
				duration: 200,
				easing: Easing.in(Easing.cubic),
				useNativeDriver: true,
			}).start(() => {
				mountedRef.current = false;
				setMounted(false);
			});
		}
	}, [visible, panelWidth, slide]);

	const requestClose = useCallback(() => {
		if (!mountedRef.current) return;
		Animated.timing(slide, {
			toValue: panelWidth,
			duration: 200,
			easing: Easing.in(Easing.cubic),
			useNativeDriver: true,
		}).start(() => {
			mountedRef.current = false;
			setMounted(false);
			onClose();
		});
	}, [onClose, panelWidth, slide]);

	// A desktop dialog closes on Escape.
	useEffect(() => {
		if (!mounted) return;
		const target = globalThis as unknown as {
			addEventListener?: (
				type: string,
				listener: (event: { key?: string }) => void,
			) => void;
			removeEventListener?: (
				type: string,
				listener: (event: { key?: string }) => void,
			) => void;
		};
		if (typeof target.addEventListener !== "function") return;
		const onKey = (event: { key?: string }) => {
			if (event?.key === "Escape") requestClose();
		};
		target.addEventListener("keydown", onKey);
		return () => target.removeEventListener?.("keydown", onKey);
	}, [mounted, requestClose]);

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
						showsVerticalScrollIndicator={false}
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
		</Modal>
	);
}
