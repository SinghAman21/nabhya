import { Text, type TextProps } from "react-native";
import { displayByWeight, fontByWeight } from "@/constants/fonts";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

type TextColor = keyof ReturnType<typeof useTheme>["colors"]["text"] | string;

interface TypographyProps extends TextProps {
	color?: TextColor;
	weight?: keyof typeof fontByWeight;
	className?: string;
	children: React.ReactNode;
}

function useTextColor(color?: TextColor) {
	const { colors } = useTheme();
	if (!color) return colors.text.primary;
	if (color in colors.text)
		return colors.text[color as keyof typeof colors.text];
	return color;
}

/**
 * The type ramp. Every step owns its size, line height and optical tracking;
 * callers pick a step, never a number.
 *
 * Line heights are explicit because React Native falls back to the font's
 * own metrics, and the loaded faces report tight ones - descenders clipped in
 * pills, two-line titles set solid, captions crowding the row above. Headings
 * sit at ~1.2, body at 1.5, small text at ~1.4.
 */
function BaseText({
	family,
	size,
	lineHeight,
	weight = "normal",
	color,
	tracking = 0,
	maxScale = 1.6,
	className,
	style,
	children,
	...props
}: TypographyProps & {
	family: "sans" | "mono" | "display";
	size: number;
	lineHeight: number;
	weight?: keyof typeof fontByWeight;
	/** Optical tracking. Tightens as size grows - set by the ramp, not by callers. */
	tracking?: number;
	/** Dynamic Type ceiling. Body text is allowed to grow further than headings,
	 *  which are already large and would break layout first. */
	maxScale?: number;
}) {
	const fontFamily =
		family === "display" ? displayByWeight[weight] : fontByWeight[weight];

	return (
		<Text
			style={[
				{
					fontFamily,
					fontSize: size,
					lineHeight,
					letterSpacing: tracking,
					color: useTextColor(color),
				},
				style,
			]}
			className={cn(className)}
			maxFontSizeMultiplier={maxScale}
			{...props}
		>
			{children}
		</Text>
	);
}

/** Hero numerals and the rare full-bleed title. */
export function H1({ className, ...props }: TypographyProps) {
	return (
		<BaseText
			family="display"
			size={34}
			lineHeight={40}
			tracking={-0.8}
			maxScale={1.2}
			className={className}
			{...props}
		/>
	);
}

/** Screen title on a top-level tab. */
export function H2({ className, ...props }: TypographyProps) {
	return (
		<BaseText
			family="display"
			size={26}
			lineHeight={32}
			tracking={-0.5}
			maxScale={1.3}
			className={className}
			{...props}
		/>
	);
}

/** Screen title on a pushed page, beside the back button. */
export function H3({ className, ...props }: TypographyProps) {
	return (
		<BaseText
			family="sans"
			size={22}
			lineHeight={28}
			weight="bold"
			tracking={-0.4}
			maxScale={1.4}
			className={className}
			{...props}
		/>
	);
}

/** Sheet and dialog titles. */
export function H4({ className, ...props }: TypographyProps) {
	return (
		<BaseText
			family="sans"
			size={19}
			lineHeight={24}
			weight="bold"
			tracking={-0.2}
			maxScale={1.4}
			className={className}
			{...props}
		/>
	);
}

/** Card titles. */
export function H5({ className, ...props }: TypographyProps) {
	return (
		<BaseText
			family="sans"
			size={17}
			lineHeight={22}
			weight="bold"
			tracking={-0.1}
			className={className}
			{...props}
		/>
	);
}

export function Body({ className, ...props }: TypographyProps) {
	return (
		<BaseText
			family="sans"
			size={16}
			lineHeight={24}
			className={className}
			{...props}
		/>
	);
}

export function BodySmall({ className, ...props }: TypographyProps) {
	return (
		<BaseText
			family="sans"
			size={15}
			lineHeight={22}
			className={className}
			{...props}
		/>
	);
}

export function Caption({ className, ...props }: TypographyProps) {
	return (
		<BaseText
			family="sans"
			size={13}
			lineHeight={18}
			className={className}
			{...props}
		/>
	);
}

/** Buttons, list-row titles, form labels. */
export function Label({ className, ...props }: TypographyProps) {
	return (
		<BaseText
			family="sans"
			size={15}
			lineHeight={20}
			weight="medium"
			className={className}
			{...props}
		/>
	);
}

export function Mono({ className, ...props }: TypographyProps) {
	return (
		<BaseText
			family="mono"
			size={15}
			lineHeight={22}
			className={className}
			{...props}
		/>
	);
}

export const Typography = {
	H1,
	H2,
	H3,
	H4,
	H5,
	Body,
	BodySmall,
	Caption,
	Label,
	Mono,
};
export default Typography;
