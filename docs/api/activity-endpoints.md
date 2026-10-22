# Admin Activity & Analytics Endpoints

This document explains the new admin APIs for enhancing the existing superadmin console with activity timelines and chart-ready analytics.

These are additive endpoints for the current admin screens/drawers. No new screens are required.

## Auth

All endpoints require a valid Supabase access token with the `superadmin` role.

```http
Authorization: Bearer <access-token>
```

---

# 1. NGO activity timeline

```http
GET /api/admin/organizations/:id/activity
```

Use this inside an NGO dossier to show what the organization has been doing across the platform.

## Query params

| Param | Type | Required | Notes |
|---|---:|---:|---|
| `page` | number | No | Defaults to `1` |
| `limit` | number | No | Defaults to `20`, max `100` |
| `kind` | `AdminActivityKind` | No | Filters timeline to one activity type |

## Supported `kind` values

```ts
type AdminActivityKind =
	| "EVENT"
	| "NEED"
	| "ANNOUNCEMENT"
	| "REPORT"
	| "DOCUMENT"
	| "APPLICATION"
	| "PLEDGE"
	| "DONATION"
	| "REVIEW"
	| "CERTIFICATE"
	| "POST";
```

For NGO activity, the most useful kinds are:

- `EVENT`
- `NEED`
- `ANNOUNCEMENT`
- `REPORT`
- `DOCUMENT`
- `APPLICATION`
- `PLEDGE`
- `DONATION`
- `REVIEW`
- `POST`

## Example requests

```http
GET /api/admin/organizations/0f4f9c50-6f8a-45fb-b6af-53e9d74a3f4f/activity?page=1&limit=20
```

```http
GET /api/admin/organizations/0f4f9c50-6f8a-45fb-b6af-53e9d74a3f4f/activity?kind=DONATION
```

---

# 2. Volunteer/user activity timeline

```http
GET /api/admin/users/:id/activity
```

Use this inside a user/volunteer dossier to show their activity across the platform.

## Query params

| Param | Type | Required | Notes |
|---|---:|---:|---|
| `page` | number | No | Defaults to `1` |
| `limit` | number | No | Defaults to `20`, max `100` |
| `kind` | `AdminActivityKind` | No | Filters timeline to one activity type |

For volunteer activity, the most useful kinds
 are:

- `APPLICATION`
- `PLEDGE`
- `DONATION`
- `REVIEW`
- `CERTIFICATE`
- `DOCUMENT`
- `POST`

## Example requests

```http
GET /api/admin/users/7a0fb3d3-d72f-4f95-9f80-d76c9af3d184/activity?page=1&limit=20
```

```http
GET /api/admin/users/7a0fb3d3-d72f-4f95-9f80-d76c9af3d184/activity?kind=APPLICATION
```

---

# Activity response shape

Both timeline endpoints return the same shape.

The app response interceptor wraps this in `{ success, data, timestamp }`. The `data` value is a paginated envelope:

```ts
interface Paginated<T> {
	items: T[];
	meta: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
		hasMore: boolean;
	};
}
```

Timeline item:

```ts
interface AdminActivityItem {
	id: string;
	kind: AdminActivityKind;
	occurredAt: string;

	/** YYYY-MM-DD. Use this to group sections by day. */
	groupKey: string;

	/** Display label for the group. Currently same as groupKey. */
	groupLabel: string;

	title: string;
	description: string | null;
	status: string | null;

	amountMinor?: number | null;
	currency?: string | null;

	actor?: {
		id: string;
		name: string | null;

		email: string | null;
	} | null;

	subject?: {
		id: string;
		label: string;
		type?: string | null;
		status?: string | null;
	} | null;

	organization?: {
		id: string;
		organizationName: string;
	} | null;
}
```

## Why this shape is flexible

The backend returns a **flat paginated list**, but each item includes:

- `kind` - frontend can group/filter by activity type
- `groupKey` - frontend can group by day
- `status` - frontend can group by state, e.g. pending/accepted/completed
- `actor` - who did it

- `subject` - what the action was about
- `organization` - useful on volunteer activity timelines

This means frontend can render it as:

1. a plain chronological list
2. grouped by day
3. grouped by type
4. filtered tabs/chips by `kind`
5. status-based sections

without changing the backend contract.

---

# Frontend hooks

## Normal first-page hooks

Defined in `apps/native/src/hooks/use-admin.ts`:

```ts
useAdminOrganizationActivity(id, query);
useAdminUserActivity(id, query);
```

## Paged/infinite hooks

Defined in `apps/native/src/hooks/use-admin-lists.ts`:

```ts
useAdminOrganizationActivityPaged(id, query);
useAdminUserActivityPaged(id, query);
```

---

# Example: NGO activity in `OrgDetailSheet`

```tsx
import { useAdminOrganizationActivityPaged } from "@/hooks/use-admin-lists";

export function NgoActivityTimeline({ organizationId }: { organizationId: string }) {
	const activity = useAdminOrganizationActivityPaged(organizationId, {
		limit: 20,
	});

	return (
		<ConsoleList
			query={activity.query}
			items={activity.items}
			total={activity.total}
			loadMore={activity.loadMore}
			noun="activity item"
			rowKey={(item) => `${item.kind}:${item.id}`}
			renderCard={(item) => <ActivityCard item={item} />}
		/>
	);
}
```

---

# Example: volunteer activity in `UserDetailSheet`

```tsx
import { useAdminUserActivityPaged } from "@/hooks/use-admin-lists";

export function VolunteerActivityTimeline({ userId }: { userId: string }) {
	const activity = useAdminUserActivityPaged(userId, {
		limit: 20,
	});

	return (
		<ConsoleList
			query={activity.query}
			items={activity.items}
			total={activity.total}
			loadMore={activity.loadMore}
			noun="activity item"
			rowKey={(item) => `${item.kind}:${item.id}`}
			renderCard={(item) => <ActivityCard item={item} />}
		/>
	);
}
```

---

# Example: filter with tabs/chips

```tsx
import type { AdminActivityKind } from "@nabhya/shared";
import { useState } from "react";
import { useAdminOrganizationActivityPaged } from "@/hooks/use-admin-lists";

export function NgoActivityWithFilter({ organizationId }: { organizationId: string }) {
	const [kind, setKind] = useState<AdminActivityKind | undefined>();

	const activity = useAdminOrganizationActivityPaged(organizationId, {
		limit: 20,
		...(kind ? { kind } : {}),
	});

	return (
		<>
			<FilterChips
				value={kind ?? "ALL"}
				onChange={(next) => setKind(next === "ALL" ? undefined : next)}
				options={[
					"ALL",
					"EVENT",
					"NEED",
					"APPLICATION",
					"PLEDGE",
					"DONATION",
					"REVIEW",
					"POST",
				]}
			/>

			<ConsoleList
				query={activity.query}
				items={activity.items}
				total={activity.total}
				loadMore={activity.loadMore}
				noun="activity item"
				rowKey={(item) => `${item.kind}:${item.id}`}
				renderCard={(item) => <ActivityCard item={item} />}
			/>
		</>
	);
}
```

---

# Example: group by day on the frontend

```tsx
function groupActivityByDay(items: AdminActivityItem[]) {
	return items.reduce(
		(groups, item) => {
			const key = item.groupKey;

			if (!groups[key]) {
				groups[key] = {
					label: item.groupLabel,
					items: [],
				};
			}

			groups[key].items.push(item);
			return groups;
		},
		{} as Record<string, { label: string; items: AdminActivityItem[] }>,
	);
}
```

Render grouped sections:

```tsx
const groups = groupActivityByDay(activity.items);

return Object.entries(groups).map(([key, group]) => (
	<View key={key}>
		<SectionTitle>{group.label}</SectionTitle>

		{group.items.map((item) => (
			<ActivityRow key={`${item.kind}:${item.id}`} item={item} />
		))}
	</View>
));
```

---

# Example `ActivityCard`

```tsx
import type { AdminActivityItem } from "@nabhya/shared";

export function ActivityCard({ item }: { item: AdminActivityItem }) {
	return (
		<Surface>
			<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
				<Body weight="semibold" style={{ flex: 1 }}>
					{item.title}
				</Body>

				{item.status ? <StatusPill label={item.status} tone="neutral" /> : null}
			</View>

			{item.description ? (
				<Caption color="tertiary">{item.description}</Caption>
			) : null}

			{item.actor ? (
				<Caption color="quaternary">
					By {item.actor.name ?? item.actor.email ?? "Unknown"}
				</Caption>
			) : null}

			{item.amountMinor ? (
				<Caption color="tertiary">
					{item.currency ?? "INR"} {(item.amountMinor / 100).toLocaleString()}
				</Caption>
			) : null}
		</Surface>
	);
}
```

---

# 3. Analytics endpoint

```http
GET /api/admin/analytics
```

Use this for current dashboard visualization enhancements.

## Query params

| Param | Type | Required | Notes |
|---|---:|---:|---|
| `days` | `7 \| 30 \| 90` | No | Defaults to `30` |
| `limit` | number | No | Defaults to `10`, min `3`, max `25` |

## Example requests

```http
GET /api/admin/analytics?days=30&limit=10
```

```http
GET /api/admin/analytics?days=90&limit=15
```

---

# Analytics response shape

```ts
interface AdminAnalytics {
	windowDays: number;

	locations: {
		organizations: Array<{ label: string; value: number }>;
		volunteers: Array<{ label: string; value: number }>;
	};

	categories: {
		organizations: Array<{ label: string; value: number }>;
		volunteers: Array<{ label: string; value: number }>;
	};

	applicationFunnel: Array<{ label: string; value: number }>;

	reviewQueues: {
		pending: {
			organizationDocuments: number;
			userDocuments: number;
		};
		ageBuckets: Array<{
			label: string;
			orgDocuments: number;
			userDocuments: number;
		}>;
	};

	topOrganizations: Array<{
		id: string;
		organizationName: string;
		city: string | null;
		state: string | null;
		events: number;
		needs: number;
		applications: number;
		donationAmountMinor: number;
	}>;

	donations: {
		totalAmountMinor: number;
		completedCount: number;
		points: Array<{
			date: string;
			amountMinor: number;
			count: number;
		}>;
	};
}
```

---

# Frontend hook

Defined in `apps/native/src/hooks/use-admin.ts`:

```ts
useAdminAnalytics(query);
```

Example:

```tsx
import { useAdminAnalytics } from "@/hooks/use-admin";

export function AdminDashboardCharts() {
	const analytics = useAdminAnalytics({
		days: 30,
		limit: 10,
	});

	if (analytics.isLoading) return <LoadingState />;
	if (analytics.isError) return <ErrorState message="Could not load analytics" />;

	const data = analytics.data;

	return (
		<>
			<ChartCard title="NGOs by location">
				<BarChart data={data.locations.organizations} />
			</ChartCard>

			<ChartCard title="Volunteers by location">
				<BarChart data={data.locations.volunteers} />
			</ChartCard>

			<ChartCard title="Application funnel">
				<PipelineBar
					stages={data.applicationFunnel.map((row) => ({
						label: row.label,
						value: row.value,
					}))}
				/>
			</ChartCard>
		</>
	);
}
```

---

# Example: donation trend chart

```tsx
const analytics = useAdminAnalytics({ days: 30 });

const points = analytics.data?.donations.points ?? [];

<TrendChart
	labels={points.map((point) => point.date)}
	series={[
		{
			key: "donations",
			label: "Donations",
			values: points.map((point) => point.amountMinor),
		},
	]}
	totals={{
		donations: analytics.data?.donations.totalAmountMinor ?? 0,
	}}
/>;
```

Remember: `amountMinor` is in paise. Display rupees with:

```ts
const rupees = amountMinor / 100;
```

---

# Example: queue age buckets

```tsx
const analytics = useAdminAnalytics({ days: 30 });

const buckets = analytics.data?.reviewQueues.ageBuckets ?? [];

<StackedBarChart
	data={buckets.map((bucket) => ({
		label: bucket.label,
		ngoDocuments: bucket.orgDocuments,
		identityDocuments: bucket.userDocuments,
	}))}
/>;
```

Buckets are currently:

```ts
["<1 day", "1-3 days", "3-7 days", "7+ days"]
```

---

# Example: top organizations table/card

```tsx
const analytics = useAdminAnalytics({ days: 30, limit: 10 });

const rows = analytics.data?.topOrganizations ?? [];

rows.map((org) => (
	<Surface key={org.id}>
		<Body weight="semibold">{org.organizationName}</Body>
		<Caption color="tertiary">
			{org.city ?? "Unknown city"} · {org.events} events · {org.needs} needs ·{" "}
			{org.applications} applications
		</Caption>
		<Caption color="quaternary">
			Donations: ₹{(org.donationAmountMinor / 100).toLocaleString()}
		</Caption>
	</Surface>
));
```

---

# Files touched by backend implementation

Shared contracts:

- `packages/shared/src/admin.ts`

Server:

- `apps/server/src/modules/admin/admin.controller.ts`
- `apps/server/src/modules/admin/admin.service.ts`
- `apps/server/src/modules/admin/admin.module.ts`
- `apps/server/src/modules/feed/feed.service.ts`
- `apps/server/src/modules/feed/feed.module.ts`

Frontend access helpers:

- `apps/native/src/lib/api/endpoints.ts`
- `apps/native/src/lib/api/services.ts`
- `apps/native/src/lib/api/query-keys.ts`
- `apps/native/src/hooks/use-admin.ts`
- `apps/native/src/hooks/use-admin-lists.ts`

Tests:

- `apps/server/test/admin.spec.ts`
- `apps/server/test/endpoints.spec.ts`

---

# Validation run

Focused tests run:

```sh
pnpm --filter server test admin.spec.ts endpoints.spec.ts
```

Result:

```txt
Test Files  2 passed
Tests       44 passed
```

Note: the sandboxed terminal appended `/bin/sh: Cannot set tty process group`, but Vitest itself reported both specs passing.
