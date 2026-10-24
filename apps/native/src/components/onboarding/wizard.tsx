import { Check, ChevronLeft } from "lucide-react-native";
import {
	Children,
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useRef,
} from "react";
import {
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	View,
	type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandMark } from "@/components/brand";
import { WizardSurfaceContext } from "@/components/onboarding/wizard-parts";
import { PanelWash } from "@/components/panel-wash";
import { Banner } from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption, H4, Label, Title } from "@/components/ui/typography";
import { panelInk } from "@/constants/design-system";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { focusable } from "@/lib/focus";
import { verticalScrollbar } from "@/lib/scroll";

/**
 * The frame both onboarding wizards sit in - NGO and volunteer.
 *
 * **The primary action is pinned.** Continue used to be the last thing in the
 * scroll body, so on the NGO's address step (a four-line address field plus
 * four inputs) it sat below the fold on a 360dp phone: the form looked like it
 * had no way forward. It now lives in a footer bar over a hairline, which is
 * where this design system puts a primary action everywhere else
 * (`events/[id]`, `ngos/[id]`, every sheet).
 *
 * **Two shapes.** A phone (and a narrow window) gets the progress bar, the
 * back chevron, the body and a full-width Continue, with the reassurance list
 * at the end of the body so it is never a desktop-only reason.
 *
 * A wide window gets the **rail**: a deep-blue panel on the left (the sign-in
 * panel's quieter sibling - this is a working surface, not a welcome), holding every step by name with where you are in it, and the
 * "why we ask" points under them. This was wrong before: the steps were a
 * five-segment bar over a "Step 1 of 5" caption, the aside floated in a third
 * column on the page ground, and Continue was a 720pt orange bar - the
 * loudest thing on the screen was the one control that needs no explaining.
 * In the rail the steps have room for their names (a vertical list, so five
 * of them never truncate), and the footer is a row: Back on the left, Continue
 * sized to its label on the right, which is where a desktop form puts them.
 * The back chevron is dropped there, so there is still exactly one Back.
 */

/**
 * Wide enough for two form fields side by side, and no wider. At 720 the steps
 * pair their fields (`FieldPair`) and the review list runs two columns
 * (`ReviewGrid`), so a step fits a laptop window without scrolling - the body
 * is still a `ScrollView`, because "fits" is a default, not a guarantee.
 */
const FORM_COLUMN = 720;

/** The rail needs this much window to sit beside a full form column. */
const RAIL_MIN_WIDTH = 1024;

/**
 * Pins the page to the viewport on the web so the flex chain down to the
 * scrolling body reaches an actual height - without it the body grows to fit
 * its content and the view above clips, which is the trap written up in
 * `AGENTS.md` → Scrolling on web. Same idiom as `(ngo)/_layout.tsx`.
 */
const WEB_VIEWPORT: ViewStyle =
	Platform.OS === "web" ? ({ height: "100dvh" } as unknown as ViewStyle) : {};

/** Tells `WizardFooter` which shape it is drawn in, and where Back went. */
const WizardLayoutContext = createContext<{
	rail: boolean;
	onBack?: () => void;
}>({ rail: false });

export function WizardShell({
	steps,
	step,
	heading,
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
	/** What the whole wizard sets up - the rail's heading. */
	heading?: string;
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
	const rail = isDesktop && width >= RAIL_MIN_WIDTH;

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

	const intro = (
		<>
			<View style={{ marginBottom: spacing[7] }}>
				<Title accessibilityRole="header">{title}</Title>
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
		</>
	);

	if (rail) {
		const gutter = spacing[12];
		return (
			<WizardLayoutContext.Provider value={{ rail: true, onBack }}>
				<View
					style={{
						flex: 1,
						flexDirection: "row",
						backgroundColor: colors.background.warm,
						...WEB_VIEWPORT,
					}}
				>
					<View
						style={{
							width: width >= 1400 ? 400 : 340,
							flexGrow: 0,
							flexShrink: 0,
							alignSelf: "stretch",
							overflow: "hidden",
						}}
					>
						<PanelWash ground="dusk" from="top-left" />
						{/* Chrome: it scrolls for a short window, without a thumb. */}
						<ScrollView
							showsVerticalScrollIndicator={false}
							style={{ flex: 1 }}
							contentContainerStyle={{
								flexGrow: 1,
								padding: spacing[10],
							}}
						>
							<BrandMark />
							{heading ? (
								<View style={{ marginTop: spacing[12] }}>
									<Caption color={panelInk.faint}>Setting up</Caption>
									<H4 color={colors.brand.ink} style={{ marginTop: 2 }}>
										{heading}
									</H4>
								</View>
							) : null}

							<RailSteps steps={steps} step={step} />

							{aside ? (
								<View
									style={{
										marginTop: spacing[10],
										paddingTop: spacing[8],
										borderTopWidth: 1,
										borderTopColor: panelInk.border,
									}}
								>
									<WizardSurfaceContext.Provider value="brand">
										{aside}
									</WizardSurfaceContext.Provider>
								</View>
							) : null}
						</ScrollView>
					</View>

					<View style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
						<View
							style={{
								flexDirection: "row",
								alignItems: "center",
								justifyContent: "space-between",
								minHeight: 40,
								paddingHorizontal: gutter,
								paddingTop: spacing[6],
							}}
						>
							<Caption color="tertiary">
								Step {step + 1} of {steps.length}
							</Caption>
							{exit}
						</View>

						<ScrollView
							ref={scrollRef}
							style={{ flex: 1 }}
							contentContainerStyle={{
								flexGrow: 1,
								justifyContent: "center",
								paddingHorizontal: gutter,
								paddingTop: spacing[6],
								paddingBottom: spacing[10],
							}}
							keyboardShouldPersistTaps="handled"
							{...verticalScrollbar}
						>
							<View
								style={{
									width: "100%",
									maxWidth: FORM_COLUMN,
									alignSelf: "center",
								}}
							>
								{intro}
								{children}
							</View>
						</ScrollView>

						<View
							style={{
								paddingHorizontal: gutter,
								paddingVertical: spacing[4],
								borderTopWidth: 1,
								borderTopColor: colors.border.hairline,
							}}
						>
							<View
								style={{
									width: "100%",
									maxWidth: FORM_COLUMN,
									alignSelf: "center",
								}}
							>
								{footer}
							</View>
						</View>
					</View>
				</View>
			</WizardLayoutContext.Provider>
		);
	}

	return (
		<WizardLayoutContext.Provider value={{ rail: false }}>
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
						width: "100%",
						maxWidth: isDesktop ? FORM_COLUMN + spacing[10] : undefined,
						alignSelf: "center",
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
						<ScrollView
							ref={scrollRef}
							style={{ flex: 1 }}
							contentContainerStyle={{
								paddingHorizontal: spacing[5],
								paddingTop: spacing[2],
								paddingBottom: spacing[8],
							}}
							keyboardShouldPersistTaps="handled"
							automaticallyAdjustKeyboardInsets
							{...verticalScrollbar}
						>
							{intro}
							{children}
							{aside ? (
								<View
									style={{
										marginTop: spacing[8],
										paddingTop: spacing[6],
										borderTopWidth: 1,
										borderTopColor: colors.border.hairline,
									}}
								>
									{aside}
								</View>
							) : null}
						</ScrollView>
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
			</View>
		</WizardLayoutContext.Provider>
	);
}

/* -------------------------------------------------------------------------- */
/* Rail steps                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Every step by name, on the brand ground: done (a filled tick), current (a
 * ring and the name in full ink) and to come (a quiet number). Display only -
 * the review is where you jump back, and a tappable list here would let a
 * person skip a step's validation.
 */
function RailSteps({
	steps,
	step,
}: {
	steps: readonly string[];
	step: number;
}) {
	const { colors, spacing } = useTheme();

	return (
		<View
			accessible
			accessibilityRole="progressbar"
			accessibilityLabel={`Step ${step + 1} of ${steps.length}: ${steps[step] ?? ""}`}
			accessibilityValue={{ min: 1, max: steps.length, now: step + 1 }}
			style={{ marginTop: spacing[8] }}
		>
			{steps.map((label, index) => {
				const done = index < step;
				const current = index === step;
				const last = index === steps.length - 1;
				return (
					<View key={label} style={{ flexDirection: "row", gap: spacing[3.5] }}>
						<View style={{ alignItems: "center", width: 26 }}>
							<View
								style={{
									width: 26,
									height: 26,
									borderRadius: 13,
									alignItems: "center",
									justifyContent: "center",
									backgroundColor: done ? colors.primary.main : "transparent",
									borderWidth: done ? 0 : current ? 2 : 1,
									borderColor: current ? colors.primary.main : panelInk.border,
								}}
							>
								{done ? (
									<Check
										size={14}
										strokeWidth={3}
										color={colors.primary.contrast}
									/>
								) : (
									<Caption
										weight="bold"
										color={current ? colors.brand.ink : panelInk.faint}
									>
										{index + 1}
									</Caption>
								)}
							</View>
							{last ? null : (
								<View
									style={{
										width: 2,
										height: 14,
										marginVertical: 3,
										borderRadius: 1,
										backgroundColor: done
											? colors.primary.main
											: panelInk.border,
									}}
								/>
							)}
						</View>
						<Label
							weight={current ? "semibold" : "medium"}
							color={current ? colors.brand.ink : panelInk.muted}
							style={{ marginTop: 3 }}
						>
							{label}
						</Label>
					</View>
				);
			})}
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Progress (phone)                                                           */
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
					// The mark holds the row's height on the first step, so the bar
					// does not jump on the second - and the first screen of setup
					// says whose app this is.
					<View style={{ height: 40, justifyContent: "center" }}>
						<BrandMark onDark={false} />
					</View>
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
							// The brand fill: a bar is a fill, never ink, so the
							// 2.53:1 rule does not apply - and done reads as progress
							// rather than as one more grey rule.
							backgroundColor:
								index <= step ? colors.primary.main : colors.border.medium,
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
 * The step's one primary action. On a phone it is full width, with Back left
 * to the chevron above. In the rail layout it is a row - Back on the left,
 * Continue sized to its label on the right - because a 720pt-wide orange bar
 * on a desktop reads as a banner, not a button, and the chevron is gone there.
 *
 * `note` says why the action is off or what it will do. `secondary` is for the
 * one place a wizard offers a real alternative, drawn quieter than the action.
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
	const { rail, onBack } = useContext(WizardLayoutContext);

	const noteText = note ? (
		<Caption
			color="quaternary"
			accessibilityLiveRegion="polite"
			style={{ textAlign: rail ? "right" : "center" }}
		>
			{note}
		</Caption>
	) : null;

	if (rail) {
		return (
			<View
				style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}
			>
				{onBack ? (
					<Button variant="outline" onPress={onBack} disabled={loading}>
						Back
					</Button>
				) : null}
				<View style={{ flex: 1, minWidth: 0 }}>{noteText}</View>
				{secondary}
				<Button
					onPress={onPrimary}
					loading={loading}
					disabled={disabled}
					style={{ minWidth: 200 }}
				>
					{primaryLabel}
				</Button>
			</View>
		);
	}

	return (
		<View style={{ gap: spacing[2] }}>
			<Button onPress={onPrimary} loading={loading} disabled={disabled}>
				{primaryLabel}
			</Button>
			{noteText}
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
