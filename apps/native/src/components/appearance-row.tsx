import {
	APPEARANCE_LABEL,
	AppearanceMenu,
	appearanceIcon,
} from "@/components/appearance-menu";
import { ListRow } from "@/components/screen-shell";
import { Caption } from "@/components/ui/typography";
import { useAppTheme } from "@/hooks/use-app-theme";

/**
 * Appearance as a *setting*, not a floating switch.
 *
 * Every role reaches the same three-way choice - System, Light, Dark - from
 * wherever its settings live: the volunteer Profile, the admin Overview's
 * Account group, the NGO Profile, and the desktop sidebar footer. One label
 * table, one sheet and one menu, so the wording and the order never drift
 * between them.
 *
 * The table, the sheet and the menu live in `appearance-menu.tsx` and are
 * re-exported here, so existing imports keep working and the two files never
 * import each other.
 */
export {
	APPEARANCE_LABEL,
	type AppearancePreference,
	AppearanceSheet,
	appearanceIcon,
} from "@/components/appearance-menu";

/**
 * A settings row for Appearance. Drop it into any `ListGroup`; it owns its own
 * picker so the host screen needs no state - an anchored menu above the row's
 * right end on desktop, the sheet on a phone (`AppearanceMenu` decides).
 */
export function AppearanceRow() {
	const { preference } = useAppTheme();
	const label = APPEARANCE_LABEL[preference];

	return (
		<AppearanceMenu placement="top-end">
			{({ toggle }) => (
				<ListRow
					icon={appearanceIcon(preference)}
					label="Appearance"
					accessibilityLabel={`Appearance, ${label}`}
					value={<Caption color="tertiary">{label}</Caption>}
					onPress={toggle}
				/>
			)}
		</AppearanceMenu>
	);
}
