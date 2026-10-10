import { ChevronLeft } from "lucide-react-native";
import { Children, type ReactNode, useEffect, useRef } from "react";
import {
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	View,
	type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Banner } from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption, H2 } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { focusable } from "@/lib/focus";
import { verticalScrollbar } from "@/lib/scroll";

/**
 * The frame both onboarding wizards sit in - NGO and volunteer.
 *
 * Three things it fixes over what each wizard did for itself:
 *
 * **The primary action is pinned.** Continue used to be the last thing in the
 * scroll body, so on the NGO's address step (a four-line address field plus
 * four inputs) it sat below the fold on a 360dp phone: the form looked like it
 * had no way forward. It now lives in a footer bar over a hairline, which is
 * where this design system puts a primary action everywhere else
 * (`events/[id]`, `ngos/[id]`, every sheet).
 *
 * **Progress is a bar, not a rail of labelled dots.** `StepIndicator` draws a
 * numbered circle with a word under each step; at five steps the words truncate
 * to "Orga…", "Addr…" and stop being words. Here the bar carries position and a
 * single line names the step you are actually on, which is the only label
 * anyone reads. `StepIndicator` is still right for the verification screen,
 * where three stages have somewhere to put their names.
 *
 * **Desktop gets the reassurance column.** These are the highest-stakes forms
 * in the product - an NGO decides here whether we look real - and a 560pt
 * column of inputs centred in a 1440pt window says nothing about why any of it
 * is being asked. The `aside` renders beside the form on desktop and at the
 * end of the scroll body on a phone, so it is never a desktop-only reason.
 */

/**
 * Wide enough for two form fields side by side, and no wider.
 *
 * 560 was one field per row, which meant every step scrolled on a desktop with
 * two thirds of the window empty. At 720 the steps pair their fields
 * (`FieldPair`) and the review list runs two columns (`ReviewGrid`), so a step
 * fits a laptop window without scrolling - the body is still a `ScrollView`,
 * because "fits" is a default, not a guarantee: a short window, a browser zoom
 * or a step with every suggestion row open all need somewhere to go.
 */
const FORM_COLUMN = 720;
const ASIDE_COLUMN = 320;

/** Below this the aside goes back into the scroll body, as it does on a phone. */
const ASIDE_MIN_WIDTH = 1180;

/**
 * Pins the page to the viewport on the web so the flex chain down to the
 * scrolling body reaches an actual height - without it the body grows to fit
 * its content and the view above clips, which is the trap written up in
 * `AGENTS.md` → Scrolling on web. Same idiom as `(ngo)/_layout.tsx`.
 */
const WEB_VIEWPORT: ViewStyle =
	Platform.OS === "web" ? ({ height: "100dvh" } as unknown as ViewStyle) : {};

export function WizardShell({
	steps,
	step,
	title,
	lede,
	onBack,
	exit,
	error,
	aside,
	footer,
	children,
}: {
	/** Step names, in order. Used for the count and the current step's name. */
	steps: readonly string[];
	step: number;
	title: string;
	lede?: string;
	/** Omit on the first step - there is nowhere back to go. */
	onBack?: () => void;
	/** Top-right escape hatch: sign out, or leave for now. */
	exit?: ReactNode;
	/** Submit failure, shown above the form rather than in an OS dialog. */
	error?: string | null;
	aside?: ReactNode;
	/** The pinned action bar - `WizardFooter`, in every current caller. */
	footer: ReactNode;
	children: ReactNode;
}) {
	const { colors, spacing } = useTheme();
	const { isDesktop, width } = useMedia();
	const insets = useSafeAreaInsets();
	const scrollRef = useRef<ScrollView>(null);

	/*
	 * Back to the top on a new step, and when a submit fails. Every step renders
	 * into this one `ScrollView`, so it kept the last step's offset: finishing
	 * the long address step dropped you halfway down the next one, past its
	 * title. And the error `Banner` sits above the form, while the button that
	 * produced it is pinned at the bottom - a failed submit from a scrolled
	 * step put the only explanation off-screen.
	 */
	useEffect(() => {
		scrollRef.current?.scrollTo({ y: 0, animated: false });
	}, [step]);
	useEffect(() => {
		if (error) scrollRef.current?.scrollTo({ y: 0, animated: true });
	}, [error]);

	// The aside only earns its column when the window can hold both at full
	// width; below that it goes back to the end of the form, as on a phone.
	const showAside = Boolean(aside) && isDesktop && width >= ASIDE_MIN_WIDTH;

	const body = (
		<ScrollView
			ref={scrollRef}
			style={{ flex: 1 }}
			contentContainerStyle={{
				paddingHorizontal: spacing[5],
				paddingTop: spacing[1],
				paddingBottom: spacing[8],
			}}
			keyboardShouldPersistTaps="handled"
			automaticallyAdjustKeyboardInsets
			{...verticalScrollbar}
		>
			<View style={{ marginBottom: spacing[6] }}>
				<H2 accessibilityRole="header">{title}</H2>
				{lede ? (
					<Body color="tertiary" style={{ marginTop: spacing[1.5] }}>
						{lede}
					</Body>
				) : null}
			</View>

			{error ? (
				<View style={{ marginBottom: spacing[5] }}>
					<Banner tone="error" title="That didn't save" description={error} />
				</View>
			) : null}

			{children}

			{aside && !showAside ? (
				<View style={{ marginTop: spacing[8] }}>{aside}</View>
			) : null}
		</ScrollView>
	);

	const formColumn = (
		<View
			style={{
				flex: 1,
				minHeight: 0,
				...(isDesktop
					? { maxWidth: FORM_COLUMN, flexGrow: 1, flexShrink: 1 }
					: {}),
			}}
		>
			<WizardProgress
				steps={steps}
				step={step}
				onBack={onBack}
				exit={exit}
				topInset={insets.top}
			/>

			{/*
			 * iOS needs the view lifted; Android resizes the window instead
			 * (android.softwareKeyboardLayoutMode in app.json), and on web the
			 * behaviour is the browser's. Same split as `AuthSplitLayout`.
			 */}
			<KeyboardAvoidingView
				style={{ flex: 1, minHeight: 0 }}
				behavior={Platform.OS === "ios" ? "padding" : undefined}
			>
				{body}
			</KeyboardAvoidingView>

			<View
				style={{
					paddingHorizontal: spacing[5],
					paddingTop: spacing[3],
					paddingBottom: insets.bottom + spacing[3],
					borderTopWidth: 1,
					borderTopColor: colors.border.hairline,
					backgroundColor: colors.background.warm,
				}}
			>
				{footer}
			</View>
		</View>
	);

	return (
		<View
			style={{
				flex: 1,
				backgroundColor: colors.background.warm,
				...WEB_VIEWPORT,
			}}
		>
			<View
				style={{
					flex: 1,
					minHeight: 0,
					flexDirection: "row",
					justifyContent: "center",
					gap: showAside ? spacing[10] : 0,
					...(isDesktop ? { paddingHorizontal: spacing[8] } : {}),
				}}
			>
				{formColumn}

				{showAside ? (
					<ScrollView
						// A fixed-width column in a flex row must spell out its
						// grow/shrink: react-native-web gives every ScrollView
						// flexGrow: 1, which beats `width` whenever the row has room.
						style={{
							width: ASIDE_COLUMN,
							flexGrow: 0,
							flexShrink: 0,
							alignSelf: "stretch",
						}}
						contentContainerStyle={{
							paddingTop: insets.top + spacing[16],
							paddingBottom: spacing[10],
						}}
						{...verticalScrollbar}
					>
						{aside}
					</ScrollView>
				) : null}
			</View>
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Progress                                                                   */
/* -------------------------------------------------------------------------- */

function WizardProgress({
	steps,
	step,
	onBack,
	exit,
	topInset,
}: {
	steps: readonly string[];
	step: number;
	onBack?: () => void;
	exit?: ReactNode;
	topInset: number;
}) {
	const { colors, spacing } = useTheme();
	const name = steps[step] ?? "";

	return (
		<View
			style={{
				paddingHorizontal: spacing[5],
				paddingTop: topInset + spacing[2],
				paddingBottom: spacing[4],
			}}
		>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					minHeight: 40,
					marginBottom: spacing[3],
				}}
			>
				{onBack ? (
					<Pressable
						onPress={onBack}
						hitSlop={8}
						accessibilityRole="button"
						accessibilityLabel="Previous step"
						{...focusable}
						style={({ pressed }) => ({
							width: 40,
							height: 40,
							borderRadius: 999,
							alignItems: "center",
							justifyContent: "center",
							backgroundColor: pressed
								? colors.background.tertiary
								: colors.background.subtle,
						})}
					>
						<ChevronLeft
							size={24}
							strokeWidth={2.4}
							style={{ marginLeft: -2 }}
							color={colors.text.primary as string}
						/>
					</Pressable>
				) : (
					// Holds the row's height so the bar does not jump between the
					// first step and the second.
					<View style={{ width: 40, height: 40 }} />
				)}
				{exit}
			</View>

			<View
				accessible
				accessibilityRole="progressbar"
				accessibilityLabel={`Step ${step + 1} of ${steps.length}: ${name}`}
				accessibilityValue={{ min: 1, max: steps.length, now: step + 1 }}
				style={{ flexDirection: "row", gap: spacing[1.5] }}
			>
				{steps.map((label, index) => (
					<View
						key={label}
						style={{
							flex: 1,
							height: 4,
							borderRadius: 2,
							backgroundColor:
								index <= step
									? (colors.text.primary as string)
									: colors.border.medium,
						}}
					/>
				))}
			</View>

			<Caption color="tertiary" style={{ marginTop: spacing[2] }}>
				Step {step + 1} of {steps.length} · {name}
			</Caption>
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Footer                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The step's one primary action, full width. `secondary` is for the one place a
 * wizard offers a real alternative (skipping the NGO wizard to browse first),
 * drawn as a quiet full-width row under it rather than as a second button
 * competing with it.
 *
 * There is no Back here. It used to sit beside the primary action while the
 * progress row also carried a chevron, so every step after the first offered
 * two Back controls doing the same thing. The chevron stays because it is where
 * every pushed page in the app puts its way back (`ScreenHeader`).
 */
export function WizardFooter({
	primaryLabel,
	onPrimary,
	loading,
	disabled,
	note,
	secondary,
}: {
	primaryLabel: string;
	onPrimary: () => void;
	loading?: boolean;
	disabled?: boolean;
	/** Why the primary action is off, or what pressing it will do. */
	note?: string;
	secondary?: ReactNode;
}) {
	const { spacing } = useTheme();

	return (
		<View style={{ gap: spacing[2] }}>
			<Button onPress={onPrimary} loading={loading} disabled={disabled}>
				{primaryLabel}
			</Button>
			{note ? (
				<Caption
					color="quaternary"
					accessibilityLiveRegion="polite"
					style={{ textAlign: "center" }}
				>
					{note}
				</Caption>
			) : null}
			{secondary}
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Two-column helpers                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Two fields on one row - on desktop always, on a phone only when both are
 * short enough to survive half a 360dp screen (`tight`).
 *
 * Each child is given `flex: 1` here rather than at the call site, so a step
 * cannot forget it and produce two fields sized to their content.
 */
export function FieldPair({
	children,
	tight,
}: {
	children: ReactNode;
	/** Keep the pair side by side on a phone too. For short numeric fields. */
	tight?: boolean;
}) {
	const { spacing } = useTheme();
	const { isDesktop } = useMedia();
	const row = isDesktop || tight;

	if (!row) return <>{children}</>;

	return (
		<View style={{ flexDirection: "row", gap: spacing[4] }}>
			{Children.map(children, (child) => (
				<View style={{ flex: 1, minWidth: 0 }}>{child}</View>
			))}
		</View>
	);
}

/**
 * The review sections, two across on desktop.
 *
 * The NGO review is four groups of three or four rows: one column of them is
 * 900pt of list, which scrolls on any laptop. Two columns is the same
 * information at a glance, and glancing is the entire job of a review screen.
 */
export function ReviewGrid({ children }: { children: ReactNode }) {
	const { spacing } = useTheme();
	const { isDesktop } = useMedia();

	if (!isDesktop) return <>{children}</>;

	return (
		<View
			style={{
				flexDirection: "row",
				flexWrap: "wrap",
				columnGap: spacing[5],
			}}
		>
			{Children.map(children, (child) => (
				<View style={{ flexBasis: "47%", flexGrow: 1, minWidth: 280 }}>
					{child}
				</View>
			))}
		</View>
	);
}
