import { Check, ChevronDown } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { Caption, Label } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { focusable, type PressState } from "@/lib/focus";

/**
 * A labelled pick-one control: the filter and sort primitive for the console.
 *
 * **Why not `ui/select.tsx` or `ui/dropdown-menu.tsx`.** Both are
 * `@rn-primitives` and both render through a portal, which this repo has
 * already established cannot be positioned reliably - see the long note at the
 * top of `ui/sheet.tsx`. This one draws its panel as an absolutely positioned
 * sibling inside its own wrapper, the same trick `ui/tooltip.tsx` uses, so it
 * works on a page, inside a sheet, and inside the drawer alike.
 *
 * **Why not more chips.** A chip row is right for two to five peers a reader
 * flicks between; it is wrong as a filter *bar*. The console's screens had two
 * stacked rows of eleven chips between the title and the first row of data,
 * which spends the top of every page saying what could be filtered rather than
 * showing what was. A closed select says the current value in one line and
 * gives the rest of the page back - and it scales: the audit log's entity list
 * and a city filter cannot be chips at all.
 *
 * The trigger always shows **label and value** ("Status · Pending"), never a
 * bare value: five adjacent pills reading "Pending", "Volunteers", "Newest"
 * are unreadable as a set without their nouns.
 */
export interface SelectOption<T extends string> {
	value: T;
	label: string;
	/** A second line in the open panel - what the option actually filters to. */
	hint?: string;
}

export function SelectMenu<T extends string>({
	label,
	value,
	options,
	onChange,
	align = "start",
	minWidth = 200,
}: {
	/** The noun. Shown on the trigger before the value, and as the a11y label. */
	label: string;
	value: T;
	options: Array<SelectOption<T>>;
	onChange: (value: T) => void;
	/** `end` opens the panel right-aligned, for a control near the right edge. */
	align?: "start" | "end";
	minWidth?: number;
}) {
	const { colors, spacing, borderRadius, elevation, isDark } = useTheme();
	const [open, setOpen] = useState(false);
	const wrapper = useRef<View>(null);

	const active = options.find((option) => option.value === value);

	// Escape closes, and a click anywhere else closes. Both are document-level
	// on the web and neither exists on native, where the panel is dismissed by
	// picking something or tapping the trigger again.
	useEffect(() => {
		if (Platform.OS !== "web" || !open) return;

		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false);
		};
		// Capture phase: the trigger's own press handler runs on bubble, so a
		// bubble-phase listener here would close the panel and let the trigger
		// immediately reopen it.
		const onPointerDown = (event: Event) => {
			const node = wrapper.current as unknown as HTMLElement | null;
			if (node && event.target instanceof Node && node.contains(event.target)) {
				return;
			}
			setOpen(false);
		};

		document.addEventListener("keydown", onKey);
		document.addEventListener("pointerdown", onPointerDown, true);
		return () => {
			document.removeEventListener("keydown", onKey);
			document.removeEventListener("pointerdown", onPointerDown, true);
		};
	}, [open]);

	return (
		<View ref={wrapper} style={{ position: "relative" }}>
			<Pressable
				onPress={() => setOpen((previous) => !previous)}
				accessibilityRole="button"
				accessibilityLabel={`${label}: ${active?.label ?? "any"}`}
				accessibilityState={{ expanded: open }}
				{...focusable}
				style={(state) => {
					const { pressed, hovered } = state as PressState;
					return {
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[2],
						height: 36,
						paddingHorizontal: spacing[3],
						borderRadius: borderRadius.md,
						borderWidth: 1,
						borderColor: open ? colors.border.dark : colors.border.medium,
						backgroundColor:
							pressed || hovered || open
								? colors.background.subtle
								: "transparent",
					};
				}}
			>
				<Caption color="quaternary">{label}</Caption>
				<Caption weight="medium" numberOfLines={1}>
					{active?.label ?? "Any"}
				</Caption>
				<ChevronDown
					size={13}
					color={colors.text.quaternary as string}
					strokeWidth={2}
				/>
			</Pressable>

			{open && (
				<View
					accessibilityRole="menu"
					style={{
						position: "absolute",
						top: 40,
						...(align === "end" ? { right: 0 } : { left: 0 }),
						minWidth,
						zIndex: 40,
						paddingVertical: spacing[1],
						borderRadius: borderRadius.lg,
						backgroundColor: colors.background.card,
						borderWidth: isDark ? 1 : 0,
						borderColor: colors.border.hairline,
						...elevation.card,
					}}
				>
					{options.map((option) => {
						const selected = option.value === value;
						return (
							<Pressable
								key={option.value}
								onPress={() => {
									onChange(option.value);
									setOpen(false);
								}}
								accessibilityRole="menuitem"
								accessibilityState={{ selected }}
								{...focusable}
								style={(state) => {
									const { pressed, hovered } = state as PressState;
									return {
										flexDirection: "row",
										alignItems: "center",
										gap: spacing[2.5],
										minHeight: 36,
										paddingHorizontal: spacing[3],
										paddingVertical: spacing[1.5],
										backgroundColor:
											pressed || hovered
												? colors.background.subtle
												: "transparent",
									};
								}}
							>
								{/* A fixed 14pt gutter, so the labels do not shift by a tick
								    width as the selection moves down the list. */}
								<View style={{ width: 14 }}>
									{selected && (
										<Check
											size={14}
											color={colors.primary.ink}
											strokeWidth={2.5}
										/>
									)}
								</View>
								<View style={{ flex: 1, minWidth: 0 }}>
									<Label weight={selected ? "semibold" : "normal"}>
										{option.label}
									</Label>
									{option.hint && (
										<Caption color="quaternary" numberOfLines={1}>
											{option.hint}
										</Caption>
									)}
								</View>
							</Pressable>
						);
					})}
				</View>
			)}
		</View>
	);
}
