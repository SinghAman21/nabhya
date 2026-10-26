import type { CSSProperties } from "react";

/** Small SVG line vocabulary matching the app's existing cause icon names. */
const paths: Record<string, string> = {
	ArrowRight: "M4 12h16m-6-6 6 6-6 6",
	ChevronLeft: "m15 5-7 7 7 7",
	Play: "m8 4 12 8-12 8V4Z",
	Pause: "M8 5v14M16 5v14",
	ArrowUpRight: "M6 18 18 6M6 6h12v12",
	Check: "m5 12 4 4L19 6",
	ChevronDown: "m6 9 6 6 6-6",
	Close: "m6 6 12 12M6 18 18 6",
	Menu: "M4 6h16M4 12h16M4 18h16",
	MapPin:
		"M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 1 1 6 0Z",
	Search: "m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 1 1 16 0Z",
	ShieldCheck: "M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-4Zm-5 10 3 3 7-7",
	Clock: "M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 1 1 20 0Z",
	Calendar: "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z",
	GraduationCap: "m2 9 10-5 10 5-10 5L2 9Zm4 2v6c4 3 8 3 12 0v-6m4-2v8",
	Stethoscope:
		"M5 3v6a5 5 0 0 0 10 0V3M4 3h3m6 0h3M10 14v3a4 4 0 0 0 8 0v-3M21 11a3 3 0 1 1-6 0 3 3 0 1 1 6 0Z",
	Leaf: "M20 3c-8-1-17 1-17 9a7 7 0 0 0 7 8c8 0 10-9 10-17ZM4 21 15 10",
	Baby: "M10 3c-3 2 1 6 4 2M4 10a9 9 0 0 1 16 0c4 0 4 5 0 5a9 9 0 0 1-16 0c-4 0-4-5 0-5Zm4 2h.01M16 12h.01M8 16c3 3 5 3 8 0",
	PawPrint:
		"M8 14c2-5 6-5 8 0 6 5 0 9-4 6-4 3-10-1-4-6ZM7 7a2 3 0 1 1-4 0 2 3 0 1 1 4 0ZM14 4a2 3 0 1 1-4 0 2 3 0 1 1 4 0ZM21 7a2 3 0 1 1-4 0 2 3 0 1 1 4 0Z",
	LifeBuoy:
		"M22 12a10 10 0 1 1-20 0 10 10 0 1 1 20 0ZM16 12a4 4 0 1 1-8 0 4 4 0 1 1 8 0ZM5 5l4 4m6 6 4 4M5 19l4-4m6-6 4-4",
	Utensils: "M4 2v7a3 3 0 0 0 6 0V2M7 2v20M20 2c-6 5-6 11 0 11V2Zm0 11v9",
	Hammer: "m14 4 6 6-3 3-3-3-9 11-3-3L13 9l-3-3 3-3 1 1Z",
	HeartHandshake:
		"M12 5c-5-6-14 1-9 7l9 9 9-9c5-6-4-13-9-7Zm-6 6 3-3 4 4 3-3m-9 8 3-3m0 6 3-3",
	Sprout:
		"M12 22V12M12 16C3 16 2 9 2 5c8-1 11 4 10 11Zm0-4C12 5 17 2 22 2c1 7-3 11-10 10Z",
	File: "M14 2H4v20h16V8l-6-6Zm0 0v6h6M8 13h8m-8 4h6",
	People:
		"M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3m20 0v-3a4 4 0 0 0-3-4M13 6a4 4 0 1 1-8 0 4 4 0 1 1 8 0Zm4-4a4 4 0 0 1 0 8",
	Heart: "M12 5C7-2-3 5 3 12l9 9 9-9C27 5 17-2 12 5Z",
};

export function Icon({
	name,
	size = 20,
	style,
}: {
	name: string;
	size?: number;
	style?: CSSProperties;
}) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.6"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			focusable="false"
			style={style}
		>
			<path d={paths[name] ?? paths.Sprout} />
		</svg>
	);
}

export function Botanical({ className = "" }: { className?: string }) {
	return (
		<svg
			className={className}
			viewBox="0 0 150 180"
			fill="none"
			aria-hidden="true"
			focusable="false"
		>
			<path
				d="M76 174C76 135 72 90 96 15M78 135C37 130 28 107 26 86c31 2 51 17 52 49ZM77 105c30-6 46-23 49-46-29 2-44 22-49 46ZM82 73C54 67 45 47 48 27c25 7 34 25 34 46ZM91 38c19-3 29-16 28-32-17 4-27 14-28 32Z"
				stroke="currentColor"
				strokeWidth="1.7"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}
