import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { View } from "react-native";
import { Input, type InputProps } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Caption } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";

// ── useZodForm ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useZodForm(schema: any, defaultValues: Record<string, string>) {
	return useForm({ resolver: zodResolver(schema), defaultValues });
}

// ── FormField ────────────────────────────────────────────────────────

interface FormFieldProps
	extends Omit<InputProps, "value" | "onChangeText" | "onBlur"> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	control: any;
	name: string;
	label: string;
}

export function FormField({
	control,
	name,
	label,
	...inputProps
}: FormFieldProps) {
	const { colors, spacing } = useTheme();

	return (
		<Controller
			control={control}
			name={name as never}
			render={({
				field: { onChange, onBlur, value },
				fieldState: { error },
			}) => (
				<View className="mb-2 grid gap-1">
					<Label className="ml-1.5">{label}</Label>
					<Input
						value={value}
						onChangeText={onChange}
						onBlur={onBlur}
						{...inputProps}
					/>
					{error?.message && (
						<Caption
							color={colors.error.main as string}
							style={{ marginTop: spacing[1.5], marginLeft: spacing[0.5] }}
						>
							{error.message}
						</Caption>
					)}
				</View>
			)}
		/>
	);
}
