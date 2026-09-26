import { notifications } from "@nabhya/db/schema";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NotificationsService } from "../src/modules/notifications/notifications.service";
import { createUser, seedRoles } from "./factories";
import { createTestDb, type TestDb, truncateAll } from "./harness";

describe("NotificationsService", () => {
	let db: TestDb;
	let close: () => Promise<void>;
	let service: NotificationsService;

	beforeAll(async () => {
		({ db, close } = await createTestDb());
		service = new NotificationsService(db as never);
	});

	afterAll(async () => {
		await close();
	});

	beforeEach(async () => {
		await truncateAll(db);
		await seedRoles(db);
	});

	const page = { page: 1, limit: 20 };

	describe("inbox", () => {
		it("shows a user only their own notifications", async () => {
			const [mine, theirs] = [
				await createUser(db, { role: "volunteer" }),
				await createUser(db, { role: "volunteer" }),
			];
			await service.notify([
				{ userId: mine.id, type: "BROADCAST", title: "For me" },
				{ userId: theirs.id, type: "BROADCAST", title: "For them" },
			]);

			const inbox = await service.list(mine.id, { ...page, unreadOnly: false });

			expect(inbox.items).toHaveLength(1);
			expect(inbox.items[0]?.title).toBe("For me");
			expect(inbox.meta.total).toBe(1);
		});

		it("keeps the unread badge counting everything, not just this page", async () => {
			// The badge is computed separately from the filtered list; if it were
			// derived from `items` it would under-report past the first page.
			const user = await createUser(db, { role: "volunteer" });
			await service.notify(
				Array.from({ length: 25 }, (_, i) => ({
					userId: user.id,
					type: "BROADCAST" as const,
					title: `Notice ${i}`,
				})),
			);

			const first = await service.list(user.id, {
				page: 1,
				limit: 10,
				unreadOnly: false,
			});

			expect(first.items).toHaveLength(10);
			expect(first.meta.total).toBe(25);
			expect(first.unreadCount).toBe(25);
		});

		it("filters to unread when asked", async () => {
			const user = await createUser(db, { role: "volunteer" });
			await service.notify([
				{ userId: user.id, type: "BROADCAST", title: "One" },
				{ userId: user.id, type: "BROADCAST", title: "Two" },
			]);

			const all = await service.list(user.id, { ...page, unreadOnly: false });
			const target = all.items[0];
			if (!target) throw new Error("expected a notification");

			await service.markRead(user.id, { ids: [target.id] });

			const unread = await service.list(user.id, {
				...page,
				unreadOnly: true,
			});
			expect(unread.items).toHaveLength(1);
			expect(unread.items[0]?.id).not.toBe(target.id);
		});
	});

	describe("markRead", () => {
		it("marks everything read when no ids are given", async () => {
			const user = await createUser(db, { role: "volunteer" });
			await service.notify([
				{ userId: user.id, type: "BROADCAST", title: "One" },
				{ userId: user.id, type: "BROADCAST", title: "Two" },
			]);

			const result = await service.markRead(user.id, {});

			expect(result.unreadCount).toBe(0);
		});

		it("cannot mark someone else's notification read", async () => {
			const [mine, theirs] = [
				await createUser(db, { role: "volunteer" }),
				await createUser(db, { role: "volunteer" }),
			];
			await service.notify({
				userId: theirs.id,
				type: "BROADCAST",
				title: "For them",
			});
			const [target] = await db.query.notifications.findMany();
			if (!target) throw new Error("expected a notification");

			await service.markRead(mine.id, { ids: [target.id] });

			const still = await db.query.notifications.findFirst({
				where: eq(notifications.id, target.id),
			});
			expect(still?.readAt).toBeNull();
		});

		it("leaves the original read timestamp alone on a second call", async () => {
			const user = await createUser(db, { role: "volunteer" });
			await service.notify({
				userId: user.id,
				type: "BROADCAST",
				title: "One",
			});

			await service.markRead(user.id, {});
			const [first] = await db.query.notifications.findMany();
			await service.markRead(user.id, {});
			const [second] = await db.query.notifications.findMany();

			expect(second?.readAt?.getTime()).toBe(first?.readAt?.getTime());
		});
	});

	describe("broadcast", () => {
		/**
		 * The audience filter is a correlated subquery written with interpolated
		 * Drizzle columns - the exact construct that has silently matched nothing
		 * elsewhere in this codebase. These assertions are about the SQL, not the
		 * business rule.
		 */
		it("reaches only volunteers when addressed to volunteers", async () => {
			const volunteer = await createUser(db, { role: "volunteer" });
			await createUser(db, { role: "organisation" });
			await createUser(db, { role: "superadmin" });

			const result = await service.broadcast(volunteer.id, {
				audience: "VOLUNTEERS",
				title: "Drive this weekend",
				body: "Come along.",
			});

			expect(result.delivered).toBe(1);
			const rows = await db.query.notifications.findMany();
			expect(rows).toHaveLength(1);
			expect(rows[0]?.userId).toBe(volunteer.id);
		});

		it("reaches only organisations when addressed to organisations", async () => {
			await createUser(db, { role: "volunteer" });
			const org = await createUser(db, { role: "organisation" });
			const admin = await createUser(db, { role: "superadmin" });

			const result = await service.broadcast(admin.id, {
				audience: "ORGANISATIONS",
				title: "New policy",
				body: "Please read.",
			});

			expect(result.delivered).toBe(1);
			const rows = await db.query.notifications.findMany();
			expect(rows[0]?.userId).toBe(org.id);
		});

		it("reaches everyone active when addressed to all", async () => {
			await createUser(db, { role: "volunteer" });
			await createUser(db, { role: "organisation" });
			const admin = await createUser(db, { role: "superadmin" });

			const result = await service.broadcast(admin.id, {
				audience: "ALL",
				title: "Maintenance tonight",
				body: "Back by 2am.",
			});

			expect(result.delivered).toBe(3);
		});

		it("skips suspended accounts", async () => {
			await createUser(db, { role: "volunteer", status: "SUSPENDED" });
			const active = await createUser(db, { role: "volunteer" });
			const admin = await createUser(db, { role: "superadmin" });

			const result = await service.broadcast(admin.id, {
				audience: "VOLUNTEERS",
				title: "Drive this weekend",
				body: "Come along.",
			});

			expect(result.delivered).toBe(1);
			const rows = await db.query.notifications.findMany();
			expect(rows[0]?.userId).toBe(active.id);
		});

		it("does not double-deliver to someone holding two roles", async () => {
			const admin = await createUser(db, { role: "superadmin" });
			const both = await createUser(db, { role: "volunteer" });
			await db.execute(
				`insert into user_roles (user_id, role_id)
				 select '${both.id}', id from roles where name = 'organisation'`,
			);

			const result = await service.broadcast(admin.id, {
				audience: "ALL",
				title: "Maintenance tonight",
				body: "Back by 2am.",
			});

			const rows = await db.query.notifications.findMany({
				where: eq(notifications.userId, both.id),
			});
			expect(rows).toHaveLength(1);
			expect(result.delivered).toBe(2);
		});

		it("delivers past a single insert chunk", async () => {
			// Recipients are inserted 500 at a time; the loop boundary is the part
			// worth proving, since an off-by-one silently drops people.
			const admin = await createUser(db, { role: "superadmin" });
			const values = Array.from(
				{ length: 600 },
				(_, i) => `('bulk-${i}@example.com', 'Bulk ${i}', 'ACTIVE')`,
			).join(",");
			await db.execute(
				`insert into users (email, full_name, status) values ${values}`,
			);

			const result = await service.broadcast(admin.id, {
				audience: "ALL",
				title: "Maintenance tonight",
				body: "Back by 2am.",
			});

			expect(result.delivered).toBe(601);
			expect(await db.query.notifications.findMany()).toHaveLength(601);
		});
	});

	describe("notify", () => {
		it("never throws, so a failed notification cannot roll back its action", async () => {
			// A non-existent recipient violates the FK; the caller must not care.
			await expect(
				service.notify({
					userId: "00000000-0000-0000-0000-000000000000",
					type: "BROADCAST",
					title: "Orphan",
				}),
			).resolves.toBeUndefined();
		});

		it("ignores an empty batch instead of issuing an invalid insert", async () => {
			await expect(service.notify([])).resolves.toBeUndefined();
		});
	});
});
