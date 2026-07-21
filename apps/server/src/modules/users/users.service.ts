import type { db as dbType } from "@nabhya/db";
import {
	organizations,
	roles,
	userCategories,
	userDocuments,
	userRoles,
	users,
} from "@nabhya/db/schema";
import type {
	SelectableRole,
	UpdateUserProfileInput,
	UploadUserDocumentInput,
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

@Injectable()
export class UsersService {
	constructor(
		@Inject(DB_TOKEN) private readonly db: typeof dbType,
		@Inject(AuditService) private readonly audit: AuditService,
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
				updatedAt: new Date(),
			})
			.where(eq(users.id, userId))
			.returning();

		if (!updated) {
			throw new NotFoundException("User not found");
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
		// Re-uploading the same document type supersedes the previous attempt
		// rather than stacking duplicates in the verification queue.
		const document = takeFirstOrThrow(
			await this.db
				.insert(userDocuments)
				.values({
					userId,
					documentType: input.documentType,
					documentUrl: input.documentUrl,
					verificationStatus: "PENDING",
				})
				.returning(),
			"upload identity document",
		);

		await this.db
			.update(users)
			.set({ verificationStatus: "PENDING", updatedAt: new Date() })
			.where(eq(users.id, userId));

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
