import { View } from "react-native";
import { humanizeStatus } from "@/components/status-pill";
import { Body, Caption } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { formatRelative } from "@/lib/format";
import type { AuditLogEntry } from "@/lib/types";

/**
 * One line of the audit log: actor · action · entity · when.
 *
 * Dense on purpose. An operations admin scans this for the one suspension
 * among a hundred approvals, so the only colour is a 6px dot by intent -
 * destructive, constructive, or neither - and everything else is ink.
 */
export function auditTone(action: string): "error" | "success" | "neutral" {
	if (/REJECT|SUSPEND|DELETE|REVOKE|CANCEL/.test(action)) return "error";
	if (/VERIF|ACCEPT|COMPLETE|GRANT|APPROV|REINSTAT/.test(action))
		return "success";
	return "neutral";
}

export function AuditRow({ entry }: { entry: AuditLogEntry }) {
	const { colors, spacing } = useTheme();
	const tone = auditTone(entry.action);
	const dot =
		tone === "error"
			? colors.error.ink
			: tone === "success"
				? colors.success.ink
				: (colors.text.quaternary as string);

	const actor = entry.actor?.fullName ?? entry.actor?.email ?? "System";
	const entity = entry.entityName
		? `${humanizeStatus(entry.entityName)}${
				entry.entityId ? ` ${entry.entityId.slice(0, 8)}` : ""
			}`
		: null;

	return (
		<View
			accessible
			accessibilityRole="text"
			accessibilityLabel={`${actor} ${humanizeStatus(entry.action).toLowerCase()}${entity ? `, ${entity}` : ""}, ${formatRelative(entry.createdAt)}`}
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: spacing[3],
				paddingHorizontal: spacing[4],
				paddingVertical: spacing[3],
				minHeight: 52,
			}}
		>
			<View
				style={{
					width: 6,
					height: 6,
					borderRadius: 3,
					backgroundColor: dot,
				}}
			/>
			<View style={{ flex: 1, minWidth: 0 }}>
				<Body weight="medium" numberOfLines={1}>
					{actor}
					<Body color="tertiary"> · {humanizeStatus(entry.action)}</Body>
				</Body>
				{entity && (
					<Caption color="tertiary" numberOfLines={1}>
						{entity}
					</Caption>
				)}
			</View>
			<Caption color="quaternary">{formatRelative(entry.createdAt)}</Caption>
		</View>
	);
}
