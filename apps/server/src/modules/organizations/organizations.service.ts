import type { db as dbType } from "@nabhya/db";
import {
	organizationCategories,
	organizationDocuments,
	organizations,
} from "@nabhya/db/schema";
import type {
	NearbyQuery,
	PaginationQuery,
	UpdateOrganizationInput,
	UploadOrgDocumentInput,
} from "@nabhya/shared";
import {
	ForbiddenException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { and, count, desc, eq, ilike, isNotNull, or, sql } from "drizzle-orm";
import { AuditService } from "../../common/audit";
import { DB_TOKEN } from "../../common/database";
import { paginate, takeFirstOrThrow, toOffset } from "../../common/utils";
import { UploadsService } from "../uploads/uploads.service";

@Injectable()
export class OrganizationsService {
	constructor(
		@Inject(DB_TOKEN) private readonly db: typeof dbType,
		@Inject(AuditService) private readonly audit: AuditService,
		@Inject(UploadsService) private readonly uploads: UploadsService,
	) {}

	/**
	 * Resolves the organization the caller acts on behalf of.
	 *
	 * Shared by the events and needs modules — every organisation-scoped write
	 * funnels through here so ownership is checked in exactly one place.
	 */
	async requireOwnedOrganization(userId: string) {
		const organization = await this.db.query.organizations.findFirst({
			where: eq(organizations.ownerUserId, userId),
		});

		if (!organization) {
			throw new NotFoundException(
				"No organization found for this account. Complete onboarding first.",
			);
		}

		if (organization.status === "SUSPENDED") {
			throw new ForbiddenException(
				"This organization is suspended and cannot perform this action.",
			);
		}

		return organization;
	}

	/**
	 * Publishing to the public feed is gated on verification — an unverified
	 * NGO can draft events and needs but cannot surface them to volunteers.
	 */
	async requireVerifiedOrganization(userId: string) {
		const organization = await this.requireOwnedOrganization(userId);

		if (organization.verificationStatus !== "VERIFIED") {
			throw new ForbiddenException(
				"Your organization must be verified before publishing publicly.",
			);
		}

		return organization;
	}

	async getMyOrganization(userId: string) {
		const organization = await this.requireOwnedOrganization(userId);
		return this.getById(organization.id);
	}

	async getById(organizationId: string) {
		const organization = await this.db.query.organizations.findFirst({
			where: eq(organizations.id, organizationId),
			with: {
				owner: {
					columns: { id: true, fullName: true, email: true, phone: true },
				},
				organizationCategories: { with: { category: true } },
			},
		});

		if (!organization) {
			throw new NotFoundException("Organization not found");
		}

		const { organizationCategories: orgCategories, ...rest } = organization;

		return {
			...rest,
			categories: orgCategories.map((oc) => oc.category),
		};
	}

	/** Public directory — only verified, active NGOs are ever listed. */
	async listPublic(
		query: PaginationQuery & { search?: string; city?: string },
	) {
		const conditions = [
			eq(organizations.verificationStatus, "VERIFIED"),
			eq(organizations.status, "ACTIVE"),
		];

		if (query.city) {
			conditions.push(ilike(organizations.city, `%${query.city}%`));
		}
		if (query.search) {
			const term = `%${query.search}%`;
			const match = or(
				ilike(organizations.organizationName, term),
				ilike(organizations.description, term),
			);
			if (match) conditions.push(match);
		}

		const where = and(...conditions);
		const { limit, offset } = toOffset(query);

		const [items, [totals]] = await Promise.all([
			this.db.query.organizations.findMany({
				where,
				limit,
				offset,
				orderBy: desc(organizations.createdAt),
				columns: {
					id: true,
					organizationName: true,
					description: true,
					logo: true,
					coverImage: true,
					city: true,
					state: true,
					website: true,
					verificationStatus: true,
				},
			}),
			this.db.select({ value: count() }).from(organizations).where(where),
		]);

		return paginate(items, totals?.value ?? 0, query);
	}

	/**
	 * "NGOs near me", ordered by distance.
	 *
	 * Haversine in SQL rather than PostGIS — one dependency fewer, and precise
	 * enough at city scale. The bounding-box pre-filter lets Postgres use the
	 * latitude index instead of computing a trig expression for every row.
	 */
	async listNearby(query: NearbyQuery) {
		const { latitude, longitude, radiusKm } = query;
		const { limit, offset } = toOffset(query);

		// ~111 km per degree of latitude; longitude narrows with the cosine.
		const latDelta = radiusKm / 111;
		const lonDelta =
			radiusKm / (111 * Math.cos((latitude * Math.PI) / 180) || 1);

		const distance = sql<number>`(
			6371 * acos(
				least(1, greatest(-1,
					cos(radians(${latitude}))
					* cos(radians(${organizations.latitude}::float8))
					* cos(radians(${organizations.longitude}::float8) - radians(${longitude}))
					+ sin(radians(${latitude}))
					* sin(radians(${organizations.latitude}::float8))
				))
			)
		)`;

		const where = and(
			eq(organizations.verificationStatus, "VERIFIED"),
			eq(organizations.status, "ACTIVE"),
			isNotNull(organizations.latitude),
			isNotNull(organizations.longitude),
			// Cheap bounding box first, so the trig below runs on far fewer rows.
			sql`${organizations.latitude}::float8
				between ${latitude - latDelta} and ${latitude + latDelta}`,
			sql`${organizations.longitude}::float8
				between ${longitude - lonDelta} and ${longitude + lonDelta}`,
			// The box is square; this trims the corners to a true radius. It lives
			// in WHERE rather than HAVING because nothing here is aggregated — and
			// that also lets the count query reuse the identical predicate.
			sql`${distance} <= ${radiusKm}`,
		);

		const [rows, [totals]] = await Promise.all([
			this.db
				.select({
					id: organizations.id,
					organizationName: organizations.organizationName,
					description: organizations.description,
					logo: organizations.logo,
					city: organizations.city,
					state: organizations.state,
					latitude: organizations.latitude,
					longitude: organizations.longitude,
					distanceKm: distance,
				})
				.from(organizations)
				.where(where)
				.orderBy(distance)
				.limit(limit)
				.offset(offset),
			this.db.select({ value: count() }).from(organizations).where(where),
		]);

		return paginate(
			rows.map((row) => ({
				...row,
				distanceKm: Math.round(Number(row.distanceKm) * 10) / 10,
			})),
			totals?.value ?? 0,
			query,
		);
	}

	async getPublicById(organizationId: string) {
		const organization = await this.getById(organizationId);

		if (
			organization.verificationStatus !== "VERIFIED" ||
			organization.status !== "ACTIVE"
		) {
			throw new NotFoundException("Organization not found");
		}

		return organization;
	}

	/**
	 * Cheap gate for the `@Public()` profile sub-feeds (announcements, financial
	 * reports, reviews, impact). Those take an org id straight from the URL, so
	 * without this an unverified or superadmin-suspended NGO's content would stay
	 * publicly readable even after its events/needs were pulled. Selects only the
	 * status columns — the caller already has the id it needs.
	 */
	async assertPubliclyVisible(organizationId: string) {
		const [organization] = await this.db
			.select({
				verificationStatus: organizations.verificationStatus,
				status: organizations.status,
			})
			.from(organizations)
			.where(eq(organizations.id, organizationId))
			.limit(1);

		if (
			!organization ||
			organization.verificationStatus !== "VERIFIED" ||
			organization.status !== "ACTIVE"
		) {
			throw new NotFoundException("Organization not found");
		}
	}

	async updateMyOrganization(userId: string, input: UpdateOrganizationInput) {
		const organization = await this.requireOwnedOrganization(userId);
		const { categoryIds, ...fields } = input;

		const updated = await this.db.transaction(async (tx) => {
			const rows = await tx
				.update(organizations)
				.set({
					...Object.fromEntries(
						Object.entries(fields).filter(([, v]) => v !== undefined),
					),
					updatedAt: new Date(),
				})
				.where(eq(organizations.id, organization.id))
				.returning();
			const row = takeFirstOrThrow(rows, "update organization");

			if (categoryIds) {
				await tx
					.delete(organizationCategories)
					.where(eq(organizationCategories.organizationId, organization.id));
				if (categoryIds.length > 0) {
					await tx
						.insert(organizationCategories)
						.values(
							categoryIds.map((categoryId) => ({
								organizationId: organization.id,
								categoryId,
							})),
						)
						.onConflictDoNothing();
				}
			}

			return row;
		});

		void this.audit.record({
			performedBy: userId,
			action: "UPDATE_ORGANIZATION",
			entityName: "ORGANIZATION",
			entityId: organization.id,
			oldValue: { organizationName: organization.organizationName },
			newValue: fields,
		});

		return this.getById(updated.id);
	}

	async listDocuments(userId: string) {
		const organization = await this.requireOwnedOrganization(userId);
		return this.db.query.organizationDocuments.findMany({
			where: eq(organizationDocuments.organizationId, organization.id),
			orderBy: desc(organizationDocuments.uploadedAt),
		});
	}

	async uploadDocument(userId: string, input: UploadOrgDocumentInput) {
		const organization = await this.requireOwnedOrganization(userId);

		// Confirm the object landed in storage before recording its key — the
		// client uploads directly, so this server never saw the bytes.
		await this.uploads.assertUploaded(input.documentKey);

		const document = takeFirstOrThrow(
			await this.db
				.insert(organizationDocuments)
				.values({
					organizationId: organization.id,
					documentType: input.documentType,
					documentKey: input.documentKey,
					verificationStatus: "PENDING",
				})
				.returning(),
			"upload organization document",
		);

		// A fresh document submission re-opens review for a rejected NGO.
		if (organization.verificationStatus === "REJECTED") {
			await this.db
				.update(organizations)
				.set({ verificationStatus: "PENDING", updatedAt: new Date() })
				.where(eq(organizations.id, organization.id));
		}

		void this.audit.record({
			performedBy: userId,
			action: "UPLOAD_ORG_DOCUMENT",
			entityName: "ORGANIZATION_DOCUMENT",
			entityId: document.id,
			newValue: { documentType: input.documentType },
		});

		return document;
	}
}
