import { Text, type TextProps } from "react-native";
import { displayByWeight, fontByWeight } from "@/constants/fonts";
import { useTheme } from "@/hooks/useTheme";
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

function BaseText({
	family,
	size,
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
	weight?: keyof typeof fontByWeight;
	/** Optical tracking. Tightens as size grows — set by the ramp, not by callers. */
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

export function H1({ className, ...props }: TypographyProps) {
	return (
		<BaseText
			family="display"
			size={40}
			tracking={-1}
			maxScale={1.2}
			className={className}
			{...props}
		/>
	);
}

export function H2({ className, ...props }: TypographyProps) {
	return (
		<BaseText
			family="display"
			size={28}
			tracking={-0.6}
			maxScale={1.3}
			className={className}
			{...props}
		/>
	);
}

export function H3({ className, ...props }: TypographyProps) {
	return (
		<BaseText
			family="sans"
			size={22}
			weight="bold"
			tracking={-0.4}
			maxScale={1.4}
			className={className}
			{...props}
		/>
	);
}

export function H4({ className, ...props }: TypographyProps) {
	return (
		<BaseText
			family="sans"
			size={19}
			weight="bold"
			tracking={-0.2}
			maxScale={1.4}
			className={className}
			{...props}
		/>
	);
}

export function H5({ className, ...props }: TypographyProps) {
	return (
		<BaseText
			family="sans"
			size={17}
			weight="bold"
			className={className}
			{...props}
		/>
	);
}

export function Body({ className, ...props }: TypographyProps) {
	return <BaseText family="sans" size={16} className={className} {...props} />;
}

export function BodySmall({ className, ...props }: TypographyProps) {
	return <BaseText family="sans" size={15} className={className} {...props} />;
}

export function Caption({ className, ...props }: TypographyProps) {
	return <BaseText family="sans" size={13} className={className} {...props} />;
}

export function Label({ className, ...props }: TypographyProps) {
	return (
		<BaseText
			family="sans"
			size={15}
			weight="medium"
			className={className}
			{...props}
		/>
	);
}

export function Mono({ className, ...props }: TypographyProps) {
	return <BaseText family="mono" size={15} className={className} {...props} />;
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
