import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react-native";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { View } from "react-native";
import { Input, type InputProps } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pressable } from "@/components/ui/pressable";
import { Caption } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { focusable } from "@/lib/focus";

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
	/**
	 * Adds a show/hide control inside the field, for a password.
	 *
	 * Not a nicety: a masked field with no reveal is the single biggest cause of
	 * a failed sign-in that the user cannot explain, because a phone keyboard's
	 * autocorrect, a stray caps-lock and a mistyped character are all invisible.
	 * Pass this instead of `secureTextEntry` — the toggle owns that prop.
	 */
	revealable?: boolean;
}

export function FormField({
	control,
	name,
	label,
	revealable,
	...inputProps
}: FormFieldProps) {
	const { colors, spacing } = useTheme();
	const [revealed, setRevealed] = useState(false);
	const Reveal = revealed ? EyeOff : Eye;

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
					<View style={{ position: "relative", justifyContent: "center" }}>
						<Input
							value={value}
							onChangeText={onChange}
							onBlur={onBlur}
							{...inputProps}
							{...(revealable
								? {
										secureTextEntry: !revealed,
										// Room for the control, so the caret and a long
										// password never run underneath it.
										style: [inputProps.style, { paddingRight: 52 }],
									}
								: {})}
						/>
						{revealable ? (
							<Pressable
								onPress={() => setRevealed((shown) => !shown)}
								hitSlop={8}
								accessibilityRole="button"
								accessibilityLabel={
									revealed ? "Hide password" : "Show password"
								}
								accessibilityState={{ checked: revealed }}
								{...focusable}
								style={({ pressed }) => ({
									position: "absolute",
									right: 4,
									width: 44,
									height: 44,
									alignItems: "center",
									justifyContent: "center",
									borderRadius: 999,
									opacity: pressed ? 0.6 : 1,
								})}
							>
								<Reveal
									size={18}
									strokeWidth={1.9}
									color={colors.text.tertiary as string}
								/>
							</Pressable>
						) : null}
					</View>
					{error?.message && (
						<Caption
							color={colors.error.ink as string}
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
