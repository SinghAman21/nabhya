import type { LucideIcon } from "lucide-react-native";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Body, Caption, H2 } from "@/components/ui/typography";
import { useTheme } from "@/hooks/useTheme";

/** Standard screen title block — matches the spacing used by the onboarding steps. */
export function ScreenHeader({
	title,
	subtitle,
	action,
}: {
	title: string;
	subtitle?: string;
	action?: React.ReactNode;
}) {
	const { spacing } = useTheme();

	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "flex-start",
				justifyContent: "space-between",
				gap: spacing[3],
				marginBottom: subtitle ? spacing[5] : spacing[4],
			}}
		>
			<View style={{ flex: 1 }}>
				<H2 style={{ marginBottom: subtitle ? spacing[1] : 0 }}>{title}</H2>
				{subtitle && <Body color="tertiary">{subtitle}</Body>}
			</View>
			{action}
		</View>
	);
}

/** Rounded surface used for every list row and detail panel. */
export function Surface({
	children,
	onPress,
	style,
	padded = true,
}: {
	children: React.ReactNode;
	onPress?: () => void;
	style?: object;
	padded?: boolean;
}) {
	const { colors, spacing, borderRadius } = useTheme();

	const base = {
		backgroundColor: colors.background.primary,
		borderRadius: borderRadius.lg,
		borderWidth: 1,
		borderColor: colors.border.light,
		padding: padded ? spacing[4] : 0,
		...style,
	};

	if (!onPress) return <View style={base}>{children}</View>;

	return (
		<Pressable
			onPress={onPress}
			style={({ pressed }) => ({
				...base,
				borderColor: pressed ? colors.primary.main : colors.border.light,
			})}
		>
			{children}
		</Pressable>
	);
}

export function EmptyState({
	icon: Icon,
	title,
	description,
	action,
}: {
	icon?: LucideIcon;
	title: string;
	description?: string;
	action?: React.ReactNode;
}) {
	const { colors, spacing } = useTheme();

	return (
		<View
			style={{
				alignItems: "center",
				paddingVertical: spacing[12],
				paddingHorizontal: spacing[6],
			}}
		>
			{Icon && (
				<View
					style={{
						width: 56,
						height: 56,
						borderRadius: 28,
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: colors.background.tertiary,
						marginBottom: spacing[4],
					}}
				>
					<Icon size={24} color={colors.text.tertiary as string} />
				</View>
			)}
			<Body weight="bold" style={{ marginBottom: spacing[1] }}>
				{title}
			</Body>
			{description && (
				<Caption color="tertiary" style={{ textAlign: "center" }}>
					{description}
				</Caption>
			)}
			{action && <View style={{ marginTop: spacing[5] }}>{action}</View>}
		</View>
	);
}

export function LoadingState({ label }: { label?: string }) {
	const { colors, spacing } = useTheme();

	return (
		<View style={{ alignItems: "center", paddingVertical: spacing[12] }}>
			<ActivityIndicator size="small" color={colors.primary.main as string} />
			{label && (
				<Caption color="tertiary" style={{ marginTop: spacing[3] }}>
					{label}
				</Caption>
			)}
		</View>
	);
}

export function ErrorState({
	message,
	onRetry,
}: {
	message: string;
	onRetry?: () => void;
}) {
	const { colors, spacing } = useTheme();

	return (
		<View
			style={{
				alignItems: "center",
				paddingVertical: spacing[12],
				paddingHorizontal: spacing[6],
			}}
		>
			<Body
				weight="bold"
				color={colors.error.main as string}
				style={{ marginBottom: spacing[1] }}
			>
				Something went wrong
			</Body>
			<Caption color="tertiary" style={{ textAlign: "center" }}>
				{message}
			</Caption>
			{onRetry && (
				<Pressable onPress={onRetry} style={{ marginTop: spacing[4] }}>
					<Caption weight="medium" color={colors.primary.main as string}>
						Try again
					</Caption>
				</Pressable>
			)}
		</View>
	);
}

/** Horizontal filter chip row shared by the list screens. */
export function FilterChips<T extends string>({
	options,
	value,
	onChange,
}: {
	options: Array<{ value: T; label: string }>;
	value: T;
	onChange: (value: T) => void;
}) {
	const { colors, spacing } = useTheme();

	return (
		<View
			style={{
				flexDirection: "row",
				flexWrap: "wrap",
				gap: spacing[2],
				marginBottom: spacing[4],
			}}
		>
			{options.map((option) => {
				const active = option.value === value;
				return (
					<Pressable
						key={option.value}
						onPress={() => onChange(option.value)}
						style={{
							paddingHorizontal: spacing[3.5],
							paddingVertical: spacing[2],
							borderRadius: 999,
							backgroundColor: active
								? colors.primary.main
								: colors.background.tertiary,
						}}
					>
						<Caption
							weight={active ? "bold" : "medium"}
							color={active ? (colors.primary.contrast as string) : "secondary"}
						>
							{option.label}
						</Caption>
					</Pressable>
				);
			})}
		</View>
	);
}
