import {
	eventApplications,
	events,
	needPledges,
	needs,
	organizations,
	roles,
	userDocuments,
	userRoles,
	users,
} from "@nabhya/db/schema";
import { eq } from "drizzle-orm";
import type { AuthUser } from "../src/common/types";
import type { TestDb } from "./harness";

let counter = 0;
const unique = () => `${Date.now()}-${++counter}`;

/** Seeds the three roles the app expects to exist. */
export async function seedRoles(db: TestDb) {
	await db
		.insert(roles)
		.values([
			{ name: "volunteer", description: "Volunteer" },
			{ name: "organisation", description: "Organisation" },
			{ name: "superadmin", description: "Superadmin" },
		])
		.onConflictDoNothing();
}

export async function createUser(
	db: TestDb,
	options: {
		role?: "volunteer" | "organisation" | "superadmin";
		fullName?: string;
		status?: "ACTIVE" | "SUSPENDED";
	} = {},
) {
	const [user] = await db
		.insert(users)
		.values({
			email: `user-${unique()}@example.com`,
			fullName: options.fullName ?? "Test User",
			status: options.status ?? "ACTIVE",
		})
		.returning();

	if (!user) throw new Error("factory: user insert returned nothing");

	if (options.role) {
		const role = await db.query.roles.findFirst({
			where: eq(roles.name, options.role),
		});
		if (!role) throw new Error(`factory: role ${options.role} not seeded`);
		await db.insert(userRoles).values({ userId: user.id, roleId: role.id });
	}

	return user;
}

/** The shape JwtGuard attaches to the request. */
export function authUserFor(
	user: { id: string; email: string; fullName: string | null },
	roleNames: Array<"volunteer" | "organisation" | "superadmin">,
): AuthUser {
	return {
		id: user.id,
		email: user.email,
		role: roleNames[0] ?? null,
		roles: roleNames,
		name: user.fullName,
	};
}

export async function createUserDocument(
	db: TestDb,
	userId: string,
	options: {
		documentType?:
			| "AADHAR_CARD"
			| "PAN_CARD"
			| "DRIVING_LICENSE"
			| "VOTER_ID"
			| "PASSPORT"
			| "SELFIE"
			| "OTHER";
		verificationStatus?: "PENDING" | "VERIFIED" | "REJECTED";
	} = {},
) {
	const [document] = await db
		.insert(userDocuments)
		.values({
			userId,
			documentType: options.documentType ?? "AADHAR_CARD",
			documentKey: `user-documents/${userId}/${unique()}-doc.jpg`,
			verificationStatus: options.verificationStatus ?? "PENDING",
		})
		.returning();

	if (!document) throw new Error("factory: user document insert failed");
	return document;
}

export async function createOrganization(
	db: TestDb,
	ownerUserId: string,
	options: {
		verificationStatus?: "PENDING" | "UNDER_REVIEW" | "VERIFIED" | "REJECTED";
		status?: "ACTIVE" | "SUSPENDED";
		name?: string;
	} = {},
) {
	const [organization] = await db
		.insert(organizations)
		.values({
			ownerUserId,
			organizationName: options.name ?? `Test NGO ${unique()}`,
			city: "Mumbai",
			state: "Maharashtra",
			verificationStatus: options.verificationStatus ?? "VERIFIED",
			status: options.status ?? "ACTIVE",
		})
		.returning();

	if (!organization) throw new Error("factory: organization insert failed");
	return organization;
}

export async function createEvent(
	db: TestDb,
	organizationId: string,
	options: {
		status?: "DRAFT" | "PUBLISHED" | "CANCELLED" | "COMPLETED";
		volunteersNeeded?: number;
		startAt?: Date;
		endAt?: Date;
		title?: string;
	} = {},
) {
	const startAt = options.startAt ?? new Date(Date.now() + 7 * 86_400_000);
	const [event] = await db
		.insert(events)
		.values({
			organizationId,
			title: options.title ?? `Test Event ${unique()}`,
			description: "A test event with a sufficiently long description.",
			city: "Mumbai",
			state: "Maharashtra",
			startAt,
			endAt: options.endAt ?? new Date(startAt.getTime() + 4 * 3_600_000),
			volunteersNeeded: options.volunteersNeeded ?? 5,
			status: options.status ?? "PUBLISHED",
		})
		.returning();

	if (!event) throw new Error("factory: event insert failed");
	return event;
}

export async function createApplication(
	db: TestDb,
	eventId: string,
	volunteerId: string,
	options: {
		status?: "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
		attendedAt?: Date | null;
	} = {},
) {
	const [application] = await db
		.insert(eventApplications)
		.values({
			eventId,
			volunteerId,
			status: options.status ?? "PENDING",
			attendedAt: options.attendedAt ?? null,
		})
		.returning();

	if (!application) throw new Error("factory: application insert failed");
	return application;
}

export async function createNeed(
	db: TestDb,
	organizationId: string,
	options: {
		type?: "WANT" | "OFFER";
		quantity?: number | null;
		unit?: string;
		status?: "OPEN" | "FULFILLED" | "CLOSED";
	} = {},
) {
	const [need] = await db
		.insert(needs)
		.values({
			organizationId,
			type: options.type ?? "WANT",
			title: `Test Need ${unique()}`,
			description: "Something the organization needs.",
			quantity: options.quantity === undefined ? 100 : options.quantity,
			unit: options.unit ?? "blankets",
			city: "Mumbai",
			state: "Maharashtra",
			status: options.status ?? "OPEN",
		})
		.returning();

	if (!need) throw new Error("factory: need insert failed");
	return need;
}

export async function createPledge(
	db: TestDb,
	needId: string,
	userId: string,
	options: { quantity?: number | null; status?: "PENDING" | "ACCEPTED" } = {},
) {
	const [pledge] = await db
		.insert(needPledges)
		.values({
			needId,
			userId,
			quantity: options.quantity === undefined ? 10 : options.quantity,
			status: options.status ?? "PENDING",
		})
		.returning();

	if (!pledge) throw new Error("factory: pledge insert failed");
	return pledge;
}
