import type { ReactNode } from "react";
import { Icon } from "./icons.web";
export const TYPE_LABEL = {
	event: "Volunteer event",
	need: "Community need",
	story: "NGO announcement",
	post: "Community update",
};
export function Cta({
	children,
	href,
	variant = "primary",
	arrow = true,
}: {
	children: ReactNode;
	href: string;
	variant?: "primary" | "secondary" | "light" | "on-dark";
	arrow?: boolean;
}) {
	return (
		<a className={`landing-button landing-button-${variant}`} href={href}>
			{children}
			{arrow ? <Icon name="ArrowUpRight" size={18} /> : null}
		</a>
	);
}
