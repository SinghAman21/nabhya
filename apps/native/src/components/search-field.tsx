import { Search, X } from "lucide-react-native";
import { TextInput, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { useTheme } from "@/hooks/use-theme";
import { focusable, focusWithin } from "@/lib/focus";

/**
 * The one search control: one shell holding the icon, the field and a clear
 * button, on a quiet inset fill rather than an outline.
 *
 * There were three of these - the feed's search route, the desktop top bar and
 * the admin lists - all the same 44pt well with the same icon at the same
 * weight, and all three had drifted: two different clear-button treatments,
 * two different heights, one with an `accessibilityRole="search"` and two
 * without. Nothing about "search a list of NGOs" differs from "search the
 * feed", so the shell is shared and the differences are props.
 *
 * The ring is drawn on the shell via `focusWithin`, not on the bare input -
 * see the focus note in `src/global.css`.
 */
export function SearchField({
	value,
	onChange,
	onSubmit,
	placeholder,
	pending,
	autoFocus,
	autoCapitalize = "none",
	maxWidth,
	compact,
}: {
	value: string;
	onChange: (next: string) => void;
	/**
	 * The keyboard's Search key. Results already arrive on the debounce, so
	 * this exists for what *committing* a term means rather than for fetching:
	 * on the feed's search route it is what tells the recent-search list that
	 * the term was real and not a prefix on the way to something else.
	 */
	onSubmit?: (value: string) => void;
	placeholder: string;
	/** True while a keystroke is still waiting on the debounce. Dims the clear button. */
	pending?: boolean;
	autoFocus?: boolean;
	/** `characters` for the audit log, which filters on SCREAMING_SNAKE actions. */
	autoCapitalize?: "none" | "characters";
	/** Caps the well inside a wide row - the top bar's 440 beside the nav. */
	maxWidth?: number;
	/** 40pt instead of 44, for a field sitting inside a chrome row rather than on a page. */
	compact?: boolean;
}) {
	const { colors, spacing, borderRadius } = useTheme();

	return (
		<View
			{...focusWithin}
			accessibilityRole="search"
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: spacing[2.5],
				width: "100%",
				height: compact ? 40 : 44,
				...(maxWidth ? { maxWidth } : {}),
				paddingHorizontal: spacing[3.5],
				borderRadius: borderRadius.md,
				backgroundColor: colors.background.subtle,
			}}
		>
			<Search
				size={compact ? 16 : 17}
				color={colors.text.quaternary as string}
				strokeWidth={1.9}
			/>
			<TextInput
				value={value}
				onChangeText={onChange}
				autoFocus={autoFocus}
				onSubmitEditing={() => onSubmit?.(value)}
				submitBehavior="submit"
				placeholder={placeholder}
				placeholderTextColor={colors.text.quaternary as string}
				autoCapitalize={autoCapitalize}
				autoCorrect={false}
				returnKeyType="search"
				accessibilityLabel={placeholder}
				style={{
					flex: 1,
					fontFamily: "MonaSans",
					fontSize: 15,
					lineHeight: 20,
					color: colors.text.primary as string,
					// No border and no padding: the shell owns both.
					borderWidth: 0,
					paddingVertical: 0,
				}}
			/>
			{value.length > 0 && (
				<Pressable
					onPress={() => onChange("")}
					accessibilityRole="button"
					accessibilityLabel="Clear search"
					hitSlop={10}
					{...focusable}
					style={({ pressed }) => ({
						width: 28,
						height: 28,
						borderRadius: 999,
						alignItems: "center",
						justifyContent: "center",
						opacity: pending ? 0.5 : 1,
						backgroundColor: pressed
							? colors.background.tertiary
							: "transparent",
					})}
				>
					<X size={15} color={colors.text.tertiary as string} strokeWidth={2} />
				</Pressable>
			)}
		</View>
	);
}
