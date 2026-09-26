import type { AuditLogSort, SortDir } from "@nabhya/shared";
import { ScrollText } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { AuditRow, auditTone } from "@/components/admin/audit-row";
import { ConsoleList } from "@/components/admin/console-list";
import type { TableColumn } from "@/components/admin/data-table";
import { AdminScreen } from "@/components/admin/list-chrome";
import { SelectMenu } from "@/components/admin/select-menu";
import { Toolbar } from "@/components/admin/toolbar";
import { EmptyState } from "@/components/screen-shell";
import { humanizeStatus } from "@/components/status-pill";
import { Body, Caption } from "@/components/ui/typography";
import { useAuditLogsPaged } from "@/hooks/use-admin-lists";
import { useTheme } from "@/hooks/use-theme";
import { useDebounced } from "@/hooks/useDebounced";
import { formatDateTime } from "@/lib/format";
import type { AuditLogEntry } from "@/lib/types";

type EntityFilter = "ALL" | "ORGANIZATION" | "USER" | "EVENT" | "DONATION";

const ENTITIES = [
	{ value: "ALL" as const, label: "Everything" },
	{ value: "ORGANIZATION" as const, label: "NGOs" },
	{ value: "USER" as const, label: "Users" },
	{ value: "EVENT" as const, label: "Events" },
	{ value: "DONATION" as const, label: "Donations" },
];

/**
 * The audit log.
 *
 * **A ledger, so it is a table and only a table** - no view switch. Cards would
 * be actively wrong here: every entry is the same four fields, nobody
 * *recognises* an audit entry, and the reason anyone opens this page is to
 * compare a column (who, when, what kind of action). It also never grids, for
 * the same reason a bank statement does not: a ledger has one axis.
 *
 * It also has no selection and no row press. There is nothing to do to an audit
 * entry - the record is the point - so a tick column would offer an action that
 * does not exist, and a hover state would promise a detail page that is not
 * there.
 *
 * The one column that is not plain type is a 6px dot by intent -
 * destructive, constructive, or neither. An operations admin scans this for the
 * one suspension among a hundred approvals, and that is a job for peripheral
 * vision, not for reading.
 */
export default function AdminAuditLog() {
	const { colors, spacing } = useTheme();
	const [entity, setEntity] = useState<EntityFilter>("ALL");
	const [search, setSearch] = useState("");
	const [sort, setSort] = useState<{ sort: AuditLogSort; dir: SortDir }>({
		sort: "createdAt",
		dir: "desc",
	});

	// The server matches `action` against SCREAMING_SNAKE values, so "suspend
	// org" has to become "SUSPEND_ORG" before it can match anything.
	const action = useDebounced(search.trim().toUpperCase().replace(/\s+/g, "_"));
	const list = useAuditLogsPaged({
		...(action ? { action } : {}),
		...(entity === "ALL" ? {} : { entityName: entity }),
		sort: sort.sort,
		dir: sort.dir,
	});

	const columns: Array<TableColumn<AuditLogEntry>> = [
		{
			key: "actor",
			header: "Who",
			width: 200,
			render: (entry) => {
				const tone = auditTone(entry.action);
				return (
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: spacing[2.5],
						}}
					>
						<View
							accessibilityElementsHidden
							importantForAccessibility="no-hide-descendants"
							style={{
								width: 6,
								height: 6,
								borderRadius: 3,
								backgroundColor:
									tone === "error"
										? colors.error.ink
										: tone === "success"
											? colors.success.ink
											: (colors.text.quaternary as string),
							}}
						/>
						<Body weight="medium" numberOfLines={1} style={{ flex: 1 }}>
							{entry.actor?.fullName ?? entry.actor?.email ?? "System"}
						</Body>
					</View>
				);
			},
		},
		{
			key: "action",
			header: "Action",
			sortKey: "action",
			minWidth: 220,
			render: (entry) => (
				<Caption color="secondary" numberOfLines={1}>
					{humanizeStatus(entry.action)}
				</Caption>
			),
		},
		{
			key: "entity",
			header: "On",
			minWidth: 180,
			wideOnly: true,
			render: (entry) => (
				<Caption color="quaternary" numberOfLines={1}>
					{entry.entityName
						? `${humanizeStatus(entry.entityName)}${
								entry.entityId ? ` ${entry.entityId.slice(0, 8)}` : ""
							}`
						: "-"}
				</Caption>
			),
		},
		{
			key: "when",
			header: "When",
			sortKey: "createdAt",
			width: 160,
			align: "end",
			// The absolute time, not "23 hours ago". A ledger is read to answer
			// "was this before or after that", and every row saying "23 hours ago"
			// - which is what the card list showed - cannot answer it. The card
			// view keeps the relative form, where there is room for one line only.
			render: (entry) => (
				<Caption color="quaternary" numberOfLines={1}>
					{formatDateTime(entry.createdAt)}
				</Caption>
			),
		},
	];

	return (
		<AdminScreen
			title="Activity"
			subtitle="Every moderation and lifecycle action, newest first"
			toolbar={
				<Toolbar
					search={search}
					onSearchChange={setSearch}
					searchPlaceholder="Filter by action, e.g. suspend"
					searchPending={
						search.trim().toUpperCase().replace(/\s+/g, "_") !== action
					}
					autoCapitalize="characters"
				>
					<SelectMenu
						label="On"
						value={entity}
						options={ENTITIES}
						onChange={setEntity}
						minWidth={180}
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
				noun="entry"
				plural="entries"
				// Fixed, not `useTableView`: see the note at the top of the file.
				view="table"
				columns={columns}
				rowKey={(entry) => entry.id}
				sort={sort}
				onSortChange={setSort}
				loadingLabel="Loading the log"
				renderCard={(entry) => <AuditRow entry={entry} />}
				empty={
					<EmptyState
						icon={ScrollText}
						title="Nothing recorded"
						description={
							action
								? "No actions match that filter."
								: "Moderation and lifecycle actions appear here as they happen."
						}
					/>
				}
			/>
		</AdminScreen>
	);
}
