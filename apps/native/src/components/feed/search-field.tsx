import { Search, X } from "lucide-react-native";
import { TextInput, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { useTheme } from "@/hooks/useTheme";
import { focusWithin } from "@/lib/focus";

/**
 * One shell holding the icon, the field and a clear button. The ring is drawn on
 * the shell via `focusWithin`, not on the bare input — see `src/global.css`.
 */
export function SearchField({
	value,
	onChange,
	pending,
	autoFocus,
}: {
	value: string;
	onChange: (next: string) => void;
	/** True while a keystroke is still waiting on the debounce. */
	pending: boolean;
	autoFocus?: boolean;
}) {
	const { colors, spacing, borderRadius } = useTheme();

	return (
		<View
			{...focusWithin}
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: spacing[2.5],
				height: 44,
				paddingHorizontal: spacing[3.5],
				borderRadius: borderRadius.md,
				backgroundColor: colors.background.subtle,
			}}
		>
			<Search
				size={17}
				color={colors.text.quaternary as string}
				strokeWidth={1.9}
			/>
			<TextInput
				value={value}
				onChangeText={onChange}
				autoFocus={autoFocus}
				placeholder="Search items, events, causes or NGOs"
				placeholderTextColor={colors.text.quaternary as string}
				autoCapitalize="none"
				returnKeyType="search"
				accessibilityLabel="Search the feed"
				style={{
					flex: 1,
					fontFamily: "MonaSans",
					fontSize: 15,
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
					style={{ opacity: pending ? 0.5 : 1 }}
				>
					<X size={16} color={colors.text.tertiary as string} strokeWidth={2} />
				</Pressable>
			)}
		</View>
	);
}
