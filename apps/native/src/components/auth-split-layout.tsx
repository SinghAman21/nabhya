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
import { Body, Caption, Wordmark } from "@/components/ui/typography";
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
 * The frame around sign-in and sign-up.
 *
 * Desktop: a dark brand panel on the left, the form centred on the right.
 * Phone: a short dark brand bar under the status bar, then the form in a scroll
 * view that keeps clear of the keyboard. The brand panel speaks to both kinds
 * of account - a volunteer and an NGO land on the same door.
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
						flex: 1,
						backgroundColor: colors.brand.surface,
						justifyContent: "center",
						padding: spacing[16],
					}}
				>
					<Wordmark color={colors.brand.ink}>NABHYA</Wordmark>
					<Body
						color={colors.brand.muted}
						style={{ maxWidth: 360, marginTop: spacing[4] }}
					>
						Verified NGOs and the volunteers who show up for them. Find what's
						needed near you, help at events, give with confidence.
					</Body>

					<View
						style={{
							height: 1,
							backgroundColor: colors.brand.rule,
							marginTop: spacing[10],
						}}
					/>

					<Caption color={colors.brand.faint} style={{ marginTop: spacing[4] }}>
						For volunteers and NGOs across India
					</Caption>
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
		<View style={{ flex: 1, backgroundColor: colors.background.warm }}>
			<View
				style={{
					backgroundColor: colors.brand.surface,
					paddingHorizontal: spacing[5],
					paddingTop: insets.top + spacing[3],
					paddingBottom: spacing[4],
				}}
			>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[2],
					}}
				>
					<View
						style={{
							width: 2,
							height: 12,
							backgroundColor: colors.primary.main,
						}}
					/>
					<Wordmark size="sm" color={colors.brand.ink}>
						NABHYA
					</Wordmark>
				</View>
			</View>

			{/*
			 * Scrollable, not a centred flex box: on a short phone the keyboard
			 * covered the password field and the submit button with no way to
			 * reach them. `flexGrow` keeps the form optically centred while
			 * there is room, and `automaticallyAdjustKeyboardInsets` insets the
			 * scroll view by the keyboard on iOS (Android resizes the window
			 * instead - see android.softwareKeyboardLayoutMode in app.json).
			 */}
			<KeyboardAvoidingView
				style={{ flex: 1 }}
				behavior={Platform.OS === "ios" ? "padding" : undefined}
			>
				<ScrollView
					style={{ flex: 1 }}
					contentContainerStyle={{
						flexGrow: 1,
						paddingHorizontal: spacing[5],
						paddingTop: spacing[8],
						paddingBottom: insets.bottom + spacing[6],
						justifyContent: "center",
					}}
					keyboardShouldPersistTaps="handled"
					automaticallyAdjustKeyboardInsets
					{...verticalScrollbar}
				>
					{children}
					{alternate}
				</ScrollView>
			</KeyboardAvoidingView>
		</View>
	);
}
