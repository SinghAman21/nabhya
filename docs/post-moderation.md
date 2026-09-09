# Admin Post Moderation

Superadmins can review and delete NGO feed posts from the admin console.

## Purpose

Use these endpoints inside the existing admin NGO dossier/sheets to show an NGO's published feed posts and let a superadmin remove inappropriate or incorrect posts.

The delete path reuses the existing feed deletion logic, so deleting a post also removes its attached media from storage and writes a `DELETE_POST` audit entry.

## Auth

All endpoints require a valid Supabase access token with the `superadmin` role.

```http
Authorization: Bearer <access-token>
```

---

## List an NGO's posts

```http
GET /api/admin/organizations/:id/posts
```

### Query params

| Param | Type | Required | Notes |
|---|---:|---:|---|
| `page` | number | No | Defaults to `1` |
| `limit` | number | No | Defaults to `20`, max `100` |
| `tag` | `POST \| EVENT \| NEED \| ANNOUNCEMENT \| URGENT` | No | Filters posts by feed tag |

### Example requests

```http
GET /api/admin/organizations/0f4f9c50-6f8a-45fb-b6af-53e9d74a3f4f/posts?page=1&limit=20
```

```http
GET /api/admin/organizations/0f4f9c50-6f8a-45fb-b6af-53e9d74a3f4f/posts?tag=URGENT
```

### Response shape

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

interface AdminOrgPost {
	id: string;
	tag: "POST" | "EVENT" | "NEED" | "ANNOUNCEMENT" | "URGENT";
	text: string;
	createdAt: string;
	author: {
		id: string;
		fullName: string | null;
		profileImage: string | null;
	};
	media: Array<{
		id: string;
		type: "IMAGE" | "VIDEO";
		url: string;
		sortOrder: number;
	}>;
}
```

---

## Delete a post as superadmin

```http
DELETE /api/admin/posts/:id
```

### Example request

```http
DELETE /api/admin/posts/8d3e0b03-7f25-48c0-bc81-12c83092f329
```

### Response shape

```ts
{
	deleted: true;
}
```

### Side effects

Deleting a post:

1. deletes the `posts` row
2. cascades related post media/interactions/comments through database foreign keys
3. deletes stored media objects through the storage provider
4. writes an audit log:

```ts
{
	action: "DELETE_POST";
	entityName: "POST";
	entityId: postId;
	performedBy: superadminUserId;
}
```

---

## Frontend API helpers

Defined in `apps/native/src/lib/api/services.ts`:

```ts
adminApi.organizationPosts(id, query);
adminApi.deletePost(id);
```

Endpoint constants live in `apps/native/src/lib/api/endpoints.ts`:

```ts
ADMIN.organizationPosts(id);
ADMIN.post(id);
```

Query keys live in `apps/native/src/lib/api/query-keys.ts`:

```ts
queryKeys.adminOrganizationPosts(id, params);
```

---

## Frontend hooks

Defined in `apps/native/src/hooks/use-admin.ts`:

```ts
useAdminOrganizationPosts(id, query);
useAdminDeletePost();
```

Defined in `apps/native/src/hooks/use-admin-lists.ts`:

```ts
useAdminOrganizationPostsPaged(id, query);
```

---

## Example: simple first-page list

```tsx
import { useAdminDeletePost, useAdminOrganizationPosts } from "@/hooks/use-admin";

export function AdminNgoPosts({ organizationId }: { organizationId: string }) {
	const posts = useAdminOrganizationPosts(organizationId, {
		page: 1,
		limit: 20,
	});
	const deletePost = useAdminDeletePost();

	if (posts.isLoading) return <LoadingState />;
	if (posts.isError) return <ErrorState message="Could not load posts" />;

	return (
		<View>
			{posts.data.items.map((post) => (
				<Surface key={post.id}>
					<Body weight="semibold">{post.tag}</Body>
					<Body color="secondary" numberOfLines={4}>
						{post.text}
					</Body>
					<Caption color="tertiary">
						By {post.author.fullName ?? "Unknown"}
					</Caption>
					<Button
						variant="destructive"
						loading={deletePost.isPending && deletePost.variables === post.id}
						onPress={() => deletePost.mutate(post.id)}
					>
						Delete post
					</Button>
				</Surface>
			))}
		</View>
	);
}
```

---

## Example: paged/infinite list

```tsx
import { useAdminDeletePost } from "@/hooks/use-admin";
import { useAdminOrganizationPostsPaged } from "@/hooks/use-admin-lists";

export function AdminNgoPostsList({ organizationId }: { organizationId: string }) {
	const posts = useAdminOrganizationPostsPaged(organizationId, {
		limit: 20,
	});
	const deletePost = useAdminDeletePost();

	return (
		<ConsoleList
			query={posts.query}
			items={posts.items}
			total={posts.total}
			loadMore={posts.loadMore}
			noun="post"
			rowKey={(post) => post.id}
			renderCard={(post) => (
				<Surface>
					<Body weight="semibold">{post.tag}</Body>
					<Body numberOfLines={4}>{post.text}</Body>
					<Button
						variant="destructive"
						onPress={() => deletePost.mutate(post.id)}
					>
						Delete
					</Button>
				</Surface>
			)}
		/>
	);
}
```

---

## Example: delete with confirmation

```tsx
import { confirm, toast } from "@/components/ui/overlay";
import { useAdminDeletePost } from "@/hooks/use-admin";
import { apiErrorMessage } from "@/lib/api";

const deletePost = useAdminDeletePost();

async function confirmDelete(postId: string) {
	const ok = await confirm({
		title: "Delete post?",
		message: "This removes the post from the feed and deletes its attached media.",
		confirmLabel: "Delete",
		destructive: true,
	});

	if (!ok) return;

	deletePost.mutate(postId, {
		onSuccess: () => toast.success("Post deleted."),
		onError: (error) => toast.error(apiErrorMessage(error)),
	});
}
```

---

## Notes for UI placement

Recommended placement: inside `OrgDetailSheet` in `apps/native/src/components/admin/org-detail-sheet.tsx`.

Suggested section order:

1. Organization facts
2. Owner account
3. Documents
4. Recent events/current stats
5. **Posts**
6. Decision controls

Keep destructive delete behind confirmation. A superadmin delete should feel like moderation, not a normal overflow option.
