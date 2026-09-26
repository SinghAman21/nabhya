import { View } from "react-native";
import { Caption } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";

export type PillTone = "neutral" | "success" | "warning" | "error" | "info";

/**
 * Small status chip used across the org, volunteer and admin lists.
 *
 * Built from theme tokens rather than the Tailwind-based Badge so it follows
 * `useTheme()` like every other surface in the app.
 *
 * The label is drawn in the tone's **ink**, not its `main` fill colour. Tinting
 * `main` at 12% and then writing in `main` gave 2.07:1 (warning) to 3.44:1
 * (error) - the verification state, which is the single most load-bearing piece
 * of information in the product, was the hardest thing on the screen to read.
 * Ink-on-tint measures 6.8:1 to 8.0:1 in light mode and 8.5:1 to 10.4:1 in dark.
 */
export function StatusPill({
	label,
	tone = "neutral",
}: {
	label: string;
	tone?: PillTone;
}) {
	const { colors, spacing } = useTheme();

	const palette: Record<PillTone, { ink: string; bg: string }> = {
		neutral: {
			ink: colors.text.secondary as string,
			bg: colors.background.tertiary as string,
		},
		success: { ink: colors.success.ink, bg: colors.success.bg },
		warning: { ink: colors.warning.ink, bg: colors.warning.bg },
		error: { ink: colors.error.ink, bg: colors.error.bg },
		info: { ink: colors.info.ink, bg: colors.info.bg },
	};

	const { ink, bg } = palette[tone];

	return (
		<View
			accessible
			accessibilityRole="text"
			accessibilityLabel={`Status: ${label}`}
			style={{
				alignSelf: "flex-start",
				paddingHorizontal: spacing[2.5],
				paddingVertical: spacing[1],
				borderRadius: 999,
				backgroundColor: bg,
			}}
		>
			<Caption weight="medium" color={ink} style={{ fontSize: 12 }}>
				{label}
			</Caption>
		</View>
	);
}

// ─── Status → tone mappings ──────────────────────────────────────────────────

export function verificationTone(status: string | null | undefined): PillTone {
	switch (status) {
		case "VERIFIED":
			return "success";
		case "REJECTED":
			return "error";
		case "UNDER_REVIEW":
			return "info";
		default:
			return "warning";
	}
}

export function applicationTone(status: string): PillTone {
	switch (status) {
		case "ACCEPTED":
			return "success";
		case "REJECTED":
			return "error";
		case "WITHDRAWN":
			return "neutral";
		default:
			return "warning";
	}
}

export function pledgeTone(status: string): PillTone {
	switch (status) {
		case "ACCEPTED":
		case "COMPLETED":
			return "success";
		case "REJECTED":
			return "error";
		case "CANCELLED":
			return "neutral";
		default:
			return "warning";
	}
}

export function urgencyTone(urgency: string): PillTone {
	switch (urgency) {
		case "HIGH":
			return "error";
		case "MEDIUM":
			return "warning";
		default:
			return "neutral";
	}
}

export function eventStatusTone(status: string): PillTone {
	switch (status) {
		case "PUBLISHED":
			return "success";
		case "CANCELLED":
			return "error";
		case "COMPLETED":
			return "info";
		default:
			return "neutral";
	}
}

/** "UNDER_REVIEW" → "Under review" */
export function humanizeStatus(status: string | null | undefined): string {
	if (!status) return "Unknown";
	const words = status.replace(/_/g, " ").toLowerCase();
	return words.charAt(0).toUpperCase() + words.slice(1);
}
