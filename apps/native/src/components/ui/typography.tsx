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
	className,
	style,
	children,
	...props
}: TypographyProps & {
	family: "sans" | "mono" | "display";
	size: number;
	weight?: keyof typeof fontByWeight;
}) {
	const fontFamily =
		family === "display" ? displayByWeight[weight] : fontByWeight[weight];

	return (
		<Text
			style={[
				{
					fontFamily,
					fontSize: size,
					color: useTextColor(color),
				},
				style,
			]}
			className={cn(className)}
			maxFontSizeMultiplier={1.3}
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
			size={42}
			className={cn("tracking-tight", className)}
			{...props}
		/>
	);
}

export function H2({ className, ...props }: TypographyProps) {
	return (
		<BaseText
			family="display"
			size={36}
			className={cn("tracking-tight", className)}
			{...props}
		/>
	);
}

export function H3({ className, ...props }: TypographyProps) {
	return (
		<BaseText
			family="sans"
			size={30}
			weight="bold"
			className={cn("tracking-tight", className)}
			{...props}
		/>
	);
}

export function H4({ className, ...props }: TypographyProps) {
	return (
		<BaseText
			family="sans"
			size={26}
			weight="bold"
			className={className}
			{...props}
		/>
	);
}

export function H5({ className, ...props }: TypographyProps) {
	return (
		<BaseText
			family="sans"
			size={20}
			weight="bold"
			className={className}
			{...props}
		/>
	);
}

export function Body({ className, ...props }: TypographyProps) {
	return <BaseText family="sans" size={15} className={className} {...props} />;
}

export function BodySmall({ className, ...props }: TypographyProps) {
	return <BaseText family="sans" size={14} className={className} {...props} />;
}

export function Caption({ className, ...props }: TypographyProps) {
	return <BaseText family="sans" size={12} className={className} {...props} />;
}

export function Label({ className, ...props }: TypographyProps) {
	return (
		<BaseText
			family="sans"
			size={14}
			weight="medium"
			className={className}
			{...props}
		/>
	);
}

export function Mono({ className, ...props }: TypographyProps) {
	return <BaseText family="mono" size={14} className={className} {...props} />;
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
