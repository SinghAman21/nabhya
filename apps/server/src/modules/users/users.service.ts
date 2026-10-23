import type { db as dbType } from "@nabhya/db";
import {
	organizations,
	roles,
	userCategories,
	userDocuments,
	userRoles,
	users,
} from "@nabhya/db/schema";
import {
	computeUserVerificationStatus,
	type SelectableRole,
	type UpdateUserProfileInput,
	type UploadUserDocumentInput,
} from "@nabhya/shared";
import {
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { and, desc, eq, inArray } from "drizzle-orm";
import { AuditService } from "../../common/audit";
import { DB_TOKEN } from "../../common/database";
import type { UserRole } from "../../common/types";
import { takeFirstOrThrow } from "../../common/utils";
import { UploadsService } from "../uploads/uploads.service";

@Injectable()
export class UsersService {
	constructor(
		@Inject(DB_TOKEN) private readonly db: typeof dbType,
		@Inject(AuditService) private readonly audit: AuditService,
		@Inject(UploadsService) private readonly uploads: UploadsService,
	) {}

	/**
	 * Full profile for the authenticated user, including the organization they
	 * own (if any) so the client can route without a second round trip.
	 */
	async getProfile(userId: string) {
		const user = await this.db.query.users.findFirst({
			where: eq(users.id, userId),
			with: { userRoles: { with: { role: true } } },
		});

		if (!user) {
			throw new NotFoundException("User not found");
		}

		const organization = await this.db.query.organizations.findFirst({
			where: eq(organizations.ownerUserId, userId),
			columns: {
				id: true,
				organizationName: true,
				verificationStatus: true,
				status: true,
				logo: true,
				city: true,
				state: true,
			},
		});

		const interests = await this.db
			.select({ categoryId: userCategories.categoryId })
			.from(userCategories)
			.where(eq(userCategories.userId, userId));

		const assignedRoles = user.userRoles.map(
			(ur) => ur.role.name,
		) as UserRole[];

		return {
			id: user.id,
			email: user.email,
			name: user.fullName,
			phone: user.phone,
			profileImage: user.profileImage,
			bio: user.bio,
			city: user.city,
			state: user.state,
			// The volunteer's own pin, when "use my location" set one - what
			// "NGOs near me" measures from before falling back to the city.
			latitude: user.latitude,
			longitude: user.longitude,
			emailVerified: user.emailVerified,
			verificationStatus: user.verificationStatus,
			status: user.status,
			onboardedAt: user.onboardedAt,
			role: assignedRoles[0] ?? null,
			roles: assignedRoles,
			interestCategoryIds: interests.map((i) => i.categoryId),
			organization: organization ?? null,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
		};
	}

	async updateProfile(userId: string, input: UpdateUserProfileInput) {
		const [updated] = await this.db
			.update(users)
			.set({
				...(input.fullName !== undefined && { fullName: input.fullName }),
				...(input.phone !== undefined && { phone: input.phone }),
				...(input.profileImage !== undefined && {
					profileImage: input.profileImage,
				}),
				...(input.bio !== undefined && { bio: input.bio }),
				...(input.city !== undefined && { city: input.city }),
				...(input.state !== undefined && { state: input.state }),
				...(input.latitude !== undefined && {
					latitude: input.latitude === null ? null : String(input.latitude),
				}),
				...(input.longitude !== undefined && {
					longitude: input.longitude === null ? null : String(input.longitude),
				}),
				updatedAt: new Date(),
			})
			.where(eq(users.id, userId))
			.returning();

		if (!updated) {
			throw new NotFoundException("User not found");
		}

		if (input.categoryIds !== undefined) {
			await this.setInterests(userId, input.categoryIds);
		}

		void this.audit.record({
			performedBy: userId,
			action: "UPDATE_PROFILE",
			entityName: "USER",
			entityId: userId,
			newValue: input,
		});

		return this.getProfile(userId);
	}

	/**
	 * Assigns the role chosen on the role-select screen.
	 *
	 * Self-selection is one-shot: once a user holds a role, changing it would
	 * silently re-home their organization and applications, so it must go
	 * through a superadmin instead.
	 */
	async selectRole(userId: string, role: SelectableRole) {
		const existing = await this.db.query.userRoles.findMany({
			where: eq(userRoles.userId, userId),
			with: { role: true },
		});

		if (existing.length > 0) {
			const current = existing.map((ur) => ur.role.name);
			if (current.includes(role)) {
				return { role, roles: current };
			}
			throw new ConflictException(
				"An account role is already set. Contact support to change it.",
			);
		}

		const roleRow = await this.db.query.roles.findFirst({
			where: eq(roles.name, role),
		});

		if (!roleRow) {
			throw new NotFoundException(
				`Role "${role}" is not configured. Run the database seed.`,
			);
		}

		await this.db.insert(userRoles).values({ userId, roleId: roleRow.id });

		void this.audit.record({
			performedBy: userId,
			action: "SELECT_ROLE",
			entityName: "USER",
			entityId: userId,
			newValue: { role },
		});

		return { role, roles: [role] };
	}

	/** Replaces the volunteer's interest set in one transaction. */
	async setInterests(userId: string, categoryIds: string[]) {
		await this.db.transaction(async (tx) => {
			await tx.delete(userCategories).where(eq(userCategories.userId, userId));
			if (categoryIds.length > 0) {
				await tx
					.insert(userCategories)
					.values(categoryIds.map((categoryId) => ({ userId, categoryId })))
					.onConflictDoNothing();
			}
		});
	}

	async listDocuments(userId: string) {
		return this.db.query.userDocuments.findMany({
			where: eq(userDocuments.userId, userId),
			orderBy: desc(userDocuments.uploadedAt),
		});
	}

	async uploadDocument(userId: string, input: UploadUserDocumentInput) {
		// The client uploaded straight to object storage, so confirm the object
		// really exists and is within limits before trusting the key.
		await this.uploads.assertUploaded(input.documentKey, {
			purpose: "USER_DOCUMENT",
			ownerId: userId,
		});

		// A liveness selfie can carry a second frame captured mid-challenge,
		// uploaded the same way; its key has to be verified before we trust it.
		const secondaryFrameKey = input.metadata?.liveness?.secondaryFrameKey;
		if (secondaryFrameKey) {
			await this.uploads.assertUploaded(secondaryFrameKey, {
				purpose: "USER_DOCUMENT",
				ownerId: userId,
			});
		}

		const document = await this.db.transaction(async (tx) => {
			// Re-uploading a document type supersedes the previous attempt rather
			// than stacking duplicates in the verification queue.
			await tx
				.delete(userDocuments)
				.where(
					and(
						eq(userDocuments.userId, userId),
						eq(userDocuments.documentType, input.documentType),
					),
				);

			const row = takeFirstOrThrow(
				await tx
					.insert(userDocuments)
					.values({
						userId,
						documentType: input.documentType,
						documentKey: input.documentKey,
						metadata: input.metadata ?? null,
						verificationStatus: "PENDING",
					})
					.returning(),
				"upload identity document",
			);

			// Verification needs a government ID *and* a selfie, both approved, so
			// derive the account status from the whole set rather than blindly
			// resetting it - a fresh upload can only move it off VERIFIED.
			const currentDocs = await tx
				.select({
					documentType: userDocuments.documentType,
					verificationStatus: userDocuments.verificationStatus,
				})
				.from(userDocuments)
				.where(eq(userDocuments.userId, userId));

			await tx
				.update(users)
				.set({
					verificationStatus: computeUserVerificationStatus(currentDocs),
					updatedAt: new Date(),
				})
				.where(eq(users.id, userId));

			return row;
		});

		void this.audit.record({
			performedBy: userId,
			action: "UPLOAD_USER_DOCUMENT",
			entityName: "USER_DOCUMENT",
			entityId: document.id,
			newValue: { documentType: input.documentType },
		});

		return document;
	}

	/** Used by the volunteer onboarding flow to mark completion. */
	async markOnboarded(userId: string) {
		await this.db
			.update(users)
			.set({ onboardedAt: new Date(), updatedAt: new Date() })
			.where(and(eq(users.id, userId), inArray(users.status, ["ACTIVE"])));
	}
}
