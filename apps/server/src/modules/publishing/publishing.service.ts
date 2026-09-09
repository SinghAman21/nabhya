import type { db as dbType } from "@nabhya/db";
import {
	announcements,
	bookmarks,
	financialReports,
	organizationAdmins,
	users,
} from "@nabhya/db/schema";
import type {
	CreateFinancialReportInput,
	InviteOrgAdminInput,
	PaginationQuery,
	UpdateOrgAdminInput,
	UpsertAnnouncementInput,
} from "@nabhya/shared";
import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { and, count, desc, eq } from "drizzle-orm";
import { AuditService } from "../../common/audit";
import { DB_TOKEN } from "../../common/database";
import { paginate, takeFirstOrThrow, toOffset } from "../../common/utils";
import { NotificationsService } from "../notifications/notifications.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { UploadsService } from "../uploads/uploads.service";

@Injectable()
export class PublishingService {
	constructor(
		@Inject(DB_TOKEN) private readonly db: typeof dbType,
		@Inject(AuditService) private readonly audit: AuditService,
		@Inject(NotificationsService)
		private readonly notifications: NotificationsService,
		@Inject(OrganizationsService)
		private readonly organizationsService: OrganizationsService,
		@Inject(UploadsService) private readonly uploads: UploadsService,
	) {}

	// ─── Announcements ───────────────────────────────────────────────────────

	/**
	 * Publishing an update notifies everyone who bookmarked the organization —
	 * that is the whole point of a bookmark, and it is why announcements are
	 * worth having rather than being a static blob on the profile.
	 */
	async createAnnouncement(userId: string, input: UpsertAnnouncementInput) {
		const organization =
			await this.organizationsService.requireVerifiedOrganization(userId);

		const announcement = takeFirstOrThrow(
			await this.db
				.insert(announcements)
				.values({
					organizationId: organization.id,
					title: input.title,
					body: input.body,
					coverImageKey: input.coverImageKey ?? null,
					status: input.status,
					isPinned: input.isPinned,
					isUrgent: input.isUrgent,
					publishedAt: input.status === "PUBLISHED" ? new Date() : null,
					createdBy: userId,
				})
				.returning(),
			"create announcement",
		);

		if (input.status === "PUBLISHED") {
			await this.notifyFollowers(organization.id, {
				title: `${organization.organizationName} posted an update`,
				body: input.title,
				entityId: announcement.id,
			});
		}

		void this.audit.record({
			performedBy: userId,
			action: "CREATE_ANNOUNCEMENT",
			entityName: "ANNOUNCEMENT",
			entityId: announcement.id,
		});

		return announcement;
	}

	async updateAnnouncement(
		userId: string,
		announcementId: string,
		input: UpsertAnnouncementInput,
	) {
		const existing = await this.requireOwnedAnnouncement(
			userId,
			announcementId,
		);

		const [updated] = await this.db
			.update(announcements)
			.set({
				title: input.title,
				body: input.body,
				coverImageKey: input.coverImageKey ?? null,
				status: input.status,
				isPinned: input.isPinned,
				isUrgent: input.isUrgent,
				// Going from draft to published stamps the date; an edit to an
				// already-published post keeps its original publish time.
				publishedAt:
					input.status === "PUBLISHED"
						? (existing.publishedAt ?? new Date())
						: null,
				updatedAt: new Date(),
			})
			.where(eq(announcements.id, announcementId))
			.returning();

		return updated;
	}

	async deleteAnnouncement(userId: string, announcementId: string) {
		await this.requireOwnedAnnouncement(userId, announcementId);
		await this.db
			.delete(announcements)
			.where(eq(announcements.id, announcementId));
		return { deleted: true };
	}

	/** Public feed for an organization's profile. Drafts never surface. */
	async listAnnouncements(organizationId: string, query: PaginationQuery) {
		// A suspended or unverified NGO's announcements must not stay readable.
		await this.organizationsService.assertPubliclyVisible(organizationId);

		const where = and(
			eq(announcements.organizationId, organizationId),
			eq(announcements.status, "PUBLISHED"),
		);
		const { limit, offset } = toOffset(query);

		const [items, [totals]] = await Promise.all([
			this.db
				.select()
				.from(announcements)
				.where(where)
				// Pinned first, then newest.
				.orderBy(desc(announcements.isPinned), desc(announcements.publishedAt))
				.limit(limit)
				.offset(offset),
			this.db.select({ value: count() }).from(announcements).where(where),
		]);

		return paginate(items, totals?.value ?? 0, query);
	}

	/** The org's own list, including drafts. */
	async listMyAnnouncements(userId: string, query: PaginationQuery) {
		const organization =
			await this.organizationsService.requireOwnedOrganization(userId);

		const where = eq(announcements.organizationId, organization.id);
		const { limit, offset } = toOffset(query);

		const [items, [totals]] = await Promise.all([
			this.db
				.select()
				.from(announcements)
				.where(where)
				.orderBy(desc(announcements.createdAt))
				.limit(limit)
				.offset(offset),
			this.db.select({ value: count() }).from(announcements).where(where),
		]);

		return paginate(items, totals?.value ?? 0, query);
	}

	// ─── Financial reports ───────────────────────────────────────────────────

	async createFinancialReport(
		userId: string,
		input: CreateFinancialReportInput,
	) {
		const organization =
			await this.organizationsService.requireVerifiedOrganization(userId);

		// The client uploaded straight to storage; confirm it actually landed.
		await this.uploads.assertUploaded(input.documentKey);

		const report = takeFirstOrThrow(
			await this.db
				.insert(financialReports)
				.values({
					organizationId: organization.id,
					type: input.type,
					title: input.title,
					financialYear: input.financialYear,
					documentKey: input.documentKey,
					notes: input.notes ?? null,
					uploadedBy: userId,
				})
				.returning(),
			"create financial report",
		);

		void this.audit.record({
			performedBy: userId,
			action: "PUBLISH_FINANCIAL_REPORT",
			entityName: "FINANCIAL_REPORT",
			entityId: report.id,
			newValue: { financialYear: input.financialYear, type: input.type },
		});

		return report;
	}

	/**
	 * Public — these documents exist to be read by donors. Unlike verification
	 * documents, they carry no signed-URL ownership check beyond the caller
	 * being able to see the organization at all.
	 */
	async listFinancialReports(organizationId: string) {
		await this.organizationsService.assertPubliclyVisible(organizationId);

		return this.db
			.select()
			.from(financialReports)
			.where(eq(financialReports.organizationId, organizationId))
			.orderBy(desc(financialReports.financialYear));
	}

	async deleteFinancialReport(userId: string, reportId: string) {
		const organization =
			await this.organizationsService.requireOwnedOrganization(userId);

		const report = await this.db.query.financialReports.findFirst({
			where: eq(financialReports.id, reportId),
		});

		if (!report) throw new NotFoundException("Report not found");
		if (report.organizationId !== organization.id) {
			throw new ForbiddenException("That report belongs to another NGO.");
		}

		await this.db
			.delete(financialReports)
			.where(eq(financialReports.id, reportId));
		return { deleted: true };
	}

	// ─── Team management ─────────────────────────────────────────────────────

	async listTeam(userId: string) {
		const organization =
			await this.organizationsService.requireOwnedOrganization(userId);

		return this.db
			.select({
				id: organizationAdmins.id,
				designation: organizationAdmins.designation,
				isOwner: organizationAdmins.isOwner,
				joinedAt: organizationAdmins.joinedAt,
				user: {
					id: users.id,
					fullName: users.fullName,
					email: users.email,
					profileImage: users.profileImage,
				},
			})
			.from(organizationAdmins)
			.innerJoin(users, eq(organizationAdmins.userId, users.id))
			.where(eq(organizationAdmins.organizationId, organization.id))
			.orderBy(
				desc(organizationAdmins.isOwner),
				desc(organizationAdmins.joinedAt),
			);
	}

	/**
	 * Adds an existing account to the organization's team.
	 *
	 * Deliberately requires the person to have signed up already: silently
	 * creating an account from an email address would let anyone provision
	 * users, and the invitee never consented.
	 */
	async inviteAdmin(userId: string, input: InviteOrgAdminInput) {
		const organization =
			await this.organizationsService.requireOwnedOrganization(userId);

		const invitee = await this.db.query.users.findFirst({
			where: eq(users.email, input.email.toLowerCase()),
			columns: { id: true, email: true, fullName: true },
		});

		if (!invitee) {
			throw new NotFoundException(
				"No Nabhya account with that email. Ask them to sign up first.",
			);
		}

		const existing = await this.db.query.organizationAdmins.findFirst({
			where: and(
				eq(organizationAdmins.organizationId, organization.id),
				eq(organizationAdmins.userId, invitee.id),
			),
		});

		if (existing) {
			throw new ConflictException("They're already on your team.");
		}

		const member = takeFirstOrThrow(
			await this.db
				.insert(organizationAdmins)
				.values({
					organizationId: organization.id,
					userId: invitee.id,
					designation: input.designation ?? null,
					isOwner: false,
				})
				.returning(),
			"add organization admin",
		);

		void this.notifications.notify({
			userId: invitee.id,
			type: "BROADCAST",
			title: `You were added to ${organization.organizationName}`,
			body: input.designation
				? `You've been added as ${input.designation}.`
				: "You've been added to the organization's team.",
			entityName: "ORGANIZATION",
			entityId: organization.id,
		});

		void this.audit.record({
			performedBy: userId,
			action: "ADD_ORG_ADMIN",
			entityName: "ORGANIZATION_ADMIN",
			entityId: member.id,
			newValue: { email: invitee.email },
		});

		return member;
	}

	async updateAdmin(
		userId: string,
		memberId: string,
		input: UpdateOrgAdminInput,
	) {
		const member = await this.requireOwnedMember(userId, memberId);

		const [updated] = await this.db
			.update(organizationAdmins)
			.set({ designation: input.designation ?? null })
			.where(eq(organizationAdmins.id, member.id))
			.returning();

		return updated;
	}

	async removeAdmin(userId: string, memberId: string) {
		const member = await this.requireOwnedMember(userId, memberId);

		// Removing the owner would leave the organization unmanageable.
		if (member.isOwner) {
			throw new BadRequestException(
				"The owner cannot be removed from the team.",
			);
		}

		await this.db
			.delete(organizationAdmins)
			.where(eq(organizationAdmins.id, member.id));

		void this.audit.record({
			performedBy: userId,
			action: "REMOVE_ORG_ADMIN",
			entityName: "ORGANIZATION_ADMIN",
			entityId: memberId,
		});

		return { removed: true };
	}

	// ─── Internals ───────────────────────────────────────────────────────────

	private async requireOwnedAnnouncement(userId: string, id: string) {
		const organization =
			await this.organizationsService.requireOwnedOrganization(userId);

		const announcement = await this.db.query.announcements.findFirst({
			where: eq(announcements.id, id),
		});

		if (!announcement) throw new NotFoundException("Update not found");
		if (announcement.organizationId !== organization.id) {
			throw new ForbiddenException("That update belongs to another NGO.");
		}

		return announcement;
	}

	private async requireOwnedMember(userId: string, memberId: string) {
		const organization =
			await this.organizationsService.requireOwnedOrganization(userId);

		const member = await this.db.query.organizationAdmins.findFirst({
			where: eq(organizationAdmins.id, memberId),
		});

		if (!member) throw new NotFoundException("Team member not found");
		if (member.organizationId !== organization.id) {
			throw new ForbiddenException("They belong to another organization.");
		}

		return member;
	}

	/** Fans an update out to everyone who bookmarked the organization. */
	private async notifyFollowers(
		organizationId: string,
		payload: { title: string; body: string; entityId: string },
	) {
		const followers = await this.db
			.select({ userId: bookmarks.userId })
			.from(bookmarks)
			.where(eq(bookmarks.organizationId, organizationId));

		if (followers.length === 0) return;

		await this.notifications.notify(
			followers.map((follower) => ({
				userId: follower.userId,
				type: "BROADCAST" as const,
				title: payload.title,
				body: payload.body,
				entityName: "ANNOUNCEMENT",
				entityId: payload.entityId,
			})),
		);
	}
}
