import { Pin } from "lucide-react-native";
import { PropertyNote } from "@/components/composer/property-row";
import { SwitchRow } from "@/components/composer/switch-row";

/**
 * An announcement: a title, a body, and one switch.
 *
 * `status` is always `PUBLISHED` and there is no cover picker (a single object
 * key through `/api/uploads/intent` — a different upload path nothing wires up
 * yet). That leaves pinning, which is genuinely the author's call and
 * invisible until somebody opens the NGO's page — so it says what it will do,
 * in a line under the switch. No location: announcements have no city column.
 */

export interface AnnouncementFieldsValue {
	pinned: boolean;
}

export function AnnouncementFields({
	value,
	onChange,
	disabled,
}: {
	value: AnnouncementFieldsValue;
	onChange: (patch: Partial<AnnouncementFieldsValue>) => void;
	disabled?: boolean;
}) {
	return (
		<>
			<SwitchRow
				icon={Pin}
				title="Pin to NGO page"
				hint={
					value.pinned
						? "Sits at the top of your NGO page until you unpin it."
						: "Off — appears in the feed and on your page in date order."
				}
				value={value.pinned}
				onChange={(next) => onChange({ pinned: next })}
				disabled={disabled}
			/>
			<PropertyNote>
				Pinned posts stay first on your page. Everything else is newest-first.
			</PropertyNote>
		</>
	);
}
