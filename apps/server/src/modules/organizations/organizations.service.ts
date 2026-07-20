import type { db as dbType } from "@nabhya/db";
import {
	organizationCategories,
	organizationDocuments,
	organizations,
} from "@nabhya/db/schema";
import type {
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
import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import type { AuditService } from "../../common/audit";
import { DB_TOKEN } from "../../common/database";
import { paginate, takeFirstOrThrow, toOffset } from "../../common/utils";

@Injectable()
export class OrganizationsService {
	constructor(
		@Inject(DB_TOKEN) private readonly db: typeof dbType,
		private readonly audit: AuditService,
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

		const document = takeFirstOrThrow(
			await this.db
				.insert(organizationDocuments)
				.values({
					organizationId: organization.id,
					documentType: input.documentType,
					documentUrl: input.documentUrl,
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
