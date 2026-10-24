import {
	canTeamRole,
	type OrgPermissionAction,
	type TeamRole,
} from "@nabhya/shared";
import { Check } from "lucide-react-native";
import { View } from "react-native";
import { Caption, Label, Micro } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { TEAM_ROLE_COPY, TEAM_ROLE_LABELS } from "@/lib/team-roles";

const ROLE_ORDER: TeamRole[] = [
	"OWNER",
	"ADMIN",
	"MANAGER",
	"MEMBER",
	"VIEWER",
];

/**
 * One capability row. `action` reads straight from `ROLE_PERMISSIONS` (what
 * the server enforces), so the table cannot drift from it; the two rows with
 * no single permission behind them say who has them explicitly.
 */
const CAPABILITIES: Array<{
	label: string;
	action?: OrgPermissionAction;
	roles?: TeamRole[];
}> = [
	{
		label: "Save drafts",
		roles: ["OWNER", "ADMIN", "MANAGER", "MEMBER"],
	},
	{ label: "Publish posts, needs and events", action: "content.publish" },
	{ label: "Remove posts", action: "content.delete" },
	{ label: "Review applicants and pledges", action: "people.review" },
	{ label: "Mark attendance", action: "people.attendance" },
	{ label: "Issue certificates", action: "certs.issue" },
	{ label: "Revoke certificates", action: "certs.revoke" },
	{ label: "See donations", action: "money.view" },
	{ label: "Publish financial reports", action: "reports.manage" },
	{ label: "Edit the NGO profile", action: "org.edit" },
	{ label: "Invite and remove teammates", action: "team.invite" },
	{ label: "Change roles", action: "team.changeRole" },
	{ label: "Manage admins", roles: ["OWNER"] },
	{ label: "Transfer ownership", roles: ["OWNER"] },
];

function allowed(
	capability: (typeof CAPABILITIES)[number],
	role: TeamRole,
): boolean {
	if (capability.roles) return capability.roles.includes(role);
	return capability.action ? canTeamRole(role, capability.action) : false;
}

const ROLE_COLUMN = 84;

/**
 * "What can each role do?" as a grid on desktop: capabilities down the side,
 * the five roles across, a tick where a role may act and a quiet dash where it
 * may not. A paragraph per role made the reader assemble the comparison -
 * "can a Manager revoke a certificate?" meant reading two sentences and
 * noticing a word missing from one. On a phone, five columns leave the
 * capability a 70pt column, so it stays one short sentence per role.
 */
export function RoleMatrix() {
	const { colors, spacing } = useTheme();
	const { isDesktop } = useMedia();

	if (!isDesktop) {
		return (
			<View style={{ gap: spacing[3] }}>
				{ROLE_ORDER.map((role) => (
					<View key={role} style={{ gap: spacing[0.5] }}>
						<Label weight="semibold">{TEAM_ROLE_LABELS[role]}</Label>
						<Caption color="tertiary">{TEAM_ROLE_COPY[role]}</Caption>
					</View>
				))}
			</View>
		);
	}

	return (
		<View accessibilityRole="none">
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					paddingVertical: spacing[2],
					borderBottomWidth: 1,
					borderBottomColor: colors.border.hairline,
				}}
			>
				<View style={{ flex: 1 }}>
					<Micro color="tertiary" weight="medium">
						Can
					</Micro>
				</View>
				{ROLE_ORDER.map((role) => (
					<View key={role} style={{ width: ROLE_COLUMN, alignItems: "center" }}>
						<Micro color="secondary" weight="semibold">
							{TEAM_ROLE_LABELS[role]}
						</Micro>
					</View>
				))}
			</View>
			{CAPABILITIES.map((capability, index) => (
				<View
					key={capability.label}
					accessible
					accessibilityLabel={`${capability.label}: ${
						ROLE_ORDER.filter((role) => allowed(capability, role))
							.map((role) => TEAM_ROLE_LABELS[role])
							.join(", ") || "nobody"
					}`}
					style={{
						flexDirection: "row",
						alignItems: "center",
						minHeight: 40,
						borderBottomWidth: index === CAPABILITIES.length - 1 ? 0 : 1,
						borderBottomColor: colors.border.hairline,
					}}
				>
					<Caption color="secondary" style={{ flex: 1, minWidth: 0 }}>
						{capability.label}
					</Caption>
					{ROLE_ORDER.map((role) => (
						<View
							key={role}
							style={{ width: ROLE_COLUMN, alignItems: "center" }}
						>
							{allowed(capability, role) ? (
								<Check
									size={16}
									strokeWidth={2.25}
									color={colors.text.primary as string}
								/>
							) : (
								<Caption color="quaternary">-</Caption>
							)}
						</View>
					))}
				</View>
			))}
		</View>
	);
}
