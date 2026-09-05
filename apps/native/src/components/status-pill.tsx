import { View } from "react-native";
import { Caption } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";

export type PillTone = "neutral" | "success" | "warning" | "error" | "info";

/**
 * Small status chip used across the org, volunteer and admin lists.
 *
 * Built from theme tokens rather than the Tailwind-based Badge because the
 * Tailwind config has no dark palette — a Badge would stay light-on-light in
 * dark mode, unlike every other surface in the app.
 */
export function StatusPill({
	label,
	tone = "neutral",
}: {
	label: string;
	tone?: PillTone;
}) {
	const { colors, spacing, withOpacity } = useTheme();

	const palette = {
		neutral: colors.text.tertiary,
		success: colors.success.main,
		warning: colors.warning.main,
		error: colors.error.main,
		info: colors.info.main,
	} as const;

	const color = palette[tone] as string;

	return (
		<View
			style={{
				alignSelf: "flex-start",
				paddingHorizontal: spacing[2.5],
				paddingVertical: spacing[1],
				borderRadius: 999,
				backgroundColor: withOpacity(color, 0.12),
			}}
		>
			<Caption weight="medium" color={color} style={{ fontSize: 11 }}>
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
