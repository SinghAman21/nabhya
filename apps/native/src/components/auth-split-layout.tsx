import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";
import {
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	useWindowDimensions,
	View,
	type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandMark, BrandValues } from "@/components/brand";
import { PanelWash } from "@/components/panel-wash";
import { Body, Caption, Display } from "@/components/ui/typography";
import { panelGrounds, panelInk } from "@/constants/design-system";
import { useTheme } from "@/hooks/use-theme";
import { verticalScrollbar } from "@/lib/scroll";

const BREAKPOINT = 768;

/**
 * The row's height on the web, so the form column's `ScrollView` has a real
 * height to scroll within rather than growing to its content. Same idiom as
 * `WizardShell` and `(ngo)/_layout.tsx`.
 */
const WEB_VIEWPORT: ViewStyle =
	Platform.OS === "web" ? ({ height: "100dvh" } as unknown as ViewStyle) : {};

interface AuthSplitLayoutProps {
	children: ReactNode;
	alternateLink: ReactNode;
}

/**
 * The frame around sign-in, sign-up and the password reset pair.
 *
 * **The brand side says what we stand for.** It used to be the wordmark, one
 * paragraph and a rule on 960pt of flat brown - the first screen of a product
 * about showing up for people, and it said nothing a volunteer or an NGO would
 * recognise. It now carries the voice line, and the three promises the product
 * actually keeps (`BRAND_VALUES`), on a near-flat ground with one faint wash
 * (`PanelWash`). A solid orange sun and rings were tried here and were the
 * loudest thing on the screen; the panel frames the words, nothing more.
 *
 * Desktop: the brand panel on the left, the form centred on the right, each in
 * its own scroller - a short laptop window or 125% zoom must reach both.
 *
 * Phone: a short brand hero, then the form on a sheet that overlaps it by its
 * corner radius. The hero is **inside** the scroll view, not pinned above it: a
 * pinned header plus the keyboard left about 200pt for the form on a small
 * phone, and the focused field scrolled under the header. Inside, it simply
 * scrolls away when the keyboard opens.
 */
export function AuthSplitLayout({
	children,
	alternateLink,
}: AuthSplitLayoutProps) {
	const { width } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	const { colors, spacing } = useTheme();
	const isWide = width >= BREAKPOINT;

	const alternate = alternateLink && (
		<View
			style={{
				borderTopWidth: 1,
				borderTopColor: colors.border.hairline,
				marginTop: spacing[6],
				paddingTop: spacing[5],
				alignItems: "center",
			}}
		>
			{alternateLink}
		</View>
	);

	if (isWide) {
		return (
			<View style={{ flex: 1, flexDirection: "row", ...WEB_VIEWPORT }}>
				<View
					style={{
						flex: 1.1,
						overflow: "hidden",
					}}
				>
					<PanelWash ground="ember" />
					{/* Chrome, not a reading pane: no thumb. It still scrolls,
					    so a short window can reach the values under the line. */}
					<ScrollView
						showsVerticalScrollIndicator={false}
						style={{ flex: 1 }}
						contentContainerStyle={{
							flexGrow: 1,
							justifyContent: "space-between",
							paddingHorizontal: width >= 1280 ? spacing[20] : spacing[12],
							paddingVertical: spacing[12],
							gap: spacing[12],
						}}
					>
						<BrandMark />

						<View style={{ maxWidth: 520 }}>
							<Display color={colors.brand.ink} accessibilityRole="header">
								Help that{"\n"}
								<Display color={colors.primary.main}>shows up.</Display>
							</Display>
							<Body
								color={panelInk.muted}
								style={{ maxWidth: 420, marginTop: spacing[5] }}
							>
								Nabhya connects verified NGOs with the people nearby who give
								their time, their things and their money.
							</Body>
						</View>

						<View style={{ maxWidth: 440 }}>
							<BrandValues />
							<Caption
								color={panelInk.faint}
								style={{
									paddingTop: spacing[4],
									borderTopWidth: 1,
									borderTopColor: panelInk.border,
								}}
							>
								For volunteers and NGOs across India
							</Caption>
						</View>
					</ScrollView>
				</View>

				{/*
				 * A scroller, not a centred box. The form column was a plain
				 * `View` - the desktop branch with no scroll container that
				 * AGENTS.md warns about - so sign-up with its error block and the
				 * Google button, in a 700pt laptop window or at 125% zoom, ran
				 * off the bottom with no way to reach Create account. `flexGrow`
				 * keeps it centred whenever it does fit.
				 */}
				<ScrollView
					style={{ flex: 1, backgroundColor: colors.background.warm }}
					contentContainerStyle={{
						flexGrow: 1,
						justifyContent: "center",
						alignItems: "center",
						padding: spacing[12],
					}}
					keyboardShouldPersistTaps="handled"
					{...verticalScrollbar}
				>
					<View style={{ width: "100%", maxWidth: 400 }}>
						{children}
						{alternate}
					</View>
				</ScrollView>
			</View>
		);
	}

	return (
		<View style={{ flex: 1, backgroundColor: panelGrounds.ember.ground }}>
			{/* The hero is dark in both schemes, so the clock and battery over
			    it must be light whatever the theme says. */}
			<StatusBar style="light" />
			{/*
			 * `automaticallyAdjustKeyboardInsets` insets the scroll view by the
			 * keyboard on iOS (Android resizes the window instead - see
			 * android.softwareKeyboardLayoutMode in app.json).
			 */}
			<KeyboardAvoidingView
				style={{ flex: 1 }}
				behavior={Platform.OS === "ios" ? "padding" : undefined}
			>
				<ScrollView
					style={{ flex: 1 }}
					contentContainerStyle={{ flexGrow: 1 }}
					keyboardShouldPersistTaps="handled"
					automaticallyAdjustKeyboardInsets
					{...verticalScrollbar}
				>
					<View
						style={{
							overflow: "hidden",
							paddingTop: insets.top + spacing[5],
							paddingHorizontal: spacing[5],
							// Room for the sheet's overlap plus a breath above it.
							paddingBottom: spacing[12],
						}}
					>
						<PanelWash ground="ember" />
						<BrandMark />
						<Display
							size="md"
							color={colors.brand.ink}
							accessibilityRole="header"
							style={{ marginTop: spacing[7] }}
						>
							Help that{"\n"}
							<Display size="md" color={colors.primary.main}>
								shows up.
							</Display>
						</Display>
						<Caption
							color={panelInk.muted}
							style={{ marginTop: spacing[2.5], maxWidth: 300 }}
						>
							Verified NGOs, real needs, and the people who turn up for them.
						</Caption>
					</View>

					<View
						style={{
							flexGrow: 1,
							marginTop: -spacing[6],
							borderTopLeftRadius: 24,
							borderTopRightRadius: 24,
							backgroundColor: colors.background.warm,
							paddingHorizontal: spacing[5],
							paddingTop: spacing[7],
							paddingBottom: insets.bottom + spacing[6],
						}}
					>
						{children}
						{alternate}
					</View>
				</ScrollView>
			</KeyboardAvoidingView>
		</View>
	);
}
