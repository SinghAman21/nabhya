import BottomSheet, {
	BottomSheetBackdrop,
	type BottomSheetBackdropProps,
	BottomSheetFlatList,
	BottomSheetFooter,
	type BottomSheetFooterProps,
	BottomSheetScrollView,
	BottomSheetView,
} from "@gorhom/bottom-sheet";
import { Check, X } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	FlatList,
	type FlatListProps,
	KeyboardAvoidingView,
	Modal,
	type NativeScrollEvent,
	type NativeSyntheticEvent,
	Platform,
	ScrollView,
	useWindowDimensions,
	View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OverlayHost } from "@/components/ui/overlay";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption, H4 } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { focusable } from "@/lib/focus";
import { verticalScrollbar } from "@/lib/scroll";

/**
 * The one bottom sheet.
 *
 * Every decision in the product happens in a sheet. On native this is
 * `@gorhom/bottom-sheet` hosted in a React Native `Modal`: real pan-to-dismiss,
 * detents, a body that scrolls once the sheet is fully open and drags the sheet
 * before that, and a keyboard that pushes the sheet up instead of covering the
 * field. The title row and
 * the footer are pinned - the title is drawn as the sheet's *handle*, so it
 * stays put while the body scrolls under it and picks up a hairline once it
 * does.
 *
 * On web it is a plain `Modal`: a slide-up panel on a phone-width window and a
 * centred dialog on desktop, where a sheet sliding up a 1400px window reads as
 * a mistake. Same props, same header, same footer - screens never know which.
 *
 * Sized to content by default, capped just under the status bar, so a
 * two-field form is a short card and a long list still scrolls. Pass
 * `detents` for a sheet whose content has no natural height (a list).
 */
/*
 * **Do not put a portalling primitive inside a sheet.** `DropdownMenu`,
 * `Select` and anything else built on `@rn-primitives` renders through a
 * portal, and a portal cannot be made to clear this sheet reliably on either
 * platform: on native the root `PortalHost` sits *below* the React Native
 * `Modal` the sheet is hosted in, and on web react-native-web hosts that Modal
 * at `zIndex: 9999` while Radix pins its popper wrapper to the content's own
 * computed z-index - which no prop on the menu can raise, because the props
 * spread lands on a child of the positioned element. Use an inline control
 * instead; `post-composer.tsx` chose `ChoiceChips` for exactly this reason.
 */

export interface SheetProps {
	visible: boolean;
	onClose: () => void;
	title: string;
	subtitle?: string;
	children: React.ReactNode;
	/** Pinned below the body: the primary action lives here, never in the scroll. */
	footer?: React.ReactNode;
	/** Set false when the body owns its own list (`SheetFlatList`). */
	scrollable?: boolean;
	/**
	 * Fixed snap points instead of sizing to content, e.g. `["60%", "92%"]`.
	 * Required when `scrollable` is false and the body is a list.
	 */
	detents?: Array<string | number>;
	/**
	 * Widens the desktop dialog from 480 to 620. For a body that is not a
	 * column of fields - a writing canvas, a media grid - where 480 crams the
	 * measure and wraps a four-tile strip onto two rows.
	 */
	wide?: boolean;
}

export function Sheet(props: SheetProps) {
	const { isDesktop } = useMedia();
	if (Platform.OS === "web" || isDesktop) return <WebSheet {...props} />;
	return <NativeSheet {...props} />;
}

/* -------------------------------------------------------------------------- */
/* Native                                                                     */
/* -------------------------------------------------------------------------- */

function NativeSheet({
	visible,
	onClose,
	title,
	subtitle,
	children,
	footer,
	scrollable = true,
	detents,
}: SheetProps) {
	const { colors, spacing, borderRadius } = useTheme();
	const insets = useSafeAreaInsets();
	const { height } = useWindowDimensions();
	const sheetRef = useRef<BottomSheet>(null);
	// The sheet stays mounted after `visible` flips to false until it has
	// finished sliding down; `onClose` from gorhom is what unmounts it.
	const [mounted, setMounted] = useState(visible);
	const [scrolled, setScrolled] = useState(false);
	const [footerHeight, setFooterHeight] = useState(0);

	useEffect(() => {
		if (visible) {
			setMounted(true);
			// Re-opened mid-close: bring it back up instead of leaving it half way.
			sheetRef.current?.snapToIndex(0);
		} else {
			sheetRef.current?.close();
		}
	}, [visible]);

	const requestClose = useCallback(() => {
		sheetRef.current?.close();
	}, []);

	const handleClosed = useCallback(() => {
		setMounted(false);
		setScrolled(false);
		onClose();
	}, [onClose]);

	const onScroll = useCallback(
		(event: NativeSyntheticEvent<NativeScrollEvent>) => {
			const next = event.nativeEvent.contentOffset.y > 4;
			setScrolled((prev) => (prev === next ? prev : next));
		},
		[],
	);

	const renderBackdrop = useCallback(
		(backdropProps: BottomSheetBackdropProps) => (
			<BottomSheetBackdrop
				{...backdropProps}
				appearsOnIndex={0}
				disappearsOnIndex={-1}
				opacity={0.45}
				pressBehavior="close"
			/>
		),
		[],
	);

	const renderHandle = useCallback(
		() => (
			<SheetHeader
				title={title}
				subtitle={subtitle}
				onClose={requestClose}
				divided={scrolled}
				grabber
			/>
		),
		[title, subtitle, requestClose, scrolled],
	);

	const renderFooter = useCallback(
		(footerProps: BottomSheetFooterProps) => (
			<BottomSheetFooter {...footerProps} bottomInset={insets.bottom}>
				<View
					onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
					style={{
						paddingHorizontal: spacing[5],
						paddingTop: spacing[3],
						paddingBottom: spacing[3],
						borderTopWidth: 1,
						borderTopColor: colors.border.hairline,
						backgroundColor: colors.background.sheet,
					}}
				>
					{footer}
				</View>
			</BottomSheetFooter>
		),
		[footer, insets.bottom, spacing, colors],
	);

	if (!mounted) return null;

	// Space under the body for the pinned footer and the home indicator, so the
	// last field is never hidden behind either.
	const bottomPad = (footer ? footerHeight : 0) + insets.bottom + spacing[4];

	/*
	 * Hosted in a React Native `Modal`, not gorhom's modal provider. The Modal
	 * guarantees the sheet sits above the native stack and the tab bar on both
	 * platforms; gorhom provides everything inside it - the drag, the detents,
	 * the keyboard handling and the scroll hand-off. Android needs its own
	 * gesture root inside a Modal, hence the wrapper.
	 */
	return (
		<Modal
			visible
			transparent
			statusBarTranslucent
			navigationBarTranslucent
			animationType="fade"
			onRequestClose={requestClose}
		>
			<GestureHandlerRootView style={{ flex: 1 }}>
				<BottomSheet
					ref={sheetRef}
					index={0}
					animateOnMount
					onClose={handleClosed}
					enablePanDownToClose
					enableDynamicSizing={!detents}
					snapPoints={detents}
					maxDynamicContentSize={height - insets.top - spacing[6]}
					topInset={insets.top}
					keyboardBehavior="interactive"
					keyboardBlurBehavior="restore"
					android_keyboardInputMode="adjustResize"
					backdropComponent={renderBackdrop}
					handleComponent={renderHandle}
					footerComponent={footer ? renderFooter : undefined}
					backgroundStyle={{
						backgroundColor: colors.background.sheet,
						// backgroundColor: "#111111",

						borderRadius: borderRadius["2xl"],
					}}
				>
					{scrollable ? (
						<BottomSheetScrollView
							keyboardShouldPersistTaps="handled"
							{...verticalScrollbar}
							onScroll={onScroll}
							contentContainerStyle={{
								paddingHorizontal: spacing[5],
								paddingBottom: bottomPad,
							}}
						>
							{children}
						</BottomSheetScrollView>
					) : (
						<BottomSheetView style={{ flex: 1, paddingBottom: bottomPad }}>
							{children}
						</BottomSheetView>
					)}
				</BottomSheet>
			</GestureHandlerRootView>
			{/* A toast raised from inside this sheet has to be drawn inside the
			    Modal: the root host sits underneath it. See `ui/overlay.tsx`. */}
			<OverlayHost />
		</Modal>
	);
}

/* -------------------------------------------------------------------------- */
/* Web                                                                        */
/* -------------------------------------------------------------------------- */

function WebSheet({
	visible,
	onClose,
	title,
	subtitle,
	children,
	footer,
	scrollable = true,
	detents,
	wide,
}: SheetProps) {
	const { colors, spacing, borderRadius, elevation, isDark } = useTheme();
	const insets = useSafeAreaInsets();
	const { height } = useWindowDimensions();
	const { isDesktop } = useMedia();
	const [scrolled, setScrolled] = useState(false);

	const panel = (
		<View
			style={{
				maxHeight: height * 0.9,
				// A list sheet has no natural height: open it tall from the start.
				...(detents ? { height: height * 0.85 } : {}),
				backgroundColor: colors.background.sheet,
				borderTopLeftRadius: borderRadius["2xl"],
				borderTopRightRadius: borderRadius["2xl"],
				...(isDesktop
					? {
							width: wide ? 620 : 480,
							alignSelf: "center",
							borderRadius: borderRadius["2xl"],
							marginBottom: spacing[10],
							...(detents ? { height: Math.min(height * 0.8, 720) } : {}),
						}
					: {}),
				...(isDark ? {} : elevation.raised),
				paddingBottom: isDesktop ? 0 : insets.bottom,
			}}
		>
			<SheetHeader
				title={title}
				subtitle={subtitle}
				onClose={onClose}
				divided={scrolled}
				grabber={!isDesktop}
			/>

			{scrollable ? (
				<ScrollView
					keyboardShouldPersistTaps="handled"
					{...verticalScrollbar}
					onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > 4)}
					scrollEventThrottle={32}
					contentContainerStyle={{
						paddingHorizontal: spacing[5],
						paddingBottom: spacing[4],
					}}
				>
					{children}
				</ScrollView>
			) : (
				<View style={{ flex: detents ? 1 : undefined, flexShrink: 1 }}>
					{children}
				</View>
			)}

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
		</View>
	);

	return (
		<Modal
			visible={visible}
			transparent
			animationType={isDesktop ? "fade" : "slide"}
			statusBarTranslucent
			onRequestClose={onClose}
		>
			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : undefined}
				style={{ flex: 1, justifyContent: isDesktop ? "center" : "flex-end" }}
			>
				<Pressable
					onPress={onClose}
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
				{panel}
			</KeyboardAvoidingView>
			<OverlayHost />
		</Modal>
	);
}

/* -------------------------------------------------------------------------- */
/* Shared parts                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Grabber, title, optional subtitle and a close target. `divided` draws the
 * hairline that tells the reader the body has scrolled under the title.
 *
 * Exported for `Drawer`, so the slide-over speaks the same header language.
 */
/**
 * The pinned top of a sheet: rounded corners, the sheet fill, the grabber and
 * the hairline that appears once the body has scrolled under it. Everything a
 * header needs *around* its content, so a custom header (`header` on
 * `SheetProps`) gets all of it for free and cannot drift from the default one.
 */
export function SheetChrome({
	children,
	divided,
	grabber,
}: {
	children: React.ReactNode;
	divided: boolean;
	grabber: boolean;
}) {
	const { colors, spacing, borderRadius } = useTheme();

	return (
		<View
			style={{
				borderTopLeftRadius: borderRadius["2xl"],
				borderTopRightRadius: borderRadius["2xl"],
				backgroundColor: colors.background.sheet,
				borderBottomWidth: 1,
				borderBottomColor: divided ? colors.border.hairline : "transparent",
			}}
		>
			{grabber && (
				<View
					style={{
						alignSelf: "center",
						width: 36,
						height: 4,
						borderRadius: 999,
						marginTop: spacing[2],
						backgroundColor: colors.border.dark,
					}}
				/>
			)}
			{children}
		</View>
	);
}

export function SheetHeader({
	title,
	subtitle,
	onClose,
	divided,
	grabber,
}: {
	title: string;
	subtitle?: string;
	onClose: () => void;
	divided: boolean;
	grabber: boolean;
}) {
	const { colors, spacing } = useTheme();

	return (
		<SheetChrome divided={divided} grabber={grabber}>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[3],
					paddingHorizontal: spacing[5],
					paddingTop: grabber ? spacing[3] : spacing[4],
					paddingBottom: spacing[3],
				}}
			>
				<View style={{ flex: 1 }}>
					<H4 accessibilityRole="header" numberOfLines={2}>
						{title}
					</H4>
					{subtitle && (
						<Caption
							color="tertiary"
							numberOfLines={1}
							style={{ marginTop: spacing[0.5] }}
						>
							{subtitle}
						</Caption>
					)}
				</View>
				<Pressable
					onPress={onClose}
					accessibilityRole="button"
					accessibilityLabel="Close"
					hitSlop={8}
					style={({ pressed }) => ({
						width: 32,
						height: 32,
						borderRadius: 999,
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: pressed
							? colors.background.tertiary
							: colors.background.subtle,
					})}
				>
					<X
						size={16}
						color={colors.text.secondary as string}
						strokeWidth={2.2}
					/>
				</Pressable>
			</View>
		</SheetChrome>
	);
}

/**
 * The list for a `scrollable={false}` sheet. On native it is gorhom's list,
 * which hands the drag to the sheet until it is fully open; on web a plain
 * `FlatList`. Comes with the sheet's gutters; add your own `paddingBottom`.
 */
export function SheetFlatList<T>(props: FlatListProps<T>) {
	const { spacing } = useTheme();
	const insets = useSafeAreaInsets();
	const { isDesktop } = useMedia();

	const contentContainerStyle = [
		{
			paddingHorizontal: spacing[5],
			paddingBottom: spacing[6] + (isDesktop ? 0 : insets.bottom),
		},
		props.contentContainerStyle,
	];

	if (Platform.OS === "web" || isDesktop) {
		return (
			<FlatList
				keyboardShouldPersistTaps="handled"
				{...verticalScrollbar}
				{...props}
				contentContainerStyle={contentContainerStyle}
			/>
		);
	}

	return (
		<BottomSheetFlatList
			keyboardShouldPersistTaps="handled"
			{...verticalScrollbar}
			{...(props as any)}
			contentContainerStyle={contentContainerStyle}
		/>
	);
}

/**
 * One choice in a pick-one sheet: label, optional hint, a tick when selected.
 * Radio semantics for assistive tech.
 */
export function SheetOption({
	label,
	hint,
	selected,
	onPress,
}: {
	label: string;
	hint?: string;
	selected: boolean;
	onPress: () => void;
}) {
	const { colors, spacing, borderRadius } = useTheme();

	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="radio"
			accessibilityState={{ checked: selected }}
			{...focusable}
			style={({ pressed }) => ({
				flexDirection: "row",
				alignItems: "center",
				gap: spacing[3],
				minHeight: 48,
				paddingHorizontal: spacing[3],
				paddingVertical: spacing[3],
				borderRadius: borderRadius.md,
				backgroundColor: pressed
					? colors.background.subtle
					: selected
						? colors.primary.tint
						: "transparent",
			})}
		>
			<View style={{ flex: 1 }}>
				<Body weight={selected ? "semibold" : "normal"}>{label}</Body>
				{hint && <Caption color="quaternary">{hint}</Caption>}
			</View>
			{selected && (
				<Check size={18} color={colors.primary.ink} strokeWidth={2.4} />
			)}
		</Pressable>
	);
}
