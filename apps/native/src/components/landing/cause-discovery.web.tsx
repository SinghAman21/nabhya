import { useState } from "react";
import { Icon } from "./icons.web";
import type { LandingCause } from "./types";

export function CauseDiscovery({
	causes,
	selected,
	onSelect,
}: {
	causes: readonly LandingCause[];
	selected: string | null;
	onSelect: (slug: string | null) => void;
}) {
	const [expanded, setExpanded] = useState(false);
	const shown = expanded ? causes : causes.slice(0, 4);
	const selectedOutside = causes.find(
		(c) => c.slug === selected && !shown.some((s) => s.slug === selected),
	);
	const items = selectedOutside ? [...shown, selectedOutside] : shown;
	return (
		<div id="causes" className="cause-discovery">
			<fieldset className="cause-chips">
				<legend className="landing-sr-only">
					Filter volunteer opportunities by cause
				</legend>
				<button
					type="button"
					aria-pressed={!selected}
					onClick={() => onSelect(null)}
				>
					All causes
				</button>
				{items.map((cause) => (
					<button
						type="button"
						key={cause.slug}
						aria-pressed={selected === cause.slug}
						onClick={() => onSelect(cause.slug)}
					>
						<Icon name={cause.icon ?? "Sprout"} size={16} />
						{cause.name}
					</button>
				))}
				{causes.length > 4 ? (
					<button
						type="button"
						className="cause-more"
						aria-expanded={expanded}
						onClick={() => setExpanded((value) => !value)}
					>
						{expanded ? "Fewer causes" : "More causes"}
						<Icon name="ChevronDown" size={14} />
					</button>
				) : null}
			</fieldset>
		</div>
	);
}
