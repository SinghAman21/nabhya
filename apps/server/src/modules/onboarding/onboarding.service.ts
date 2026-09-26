import type { db as dbType } from "@nabhya/db";
import {
	organizationAdmins,
	organizationCategories,
	organizations,
	users,
} from "@nabhya/db/schema";
import {
	type CompleteOrgOnboardingInput,
	type CompleteVolunteerOnboardingInput,
	ORG_TYPE_TO_ENUM,
} from "@nabhya/shared";
import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { AuditService } from "../../common/audit";
import { DB_TOKEN } from "../../common/database";
import type { AuthUser } from "../../common/types";
import { takeFirstOrThrow } from "../../common/utils";
import { UsersService } from "../users/users.service";

export interface OnboardingStatus {
	role: string | null;
	needsRoleSelection: boolean;
	isOnboarded: boolean;
	/** Present only for organisation accounts. */
	organization: {
		id: string;
		organizationName: string;
		verificationStatus: string | null;
		status: string | null;
	} | null;
	verificationStatus: string | null;
}

@Injectable()
export class OnboardingService {
	constructor(
		@Inject(DB_TOKEN) private readonly db: typeof dbType,
		@Inject(AuditService) private readonly audit: AuditService,
		@Inject(UsersService) private readonly usersService: UsersService,
	) {}

	/**
	 * Single source of truth for "where should this user land?". The client
	 * routing gate calls this on launch instead of trusting persisted state.
	 */
	async getStatus(user: AuthUser): Promise<OnboardingStatus> {
		const dbUser = await this.db.query.users.findFirst({
			where: eq(users.id, user.id),
			columns: { onboardedAt: true, verificationStatus: true },
		});

		const role = user.roles[0] ?? null;

		if (role === "organisation") {
			const organization = await this.db.query.organizations.findFirst({
				where: eq(organizations.ownerUserId, user.id),
				columns: {
					id: true,
					organizationName: true,
					verificationStatus: true,
					status: true,
				},
			});

			return {
				role,
				needsRoleSelection: false,
				// For an NGO the organization row itself is the completion signal.
				isOnboarded: !!organization,
				organization: organization ?? null,
				verificationStatus: organization?.verificationStatus ?? null,
			};
		}

		return {
			role,
			needsRoleSelection: role === null,
			isOnboarded: !!dbUser?.onboardedAt,
			organization: null,
			verificationStatus: dbUser?.verificationStatus ?? null,
		};
	}

	/**
	 * Creates the NGO from the wizard payload and records the owner as its first
	 * admin. Every write shares a transaction so a failure cannot leave an
	 * organization without an owning admin row, or with half its causes.
	 *
	 * The logo is not part of this payload: its upload key can only be minted
	 * once the organization exists, so the client PATCHes it on afterwards.
	 */
	async completeOrganizationOnboarding(
		user: AuthUser,
		input: CompleteOrgOnboardingInput,
	) {
		const existing = await this.db.query.organizations.findFirst({
			where: eq(organizations.ownerUserId, user.id),
			columns: { id: true },
		});

		if (existing) {
			throw new ConflictException(
				"An organization already exists for this account.",
			);
		}

		const organization = await this.db.transaction(async (tx) => {
			const inserted = await tx
				.insert(organizations)
				.values({
					ownerUserId: user.id,
					organizationName: input.orgName,
					orgType: ORG_TYPE_TO_ENUM[input.orgType],
					registrationNumber: input.registrationNumber,
					phone: input.phone,
					email: user.email,
					address: input.address,
					city: input.city,
					state: input.state,
					pincode: input.pincode,
					// Decimal columns take strings; a raw number round-trips through
					// pg but drops precision the driver would have preserved.
					latitude:
						input.latitude !== undefined ? String(input.latitude) : null,
					longitude:
						input.longitude !== undefined ? String(input.longitude) : null,
					teamSize: input.teamSize ?? null,
					foundingYear: input.foundingYear ?? null,
					description: input.description ?? null,
					website: input.website || null,
					verificationStatus: "PENDING",
					status: "ACTIVE",
				})
				.returning();
			const created = takeFirstOrThrow(inserted, "create organization");

			// The feed's "For you" lens joins volunteers' interests through
			// `organization_categories`, so an NGO with none is unmatchable.
			const categoryIds = input.categoryIds ?? [];
			if (categoryIds.length > 0) {
				await tx
					.insert(organizationCategories)
					.values(
						categoryIds.map((categoryId) => ({
							organizationId: created.id,
							categoryId,
						})),
					)
					.onConflictDoNothing();
			}

			await tx.insert(organizationAdmins).values({
				organizationId: created.id,
				userId: user.id,
				designation: "Owner",
				role: "OWNER",
				status: "ACTIVE",
				isOwner: true,
			});

			await tx
				.update(users)
				.set({
					phone: input.phone,
					city: input.city,
					state: input.state,
					latitude:
						input.latitude !== undefined ? String(input.latitude) : null,
					longitude:
						input.longitude !== undefined ? String(input.longitude) : null,
					onboardedAt: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(users.id, user.id));

			return created;
		});

		void this.audit.record({
			performedBy: user.id,
			action: "COMPLETE_ORG_ONBOARDING",
			entityName: "ORGANIZATION",
			entityId: organization.id,
			newValue: { organizationName: organization.organizationName },
		});

		return organization;
	}

	async completeVolunteerOnboarding(
		user: AuthUser,
		input: CompleteVolunteerOnboardingInput,
	) {
		await this.db
			.update(users)
			.set({
				fullName: input.fullName,
				phone: input.phone,
				city: input.city,
				state: input.state,
				latitude: input.latitude !== undefined ? String(input.latitude) : null,
				longitude:
					input.longitude !== undefined ? String(input.longitude) : null,
				bio: input.bio ?? null,
				// Only overwrite the avatar when the wizard actually sent one, so
				// re-running the volunteer step never blanks an existing photo.
				...(input.profileImage ? { profileImage: input.profileImage } : {}),
				onboardedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(users.id, user.id));

		// The wizard submits every step at once and the schema defaults this to
		// [], so the selection is always authoritative - an empty one clears.
		await this.usersService.setInterests(user.id, input.categoryIds ?? []);

		void this.audit.record({
			performedBy: user.id,
			action: "COMPLETE_VOLUNTEER_ONBOARDING",
			entityName: "USER",
			entityId: user.id,
			newValue: { city: input.city, state: input.state },
		});

		return this.usersService.getProfile(user.id);
	}
}
