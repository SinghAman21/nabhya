import {
	CircleAlert,
	CircleCheck,
	Info,
	type LucideIcon,
	X,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption, H4, Label } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { focusable } from "@/lib/focus";

/**
 * Transient feedback and confirmations, as app furniture rather than OS chrome.
 *
 * ## Why this replaced `Alert.alert`
 *
 * Roughly thirty call sites reported a failed mutation with
 * `Alert.alert("Could not delete", ...)`. That is the wrong shape twice over:
 *
 * - **It blocks.** A report of what just failed does not need to stop the app;
 *   it needs to be readable while the person retries. A modal you dismiss to
 *   get back to the row you were acting on is a step of work, not information.
 * - **On the web it is browser chrome, or nothing at all.** react-native-web
 *   ships `Alert` as `static alert() {}` - an empty function - so every dialog
 *   was a silent no-op there until `lib/alert.ts` mapped it onto
 *   `window.alert` / `window.confirm`. Those work, but they draw the
 *   *browser's* dialog: the origin in the title bar, the browser's own button
 *   labels, none of the app's type or colour. On the NGO and admin consoles,
 *   which are web-first, that was the most-seen surface in the product wearing
 *   none of its design. `lib/alert.ts` is deleted; this is its replacement.
 *
 * So: transient reports become a **toast**, and a destructive action's
 * "are you sure" becomes a **confirm dialog** the app draws itself.
 *
 * ## Imperative on purpose
 *
 * `toast.error(...)` and `await confirm({...})` are plain function calls, not
 * hooks, because nearly every caller is a TanStack Query `onError`/`onSuccess`
 * callback or an event handler -- places where a hook cannot be called and
 * threading per-screen state through would mean a `useState` pair on every one
 * of the thirty screens. The state lives in this module and `OverlayHost`
 * subscribes to it.
 *
 * ## The host stack, and why there is more than one host
 *
 * A `Sheet` is a real `Modal` on both platforms (RN's on native, RNW's at
 * `zIndex: 9999` on web). An overlay rendered in the root layout therefore sits
 * **underneath** any open sheet -- and a good half of these call sites are
 * inside one (`applicants-sheet`, `pledges-sheet`, the admin detail sheets). So
 * every host registers itself on mount and only the **top** of the stack
 * renders: the sheet mounts its own host while it is open and wins, and the
 * root host resumes when it closes. That is also why the confirm dialog is an
 * absolutely-positioned overlay rather than another `Modal` -- nesting modals
 * to confirm an action taken inside a sheet is exactly the fragile arrangement
 * the portal note at the top of `sheet.tsx` is about.
 */

/* -- Toasts --------------------------------------------------------------- */

export type ToastTone = "success" | "error" | "info";

export interface ToastAction {
	label: string;
	onPress: () => void;
}

interface ToastRecord {
	id: number;
	tone: ToastTone;
	message: string;
	action?: ToastAction;
}

/** How long each tone stays up. An error needs longer than a confirmation. */
const TOAST_MS: Record<ToastTone, number> = {
	success: 3200,
	info: 4000,
	error: 6000,
};

/** Three at once is already a wall of text; older ones drop off the top. */
const MAX_TOASTS = 3;

let toasts: ToastRecord[] = [];
let nextId = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

/* -- Confirmation --------------------------------------------------------- */

export interface ConfirmOptions {
	title: string;
	message?: string;
	/** Defaults to "Confirm". */
	confirmLabel?: string;
	/** Defaults to "Cancel". */
	cancelLabel?: string;
	/**
	 * Draws the action in the error tone. Defaults to true -- nearly every
	 * caller is a delete, a removal or a withdrawal.
	 */
	destructive?: boolean;
}

interface ConfirmRecord extends ConfirmOptions {
	resolve: (confirmed: boolean) => void;
}

let pendingConfirm: ConfirmRecord | null = null;

/* -- The store ------------------------------------------------------------ */

const listeners = new Set<() => void>();

/**
 * One snapshot object for both slices, cached, so `useSyncExternalStore` sees a
 * stable reference between notifications -- returning a fresh object on every
 * read makes React re-render forever.
 */
let snapshot: { toasts: ToastRecord[]; confirm: ConfirmRecord | null } = {
	toasts,
	confirm: null,
};

function publish() {
	snapshot = { toasts, confirm: pendingConfirm };
	for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

function getSnapshot() {
	return snapshot;
}

function dismissToast(id: number) {
	const timer = timers.get(id);
	if (timer) {
		clearTimeout(timer);
		timers.delete(id);
	}
	toasts = toasts.filter((item) => item.id !== id);
	publish();
}

function push(tone: ToastTone, message: string, action?: ToastAction) {
	const trimmed = message?.trim();
	if (!trimmed) return;

	const id = nextId++;
	toasts = [
		...toasts,
		{ id, tone, message: trimmed, ...(action ? { action } : {}) },
	].slice(-MAX_TOASTS);
	timers.set(
		id,
		setTimeout(() => dismissToast(id), TOAST_MS[tone]),
	);
	publish();
}

export const toast = {
	success: (message: string, action?: ToastAction) =>
		push("success", message, action),
	error: (message: string, action?: ToastAction) =>
		push("error", message, action),
	info: (message: string, action?: ToastAction) =>
		push("info", message, action),
};

/**
 * Ask before doing something that cannot be undone.
 *
 * Resolves `true` if the person confirmed. A second call while one is open
 * cancels the first rather than queueing, because two stacked confirmations can
 * only be the result of a double tap.
 */
export function confirm(options: ConfirmOptions): Promise<boolean> {
	pendingConfirm?.resolve(false);
	return new Promise<boolean>((resolve) => {
		pendingConfirm = { ...options, resolve };
		publish();
	});
}

function settleConfirm(confirmed: boolean) {
	const record = pendingConfirm;
	pendingConfirm = null;
	publish();
	record?.resolve(confirmed);
}

/* -- Host arbitration ----------------------------------------------------- */

let hostStack: number[] = [];
let nextHostId = 1;
const hostListeners = new Set<() => void>();

function publishHosts() {
	for (const listener of hostListeners) listener();
}

function subscribeHosts(listener: () => void) {
	hostListeners.add(listener);
	return () => {
		hostListeners.delete(listener);
	};
}

function topHost() {
	return hostStack[hostStack.length - 1] ?? 0;
}

function useIsTopHost() {
	const idRef = useRef(0);
	if (idRef.current === 0) idRef.current = nextHostId++;

	useEffect(() => {
		const id = idRef.current;
		hostStack = [...hostStack, id];
		publishHosts();
		return () => {
			hostStack = hostStack.filter((entry) => entry !== id);
			publishHosts();
		};
	}, []);

	const top = useSyncExternalStore(subscribeHosts, topHost, topHost);
	return top === idRef.current;
}

/* -- The host ------------------------------------------------------------- */

const TONE_ICON: Record<ToastTone, LucideIcon> = {
	success: CircleCheck,
	error: CircleAlert,
	info: Info,
};

/**
 * Renders the toasts and the confirm dialog. Mounted once in the root layout
 * and again inside every open `Sheet`; only the topmost one draws -- see the
 * note on the host stack above.
 */
export function OverlayHost() {
	const isTop = useIsTopHost();
	const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

	if (!isTop) return null;

	return (
		<>
			<ToastStack toasts={state.toasts} />
			{state.confirm ? <ConfirmDialog record={state.confirm} /> : null}
		</>
	);
}

function ToastStack({ toasts: items }: { toasts: ToastRecord[] }) {
	const { spacing } = useTheme();
	const { isDesktop } = useMedia();
	const insets = useSafeAreaInsets();

	if (items.length === 0) return null;

	return (
		<View
			// `box-none` so the gap between toasts stays tappable -- a toast sits
			// over content a person may be trying to reach.
			pointerEvents="box-none"
			style={{
				position: "absolute",
				left: 0,
				right: 0,
				bottom: insets.bottom + spacing[4],
				alignItems: isDesktop ? "flex-end" : "center",
				paddingHorizontal: spacing[4],
				gap: spacing[2],
			}}
		>
			{items.map((item) => (
				<ToastRow key={item.id} toast={item} />
			))}
		</View>
	);
}

function ToastRow({ toast: item }: { toast: ToastRecord }) {
	const { colors, spacing, borderRadius } = useTheme();
	const Icon = TONE_ICON[item.tone];
	const ink = (
		item.tone === "error"
			? colors.error.ink
			: item.tone === "success"
				? colors.success.ink
				: colors.info.ink
	) as string;

	return (
		<View
			accessibilityLiveRegion="polite"
			style={{
				flexDirection: "row",
				alignItems: "flex-start",
				gap: spacing[2.5],
				width: "100%",
				maxWidth: 460,
				paddingVertical: spacing[3],
				paddingLeft: spacing[3.5],
				paddingRight: spacing[2],
				borderRadius: borderRadius.lg,
				borderWidth: 1,
				borderColor: colors.border.hairline,
				backgroundColor: colors.background.card,
				// A toast floats over content, so it needs a shadow to read as
				// above it rather than as a stray card in the page.
				shadowColor: "#000",
				shadowOpacity: 0.16,
				shadowRadius: 16,
				shadowOffset: { width: 0, height: 6 },
				elevation: 6,
			}}
		>
			<Icon size={17} color={ink} strokeWidth={2.2} style={{ marginTop: 1 }} />
			<Body style={{ flex: 1 }}>{item.message}</Body>

			{item.action ? (
				<Pressable
					onPress={() => {
						dismissToast(item.id);
						item.action?.onPress();
					}}
					hitSlop={6}
					accessibilityRole="button"
					{...focusable}
					style={{
						minHeight: 32,
						justifyContent: "center",
						paddingHorizontal: spacing[2],
					}}
				>
					<Label weight="semibold" color={colors.primary.ink}>
						{item.action.label}
					</Label>
				</Pressable>
			) : null}

			<Pressable
				onPress={() => dismissToast(item.id)}
				hitSlop={8}
				accessibilityRole="button"
				accessibilityLabel="Dismiss"
				{...focusable}
				style={{
					width: 32,
					height: 32,
					alignItems: "center",
					justifyContent: "center",
					borderRadius: 999,
				}}
			>
				<X size={15} color={colors.text.quaternary as string} />
			</Pressable>
		</View>
	);
}

function ConfirmDialog({ record }: { record: ConfirmRecord }) {
	const { colors, spacing, borderRadius } = useTheme();
	const destructive = record.destructive !== false;

	const cancel = useCallback(() => settleConfirm(false), []);

	// Escape closes it on the web, where a dialog with no keyboard exit is a
	// trap for anyone not using a mouse.
	useEffect(() => {
		if (Platform.OS !== "web" || typeof window === "undefined") return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") cancel();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [cancel]);

	return (
		<View
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				alignItems: "center",
				justifyContent: "center",
				padding: spacing[5],
				backgroundColor: "rgba(0,0,0,0.45)",
			}}
		>
			{/* The scrim dismisses, matching every sheet in the app. */}
			<Pressable
				onPress={cancel}
				accessibilityRole="button"
				accessibilityLabel="Cancel"
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
				}}
			/>

			<View
				accessibilityViewIsModal
				style={{
					width: "100%",
					maxWidth: 420,
					padding: spacing[5],
					gap: spacing[4],
					borderRadius: borderRadius["2xl"],
					backgroundColor: colors.background.card,
					borderWidth: 1,
					borderColor: colors.border.hairline,
					shadowColor: "#000",
					shadowOpacity: 0.2,
					shadowRadius: 24,
					shadowOffset: { width: 0, height: 10 },
					elevation: 12,
				}}
			>
				<View style={{ gap: spacing[1.5] }}>
					<H4>{record.title}</H4>
					{record.message ? (
						<Caption color="secondary">{record.message}</Caption>
					) : null}
				</View>

				{/* Cancel first, action second: the action is the rightmost and
				    heaviest thing, which is where a thumb and a cursor both end
				    up, and the row reads in the order the decision is made. */}
				<View style={{ flexDirection: "row", gap: spacing[3] }}>
					<Button
						variant="outline"
						onPress={cancel}
						style={{ flex: 1 }}
						accessibilityLabel={record.cancelLabel ?? "Cancel"}
					>
						{record.cancelLabel ?? "Cancel"}
					</Button>
					<Button
						variant={destructive ? "destructive" : "default"}
						onPress={() => settleConfirm(true)}
						style={{ flex: 1 }}
						accessibilityLabel={record.confirmLabel ?? "Confirm"}
					>
						{record.confirmLabel ?? "Confirm"}
					</Button>
				</View>
			</View>
		</View>
	);
}
