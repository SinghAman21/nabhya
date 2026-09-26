import type { LucideIcon } from "lucide-react-native";
import { Moon, Sun, SunMoon } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { ListRow } from "@/components/screen-shell";
import { Sheet, SheetOption } from "@/components/ui/sheet";
import { Caption } from "@/components/ui/typography";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTheme } from "@/hooks/use-theme";

/**
 * Appearance as a *setting*, not a floating switch.
 *
 * Every role reaches the same three-way choice - System, Light, Dark - from
 * wherever its settings live: the volunteer Profile, the admin Overview's
 * Account group, the NGO Profile, and the desktop sidebar footer. One sheet,
 * one label table, so the wording and the order never drift between them.
 */

export type AppearancePreference = ReturnType<typeof useAppTheme>["preference"];

export const APPEARANCE_LABEL: Record<AppearancePreference, string> = {
	system: "System",
	light: "Light",
	dark: "Dark",
};

const APPEARANCE_HINT: Record<AppearancePreference, string> = {
	system: "Follows the device setting",
	light: "Always light",
	dark: "Always dark",
};

const ORDER: AppearancePreference[] = ["system", "light", "dark"];

/** The icon that stands for the *current* choice, for icon-only placements. */
export function appearanceIcon(preference: AppearancePreference): LucideIcon {
	if (preference === "light") return Sun;
	if (preference === "dark") return Moon;
	return SunMoon;
}

/** Pick-one sheet. Owns nothing but its visibility; the theme hook is the store. */
export function AppearanceSheet({
	visible,
	onClose,
}: {
	visible: boolean;
	onClose: () => void;
}) {
	const { spacing } = useTheme();
	const { preference, setColorScheme } = useAppTheme();

	return (
		<Sheet
			visible={visible}
			onClose={onClose}
			title="Appearance"
			subtitle="System follows your device's setting."
		>
			<View style={{ paddingBottom: spacing[2] }}>
				{ORDER.map((option) => (
					<SheetOption
						key={option}
						label={APPEARANCE_LABEL[option]}
						hint={APPEARANCE_HINT[option]}
						selected={preference === option}
						onPress={() => {
							setColorScheme(option);
							onClose();
						}}
					/>
				))}
			</View>
		</Sheet>
	);
}

/**
 * A settings row that opens the sheet. Drop it into any `ListGroup`; it
 * renders its own sheet so the host screen needs no state.
 */
export function AppearanceRow() {
	const { preference } = useAppTheme();
	const [open, setOpen] = useState(false);
	const Icon = appearanceIcon(preference);

	return (
		<>
			<ListRow
				icon={Icon}
				label="Appearance"
				value={
					<Caption color="tertiary">{APPEARANCE_LABEL[preference]}</Caption>
				}
				onPress={() => setOpen(true)}
			/>
			<AppearanceSheet visible={open} onClose={() => setOpen(false)} />
		</>
	);
}
