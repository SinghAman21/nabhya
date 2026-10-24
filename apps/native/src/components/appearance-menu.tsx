import {
	Check,
	type LucideIcon,
	Moon,
	Sun,
	SunMoon,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, View, type ViewStyle } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { Sheet, SheetOption } from "@/components/ui/sheet";
import { Body } from "@/components/ui/typography";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { focusable, type PressState } from "@/lib/focus";

/* -------------------------------------------------------------------------- */
/* The choice                                                                 */
/* -------------------------------------------------------------------------- */

export type AppearancePreference = ReturnType<typeof useAppTheme>["preference"];

export const APPEARANCE_LABEL: Record<AppearancePreference, string> = {
	system: "System",
	light: "Light",
	dark: "Dark",
};

const APPEARANCE_HINT: Record<AppearancePreference, string> = {
	system: "Follows the device setting",
	light: "Always light",
	dark: "Always dark",
};

const ORDER: AppearancePreference[] = ["system", "light", "dark"];

/** The icon that stands for a choice - the current one, for icon-only placements. */
export function appearanceIcon(preference: AppearancePreference): LucideIcon {
	if (preference === "light") return Sun;
	if (preference === "dark") return Moon;
	return SunMoon;
}

/** Pick-one sheet, for phones. Owns nothing but its visibility. */
export function AppearanceSheet({
	visible,
	onClose,
}: {
	visible: boolean;
	onClose: () => void;
}) {
	const { spacing } = useTheme();
	const { preference, setColorScheme } = useAppTheme();

	return (
		<Sheet
			visible={visible}
			onClose={onClose}
			title="Appearance"
			subtitle="System follows your device's setting."
		>
			<View style={{ paddingBottom: spacing[2] }}>
				{ORDER.map((option) => (
					<SheetOption
						key={option}
						label={APPEARANCE_LABEL[option]}
						hint={APPEARANCE_HINT[option]}
						selected={preference === option}
						onPress={() => {
							setColorScheme(option);
							onClose();
						}}
					/>
				))}
			</View>
		</Sheet>
	);
}

/* -------------------------------------------------------------------------- */
/* The menu                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Appearance as a small menu anchored to its trigger, on desktop.
 *
 * It was the phone's sheet everywhere, which on a desktop is a centred
 * dialog: a scrim over the whole window and a 480pt panel to pick one of three
 * words, opened from a row in the corner of the rail. A choice this small
 * belongs next to the control that asked for it.
 *
 * **It does not portal.** Same reasoning as `ui/tooltip.tsx` and
 * `admin/select-menu.tsx` - see the note at the top of `ui/sheet.tsx`. The
 * panel is `position: fixed` at coordinates measured from the trigger, which
 * escapes the rail's `overflow: hidden` (the collapsed rail is 68pt wide) and
 * any scroll container without leaving the React tree. That holds as long as
 * no ancestor has a `transform`, which would become the containing block for
 * `fixed` - the desktop rail and the top bar have none.
 *
 * Closes on an outside press (a transparent fixed scrim, not a tab stop),
 * Escape (focus returns to the trigger), Tab, picking an option, and a window
 * resize. Arrow keys move between the three options; focus starts on the
 * current one.
 *
 * **Phones get the sheet** (`AppearanceSheet`) - the same trigger, so callers
 * write one thing. On native there is no fixed positioning and no pointer, and
 * a bottom sheet is the platform's own pick-one.
 */

export type AppearanceMenuPlacement =
	/** Above the trigger, left edges aligned - a row in the rail's footer. */
	| "top-start"
	/** Above the trigger, right edges aligned - a settings row in a page. */
	| "top-end"
	/** Right of the trigger, bottom edges aligned - the collapsed rail. */
	| "right-end"
	/** Below the trigger, right edges aligned - a top-bar account menu. */
	| "bottom-end"
	/** Left of the trigger, top edges aligned - a row inside a right-hand dropdown. */
	| "left-start";

const MENU_MIN_WIDTH = 200;
const GAP = 6;
const EDGE = 8;

export interface AppearanceTriggerState {
	open: boolean;
	toggle: () => void;
}

export function AppearanceMenu({
	children,
	placement = "top-start",
	matchWidth = false,
	onPicked,
}: {
	/** Renders the trigger. Give it `accessibilityState={{ expanded: open }}`. */
	children: (state: AppearanceTriggerState) => React.ReactNode;
	placement?: AppearanceMenuPlacement;
	/** Make the menu as wide as the trigger (a full-width rail row). */
	matchWidth?: boolean;
	/** After a choice is made - e.g. to close the dropdown the trigger sits in. */
	onPicked?: () => void;
}) {
	const { isDesktop } = useMedia();
	const [open, setOpen] = useState(false);
	const anchorRef = useRef<View>(null);
	const [frame, setFrame] = useState<ViewStyle | null>(null);

	const anchored = Platform.OS === "web" && isDesktop;

	const close = useCallback((restoreFocus: boolean) => {
		setOpen(false);
		setFrame(null);
		if (restoreFocus && Platform.OS === "web") {
			const anchor = anchorRef.current as unknown as HTMLElement | null;
			anchor
				?.querySelector<HTMLElement>("[tabindex], button, a, [role='button']")
				?.focus?.();
		}
	}, []);

	const toggle = useCallback(() => {
		if (open) {
			close(false);
			return;
		}
		if (anchored) {
			const anchor = anchorRef.current as unknown as HTMLElement | null;
			const rect = anchor?.getBoundingClientRect?.();
			if (rect) setFrame(position(rect, placement, matchWidth));
		}
		setOpen(true);
	}, [open, anchored, placement, matchWidth, close]);

	const picked = useCallback(() => {
		close(true);
		onPicked?.();
	}, [close, onPicked]);

	return (
		// RNW gives every View `zIndex: 0`, so each is its own stacking context
		// and the panel's own z-index only orders it inside this wrapper. The
		// wrapper is lifted while open so the panel clears its later siblings -
		// the same trick as `admin/select-menu.tsx`. Prefer a `top-*` placement
		// in page content: what sits *above* a trigger is earlier in the DOM and
		// paints under the panel; a card *below* it can still paint over.
		<View
			ref={anchorRef}
			collapsable={false}
			style={{ position: "relative", zIndex: open ? 50 : 0 }}
		>
			{children({ open, toggle })}
			{anchored ? (
				open && frame ? (
					<MenuPanel frame={frame} onClose={close} onPicked={picked} />
				) : null
			) : (
				<AppearanceSheet
					visible={open}
					onClose={() => {
						setOpen(false);
						onPicked?.();
					}}
				/>
			)}
		</View>
	);
}

/** Fixed coordinates for the panel, kept inside the viewport. */
function position(
	rect: DOMRect,
	placement: AppearanceMenuPlacement,
	matchWidth: boolean,
): ViewStyle {
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	const width = Math.max(MENU_MIN_WIDTH, matchWidth ? rect.width : 0);
	const clampLeft = (left: number) =>
		Math.min(Math.max(EDGE, left), vw - width - EDGE);

	switch (placement) {
		case "right-end":
			return {
				width,
				left: clampLeft(rect.right + GAP + 2),
				bottom: Math.max(EDGE, vh - rect.bottom),
			};
		case "bottom-end":
			return {
				width,
				left: clampLeft(rect.right - width),
				top: Math.min(rect.bottom + GAP, vh - EDGE - 160),
			};
		case "top-end":
			return {
				width,
				left: clampLeft(rect.right - width),
				bottom: Math.max(EDGE, vh - rect.top + GAP),
			};
		case "left-start":
			return {
				width,
				left: clampLeft(rect.left - width - GAP),
				top: Math.min(Math.max(EDGE, rect.top), vh - EDGE - 160),
			};
		default:
			return {
				width,
				left: clampLeft(rect.left),
				bottom: Math.max(EDGE, vh - rect.top + GAP),
			};
	}
}

const FIXED = { position: "fixed" } as unknown as ViewStyle;

function MenuPanel({
	frame,
	onClose,
	onPicked,
}: {
	frame: ViewStyle;
	onClose: (restoreFocus: boolean) => void;
	onPicked: () => void;
}) {
	const { colors, spacing, borderRadius, isDark } = useTheme();
	const panelRef = useRef<View>(null);

	const items = useCallback(() => {
		const panel = panelRef.current as unknown as HTMLElement | null;
		return Array.from(
			panel?.querySelectorAll<HTMLElement>("[data-appearance-option]") ?? [],
		);
	}, []);

	// Focus the current choice on open, so Enter keeps it and the arrows start
	// from where the reader is.
	useEffect(() => {
		const all = items();
		const current =
			all.find((node) => node.getAttribute("aria-checked") === "true") ??
			all[0];
		current?.focus?.();
	}, [items]);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			const all = items();
			const at = all.indexOf(document.activeElement as HTMLElement);
			if (event.key === "Escape") {
				// Capture phase, stopped here: the account dropdown this may sit in
				// closes on Escape too, and one press should close one thing.
				event.preventDefault();
				event.stopPropagation();
				onClose(true);
			} else if (event.key === "Tab") {
				onClose(false);
			} else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
				event.preventDefault();
				const step = event.key === "ArrowDown" ? 1 : -1;
				const next = (at + step + all.length) % all.length;
				all[next]?.focus?.();
			} else if (event.key === "Home" || event.key === "End") {
				event.preventDefault();
				all[event.key === "Home" ? 0 : all.length - 1]?.focus?.();
			}
		};
		const onResize = () => onClose(false);
		window.addEventListener("keydown", onKey, true);
		window.addEventListener("resize", onResize);
		return () => {
			window.removeEventListener("keydown", onKey, true);
			window.removeEventListener("resize", onResize);
		};
	}, [items, onClose]);

	const surface: ViewStyle = isDark
		? {
				backgroundColor: colors.background.tertiary,
				borderColor: colors.border.medium,
			}
		: ({
				backgroundColor: colors.background.card,
				borderColor: colors.border.hairline,
				boxShadow:
					"0 1px 2px rgba(11,11,15,0.06), 0 8px 24px rgba(11,11,15,0.12)",
			} as ViewStyle);

	return (
		<>
			{/* Outside press closes. Transparent, and not a tab stop - Escape
			    and Tab cover the keyboard. */}
			<Pressable
				onPress={() => onClose(false)}
				accessibilityLabel="Close appearance menu"
				focusable={false}
				style={{
					...FIXED,
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					zIndex: 1000,
					...({ cursor: "default" } as object),
				}}
			/>
			<View
				ref={panelRef}
				role="menu"
				aria-label="Appearance"
				style={{
					...FIXED,
					...frame,
					zIndex: 1001,
					padding: spacing[1],
					borderRadius: borderRadius.lg,
					borderWidth: 1,
					...surface,
				}}
			>
				<AppearanceOptions onPicked={onPicked} />
			</View>
		</>
	);
}

/**
 * The three options as menu rows - icon, label, a tick on the current one.
 * Exported for a menu that wants them inline (an account dropdown) rather
 * than behind another trigger.
 */
export function AppearanceOptions({ onPicked }: { onPicked?: () => void }) {
	const { colors, spacing, borderRadius, isDark } = useTheme();
	const { preference, setColorScheme } = useAppTheme();

	return (
		<View>
			{ORDER.map((option) => {
				const Icon = appearanceIcon(option);
				const selected = preference === option;
				return (
					<Pressable
						key={option}
						onPress={() => {
							setColorScheme(option);
							onPicked?.();
						}}
						accessibilityRole="menuitem"
						accessibilityLabel={APPEARANCE_LABEL[option]}
						accessibilityState={{ checked: selected }}
						{...(Platform.OS === "web"
							? ({
									role: "menuitemradio",
									"aria-checked": selected,
									dataSet: { appearanceOption: option, focus: "ring" },
								} as object)
							: focusable)}
						style={(state) => {
							const { pressed, hovered } = state as PressState;
							return {
								flexDirection: "row",
								alignItems: "center",
								gap: spacing[2.5],
								height: 36,
								paddingHorizontal: spacing[2.5],
								borderRadius: borderRadius.md,
								backgroundColor: pressed
									? isDark
										? colors.border.dark
										: colors.background.overlay
									: hovered
										? isDark
											? colors.background.overlay
											: colors.background.subtle
										: "transparent",
							};
						}}
					>
						<Icon
							size={16}
							strokeWidth={1.9}
							color={
								(selected
									? colors.text.primary
									: colors.text.tertiary) as string
							}
						/>
						<Body
							weight={selected ? "semibold" : "normal"}
							numberOfLines={1}
							style={{ flex: 1 }}
						>
							{APPEARANCE_LABEL[option]}
						</Body>
						{selected ? (
							<Check
								size={16}
								strokeWidth={2.4}
								color={colors.text.primary as string}
							/>
						) : null}
					</Pressable>
				);
			})}
		</View>
	);
}
