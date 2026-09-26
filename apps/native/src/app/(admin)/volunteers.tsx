import type { AdminUserSort, SortDir } from "@nabhya/shared";
import { Users } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { ConsoleList } from "@/components/admin/console-list";
import type { TableColumn } from "@/components/admin/data-table";
import { AdminScreen } from "@/components/admin/list-chrome";
import { SelectMenu } from "@/components/admin/select-menu";
import { Toolbar, useTableView } from "@/components/admin/toolbar";
import { UserDetailSheet } from "@/components/admin/user-detail-sheet";
import { InitialAvatar } from "@/components/initial-avatar";
import { EmptyState, Surface } from "@/components/screen-shell";
import {
	humanizeStatus,
	StatusPill,
	verificationTone,
} from "@/components/status-pill";
import { Body, Caption } from "@/components/ui/typography";
import { useAdminUsersPaged } from "@/hooks/use-admin-lists";
import { useTheme } from "@/hooks/use-theme";
import { useDebounced } from "@/hooks/useDebounced";
import { formatDate } from "@/lib/format";
import type { AdminUserListItem } from "@/lib/types";

type IdFilter = "ANY" | "PENDING" | "VERIFIED" | "REJECTED";
type Standing = "ANY" | "ACTIVE" | "SUSPENDED";

const IDENTITY = [
	{ value: "ANY" as const, label: "Any" },
	{
		value: "PENDING" as const,
		label: "Pending",
		hint: "Documents waiting on a decision",
	},
	{ value: "VERIFIED" as const, label: "Verified", hint: "ID and selfie both" },
	{ value: "REJECTED" as const, label: "Rejected" },
];

const STANDING = [
	{ value: "ANY" as const, label: "Any" },
	{ value: "ACTIVE" as const, label: "Active" },
	{ value: "SUSPENDED" as const, label: "Suspended" },
];

/**
 * Volunteers. **Only volunteers.**
 *
 * This used to be "People" with a Role select covering volunteers, NGO accounts
 * and superadmins - which meant the console had two screens claiming the same
 * ground: an NGO appeared here as an *account* and next door as an
 * *organisation*, and nothing on either screen said which one you were supposed
 * to use. The role is fixed now and the filter is gone. One screen, one
 * population.
 *
 * **An NGO's own account is reached through its organisation**, not from here:
 * `(admin)/organizations` → the NGO → "Manage this account" in the Owner
 * section, which hands off to the same `UserDetailSheet` this screen opens. That
 * is also the better route - you almost never want to suspend an NGO's login
 * without having just read its record.
 *
 * Superadmins have no screen and need none: there is no moderation action a
 * superadmin can take on another one, and minting the first is a script (see the
 * root `AGENTS.md` traps).
 *
 * Two axes remain, and they are independent, which is why they are two selects
 * rather than one chip row: identity state and account standing. A volunteer can
 * be verified *and* suspended.
 */
export default function AdminVolunteers() {
	const { colors, spacing } = useTheme();
	const [identity, setIdentity] = useState<IdFilter>("ANY");
	const [standing, setStanding] = useState<Standing>("ANY");
	const [search, setSearch] = useState("");
	const [sort, setSort] = useState<{ sort: AdminUserSort; dir: SortDir }>({
		sort: "createdAt",
		dir: "desc",
	});
	const [selected, setSelected] = useState<string | null>(null);
	const [view, setView] = useTableView("people");

	const debouncedSearch = useDebounced(search.trim());
	const list = useAdminUsersPaged({
		// Not a filter the reader can change - see the note above.
		role: "volunteer",
		...(debouncedSearch ? { search: debouncedSearch } : {}),
		...(identity === "ANY" ? {} : { verificationStatus: identity }),
		...(standing === "ANY" ? {} : { status: standing }),
		sort: sort.sort,
		dir: sort.dir,
	});

	const columns: Array<TableColumn<AdminUserListItem>> = [
		{
			key: "name",
			header: "Name",
			sortKey: "name",
			minWidth: 220,
			render: (user) => (
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[2.5],
					}}
				>
					<InitialAvatar name={user.fullName ?? user.email} size={28} />
					<View style={{ flex: 1, minWidth: 0 }}>
						<Body weight="medium" numberOfLines={1}>
							{user.fullName ?? "Unnamed"}
						</Body>
						<Caption color="quaternary" numberOfLines={1}>
							{user.email}
						</Caption>
					</View>
				</View>
			),
		},
		{
			key: "identity",
			header: "Identity",
			sortKey: "verificationStatus",
			width: 116,
			render: (user) => (
				<StatusPill
					label={humanizeStatus(user.verificationStatus)}
					tone={verificationTone(user.verificationStatus)}
				/>
			),
		},
		{
			key: "standing",
			header: "Standing",
			width: 108,
			render: (user) =>
				user.status === "SUSPENDED" ? (
					<StatusPill label="Suspended" tone="error" />
				) : !user.onboardedAt ? (
					// Worth a word: an account that never finished onboarding looks
					// identical to a healthy one in every other column.
					<Caption color={colors.warning.ink}>Incomplete</Caption>
				) : (
					<Caption color="quaternary">Active</Caption>
				),
		},
		{
			key: "applications",
			header: "Applied · Accepted",
			sortKey: "applications",
			width: 132,
			align: "end",
			wideOnly: true,
			render: (user) => (
				<Caption color="tertiary">
					{user.applicationCount} · {user.acceptedCount}
				</Caption>
			),
		},
		{
			key: "pledges",
			header: "Pledges",
			sortKey: "pledges",
			width: 82,
			align: "end",
			wideOnly: true,
			render: (user) => <Caption color="tertiary">{user.pledgeCount}</Caption>,
		},
		{
			key: "joined",
			header: "Joined",
			sortKey: "createdAt",
			width: 104,
			align: "end",
			render: (user) => (
				<Caption color="quaternary">{formatDate(user.createdAt)}</Caption>
			),
		},
	];

	return (
		<AdminScreen
			title="Volunteers"
			subtitle="Identity verification, participation and standing"
			toolbar={
				<Toolbar
					search={search}
					onSearchChange={setSearch}
					searchPlaceholder="Search volunteers by name, email or phone"
					searchPending={search.trim() !== debouncedSearch}
					view={view}
					onViewChange={setView}
				>
					<SelectMenu
						label="Identity"
						value={identity}
						options={IDENTITY}
						onChange={setIdentity}
					/>
					<SelectMenu
						label="Standing"
						value={standing}
						options={STANDING}
						onChange={setStanding}
						minWidth={160}
					/>
				</Toolbar>
			}
			onNearEnd={list.loadMore}
			refreshing={list.query.isRefetching && !list.query.isFetchingNextPage}
			onRefresh={() => list.query.refetch()}
		>
			<ConsoleList
				query={list.query}
				items={list.items}
				total={list.total}
				loadMore={list.loadMore}
				noun="volunteer"
				view={view}
				columns={columns}
				rowKey={(user) => user.id}
				onRowPress={(user) => setSelected(user.id)}
				sort={sort}
				onSortChange={setSort}
				loadingLabel="Loading volunteers"
				renderCard={(user) => (
					<UserCard user={user} onPress={() => setSelected(user.id)} />
				)}
				empty={
					<EmptyState
						icon={Users}
						title={
							debouncedSearch ? "No matching volunteers" : "No volunteers yet"
						}
						description={
							debouncedSearch
								? "Try part of the name, or the email address."
								: "No volunteers match these filters."
						}
					/>
				}
			/>

			<UserDetailSheet userId={selected} onClose={() => setSelected(null)} />
		</AdminScreen>
	);
}

function UserCard({
	user,
	onPress,
}: {
	user: AdminUserListItem;
	onPress: () => void;
}) {
	const { spacing } = useTheme();

	return (
		<Surface onPress={onPress}>
			<View
				style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}
			>
				<InitialAvatar name={user.fullName ?? user.email} />
				<View style={{ flex: 1, minWidth: 0 }}>
					<Body weight="semibold" numberOfLines={1}>
						{user.fullName ?? "Unnamed"}
					</Body>
					<Caption color="tertiary" numberOfLines={1}>
						{user.email}
					</Caption>
				</View>
			</View>

			<View
				style={{
					flexDirection: "row",
					flexWrap: "wrap",
					alignItems: "center",
					gap: spacing[2],
					marginTop: spacing[3],
				}}
			>
				<StatusPill
					label={`ID ${humanizeStatus(user.verificationStatus).toLowerCase()}`}
					tone={verificationTone(user.verificationStatus)}
				/>
				{user.status === "SUSPENDED" && (
					<StatusPill label="Suspended" tone="error" />
				)}
				{!user.onboardedAt && (
					<StatusPill label="Onboarding incomplete" tone="neutral" />
				)}
			</View>

			<Caption color="quaternary" style={{ marginTop: spacing[2.5] }}>
				{user.applicationCount} application
				{user.applicationCount === 1 ? "" : "s"} · {user.acceptedCount} accepted
				· {user.pledgeCount} pledge{user.pledgeCount === 1 ? "" : "s"} · Joined{" "}
				{formatDate(user.createdAt)}
			</Caption>
		</Surface>
	);
}
