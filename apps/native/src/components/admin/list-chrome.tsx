import { Search, X } from "lucide-react-native";
import { ActivityIndicator, TextInput, View } from "react-native";
import { Screen } from "@/components/screen-shell";
import { Pressable } from "@/components/ui/pressable";
import { Caption, Label } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { focusable, focusWithin } from "@/lib/focus";

/**
 * Furniture shared by the five admin screens: the page, the search field and
 * the paging footer. Kept together so a change to one list's chrome is a
 * change to all of them.
 */

/** Widest an admin page gets on desktop; past this a row is a line of text with a mile of card behind it. */
const DESKTOP_MAX_WIDTH = 1040;

export function AdminScreen({ children }: { children: React.ReactNode }) {
	const { isDesktop } = useMedia();
	const { spacing } = useTheme();

	return (
		<Screen
			style={
				isDesktop
					? {
							width: "100%",
							maxWidth: DESKTOP_MAX_WIDTH,
							alignSelf: "center",
							paddingHorizontal: spacing[8],
						}
					: undefined
			}
		>
			{children}
		</Screen>
	);
}

/**
 * The list search. A quiet inset well rather than an outlined input: it sits
 * above filter chips, and two outlines stacked read as a form, not a list.
 */
export function SearchField({
	value,
	onChangeText,
	placeholder,
	autoCapitalize = "none",
}: {
	value: string;
	onChangeText: (value: string) => void;
	placeholder: string;
	autoCapitalize?: "none" | "characters";
}) {
	const { colors, spacing, borderRadius } = useTheme();

	return (
		<View
			{...focusWithin}
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: spacing[2.5],
				minHeight: 44,
				paddingHorizontal: spacing[3.5],
				borderRadius: borderRadius.md,
				backgroundColor: colors.background.subtle,
				marginBottom: spacing[3],
			}}
		>
			<Search
				size={17}
				color={colors.text.quaternary as string}
				strokeWidth={1.9}
			/>
			<TextInput
				value={value}
				onChangeText={onChangeText}
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
					paddingVertical: spacing[3],
					borderWidth: 0,
				}}
			/>
			{value.length > 0 && (
				<Pressable
					onPress={() => onChangeText("")}
					accessibilityRole="button"
					accessibilityLabel="Clear search"
					hitSlop={8}
					{...focusable}
					style={({ pressed }) => ({
						width: 28,
						height: 28,
						borderRadius: 999,
						alignItems: "center",
						justifyContent: "center",
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

/** "N results" above a list. Silent when there is nothing to count. */
export function ResultCount({ total, noun }: { total: number; noun: string }) {
	const { spacing } = useTheme();
	if (total === 0) return null;

	return (
		<Caption color="tertiary" style={{ marginBottom: spacing[3] }}>
			{total} {noun}
			{total === 1 ? "" : "s"}
		</Caption>
	);
}

/**
 * Paging footer for an infinite list. Fetching shows a spinner; more pages
 * show an explicit "Load more" as well as loading on scroll, because on
 * desktop a short first page may never reach the end threshold; the end shows
 * a quiet full stop.
 */
export function ListFooter({
	hasMore,
	fetching,
	onLoadMore,
	count,
}: {
	hasMore: boolean;
	fetching: boolean;
	onLoadMore: () => void;
	count: number;
}) {
	const { colors, spacing } = useTheme();

	if (count === 0) return null;

	if (fetching) {
		return (
			<View
				accessibilityRole="progressbar"
				accessibilityLabel="Loading more"
				style={{ paddingVertical: spacing[6], alignItems: "center" }}
			>
				<ActivityIndicator
					size="small"
					color={colors.text.quaternary as string}
				/>
			</View>
		);
	}

	if (hasMore) {
		return (
			<View style={{ paddingVertical: spacing[4], alignItems: "center" }}>
				<Pressable
					onPress={onLoadMore}
					accessibilityRole="button"
					{...focusable}
					style={({ pressed }) => ({
						minHeight: 40,
						paddingHorizontal: spacing[5],
						borderRadius: 999,
						justifyContent: "center",
						borderWidth: 1,
						borderColor: colors.border.medium,
						backgroundColor: pressed ? colors.background.subtle : "transparent",
					})}
				>
					<Label>Load more</Label>
				</Pressable>
			</View>
		);
	}

	return (
		<View style={{ paddingVertical: spacing[6], alignItems: "center" }}>
			<Caption color="quaternary">That's everything</Caption>
		</View>
	);
}
