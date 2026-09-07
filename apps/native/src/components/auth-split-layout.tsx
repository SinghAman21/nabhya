import type { ReactNode } from "react";
import {
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	useWindowDimensions,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Body, Caption, H1, Label } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { verticalScrollbar } from "@/lib/scroll";

const BREAKPOINT = 768;
const BRAND_BG = "#0A0A0A";

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
 * of account — a volunteer and an NGO land on the same door.
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
			<View style={{ flex: 1, flexDirection: "row" }}>
				<View
					style={{
						flex: 1,
						backgroundColor: BRAND_BG,
						justifyContent: "center",
						padding: spacing[16],
					}}
				>
					<H1 color="#FFFFFF" style={{ letterSpacing: 3 }}>
						NABHYA
					</H1>
					<Body
						color="#A3A3A3"
						style={{ maxWidth: 360, marginTop: spacing[4] }}
					>
						Verified NGOs and the volunteers who show up for them. Find what's
						needed near you, help at events, give with confidence.
					</Body>

					<View
						style={{
							height: 1,
							backgroundColor: "#222222",
							marginTop: spacing[10],
						}}
					/>

					<Caption color="#8F8F8F" style={{ marginTop: spacing[4] }}>
						For volunteers and NGOs across India
					</Caption>
				</View>

				<View
					style={{
						flex: 1,
						backgroundColor: colors.background.warm,
						justifyContent: "center",
						alignItems: "center",
						padding: spacing[12],
					}}
				>
					<View style={{ width: "100%", maxWidth: 400 }}>
						{children}
						{alternate}
					</View>
				</View>
			</View>
		);
	}

	return (
		<View style={{ flex: 1, backgroundColor: colors.background.warm }}>
			<View
				style={{
					backgroundColor: BRAND_BG,
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
					<Label weight="bold" color="#FFFFFF" style={{ letterSpacing: 2 }}>
						NABHYA
					</Label>
				</View>
			</View>

			{/*
			 * Scrollable, not a centred flex box: on a short phone the keyboard
			 * covered the password field and the submit button with no way to
			 * reach them. `flexGrow` keeps the form optically centred while
			 * there is room, and `automaticallyAdjustKeyboardInsets` insets the
			 * scroll view by the keyboard on iOS (Android resizes the window
			 * instead — see android.softwareKeyboardLayoutMode in app.json).
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
