import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { db as dbType } from "@nabhya/db";
import {
	announcements,
	bookmarks,
	financialReports,
	organizationAdmins,
	organizationOwnershipTransfers,
	organizations,
	roles,
	teamInvites,
	userRoles,
	users,
} from "@nabhya/db/schema";
import { env } from "@nabhya/env/server";
import type {
	ConfirmOwnershipTransferInput,
	CreateFinancialReportInput,
	InviteOrgAdminInput,
	InviteTeamMemberInput,
	MyAnnouncementQuery,
	PaginationQuery,
	TeamListQuery,
	TeamRole,
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
import { and, count, desc, eq, ne } from "drizzle-orm";
import { AuditService } from "../../common/audit";
import { DB_TOKEN } from "../../common/database";
import { MailService } from "../../common/mail";
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
		@Inject(MailService) private readonly mail: MailService,
	) {}

	// ─── Announcements ───────────────────────────────────────────────────────

	/**
	 * Publishing an update notifies everyone who bookmarked the organization -
	 * that is the whole point of a bookmark, and it is why announcements are
	 * worth having rather than being a static blob on the profile.
	 */
	async createAnnouncement(userId: string, input: UpsertAnnouncementInput) {
		if (input.status === "PUBLISHED") {
			await this.organizationsService.requireOrgPermission(
				userId,
				"content.publish",
			);
		}
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
		if (input.status === "PUBLISHED") {
			await this.organizationsService.requireOrgPermission(
				userId,
				"content.publish",
			);
		}

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
		await this.organizationsService.requireOrgPermission(
			userId,
			"content.delete",
		);
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
	async listMyAnnouncements(userId: string, query: MyAnnouncementQuery) {
		const organization =
			await this.organizationsService.requireOwnedOrganization(userId);

		const where = and(
			eq(announcements.organizationId, organization.id),
			query.status ? eq(announcements.status, query.status) : undefined,
		);
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
		await this.organizationsService.requireOrgPermission(
			userId,
			"reports.manage",
		);
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
	 * Public - these documents exist to be read by donors. Unlike verification
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
		await this.organizationsService.requireOrgPermission(
			userId,
			"reports.manage",
		);
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

	async listTeam(
		userId: string,
		query: Partial<TeamListQuery> = { status: "ACTIVE", includeLeft: false },
	) {
		const organization =
			await this.organizationsService.requireOwnedOrganization(userId);

		const conditions = [eq(organizationAdmins.organizationId, organization.id)];
		if (!query.includeLeft)
			conditions.push(ne(organizationAdmins.status, "LEFT"));
		if (query.status)
			conditions.push(eq(organizationAdmins.status, query.status));

		return this.db
			.select({
				id: organizationAdmins.id,
				userId: organizationAdmins.userId,
				designation: organizationAdmins.designation,
				role: organizationAdmins.role,
				status: organizationAdmins.status,
				isOwner: organizationAdmins.isOwner,
				isPublic: organizationAdmins.isPublic,
				joinedAt: organizationAdmins.joinedAt,
				leftAt: organizationAdmins.leftAt,
				lastActiveAt: organizationAdmins.lastActiveAt,
				user: {
					id: users.id,
					fullName: users.fullName,
					email: users.email,
					profileImage: users.profileImage,
				},
			})
			.from(organizationAdmins)
			.innerJoin(users, eq(organizationAdmins.userId, users.id))
			.where(and(...conditions))
			.orderBy(
				desc(organizationAdmins.isOwner),
				desc(organizationAdmins.joinedAt),
			);
	}

	async listPublicTeam(organizationId: string) {
		await this.organizationsService.assertPubliclyVisible(organizationId);

		return this.db
			.select({
				fullName: users.fullName,
				role: organizationAdmins.role,
				designation: organizationAdmins.designation,
				joinedAt: organizationAdmins.joinedAt,
			})
			.from(organizationAdmins)
			.innerJoin(users, eq(organizationAdmins.userId, users.id))
			.where(
				and(
					eq(organizationAdmins.organizationId, organizationId),
					eq(organizationAdmins.status, "ACTIVE"),
					eq(organizationAdmins.isPublic, true),
				),
			)
			.orderBy(
				desc(organizationAdmins.isOwner),
				desc(organizationAdmins.joinedAt),
			);
	}

	/** Legacy route: adds an existing account immediately for one release. */
	async inviteAdmin(userId: string, input: InviteOrgAdminInput) {
		const { organization } = await this.requireTeamPermission(
			userId,
			"team.invite",
		);
		const email = input.email.toLowerCase();

		const invitee = await this.db.query.users.findFirst({
			where: eq(users.email, email),
			columns: { id: true, email: true, fullName: true },
		});

		if (!invitee) {
			throw new NotFoundException(
				"No Nabhya account with that email. Use team invites for people who have not signed up yet.",
			);
		}

		await this.assertCanJoinTeam(invitee.id);
		const member = await this.addActiveMember({
			organizationId: organization.id,
			userId: invitee.id,
			role: input.role ?? "MEMBER",
			designation: input.designation ?? null,
			invitedBy: userId,
		});

		void this.notifications.notify({
			userId: invitee.id,
			type: "TEAM_INVITE_ACCEPTED",
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
			newValue: { email: invitee.email, role: member.role },
		});

		return member;
	}

	async createTeamInvite(userId: string, input: InviteTeamMemberInput) {
		const { organization } = await this.requireTeamPermission(
			userId,
			"team.invite",
		);
		await this.assertCanGrantRole(userId, organization.id, input.role);
		const email = input.email.toLowerCase();
		const activeCount = await this.db
			.select({ value: count() })
			.from(teamInvites)
			.where(
				and(
					eq(teamInvites.organizationId, organization.id),
					eq(teamInvites.status, "PENDING"),
				),
			);
		if ((activeCount[0]?.value ?? 0) >= 50) {
			throw new BadRequestException(
				"This organization has too many pending invites.",
			);
		}

		const [existingMember] = await this.db
			.select({ id: organizationAdmins.id })
			.from(organizationAdmins)
			.innerJoin(users, eq(organizationAdmins.userId, users.id))
			.where(
				and(
					eq(organizationAdmins.organizationId, organization.id),
					eq(organizationAdmins.status, "ACTIVE"),
					eq(users.email, email),
				),
			)
			.limit(1);
		if (existingMember)
			throw new ConflictException("They're already on your team.");

		const token = this.generateToken();
		const invite = takeFirstOrThrow(
			await this.db
				.insert(teamInvites)
				.values({
					organizationId: organization.id,
					email,
					role: input.role,
					designation: input.designation ?? null,
					tokenHash: this.hashToken(token),
					invitedBy: userId,
					expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
					lastSentAt: new Date(),
				})
				.returning(),
			"create team invite",
		);

		const invitee = await this.db.query.users.findFirst({
			where: eq(users.email, email),
			columns: { id: true },
		});
		if (invitee) {
			void this.notifications.notify({
				userId: invitee.id,
				type: "TEAM_INVITE",
				title: `Invitation to join ${organization.organizationName}`,
				body: `You've been invited as ${input.role.toLowerCase()}.`,
				entityName: "TEAM_INVITE",
				entityId: invite.id,
			});
		}

		void this.sendTeamInviteEmail({
			to: email,
			organizationName: organization.organizationName,
			role: input.role,
			designation: input.designation ?? null,
			token,
			expiresAt: invite.expiresAt,
		});

		void this.audit.record({
			performedBy: userId,
			action: "INVITE_TEAM_MEMBER",
			entityName: "TEAM_INVITE",
			entityId: invite.id,
			newValue: {
				email,
				role: input.role,
				designation: input.designation ?? null,
			},
		});

		return { ...invite, token, inviteUrl: this.inviteUrl(token) };
	}

	async listTeamInvites(userId: string) {
		const { organization } = await this.requireTeamPermission(
			userId,
			"team.invite",
		);
		return this.db.query.teamInvites.findMany({
			where: and(
				eq(teamInvites.organizationId, organization.id),
				eq(teamInvites.status, "PENDING"),
			),
			orderBy: desc(teamInvites.createdAt),
		});
	}

	async revokeTeamInvite(userId: string, inviteId: string) {
		const { organization } = await this.requireTeamPermission(
			userId,
			"team.invite",
		);
		const invite = await this.requireInviteInOrg(inviteId, organization.id);
		if (invite.status !== "PENDING") {
			throw new BadRequestException("Only pending invites can be revoked.");
		}

		const revoked = takeFirstOrThrow(
			await this.db
				.update(teamInvites)
				.set({
					status: "REVOKED",
					revokedAt: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(teamInvites.id, invite.id))
				.returning(),
			"revoke team invite",
		);

		void this.audit.record({
			performedBy: userId,
			action: "REVOKE_TEAM_INVITE",
			entityName: "TEAM_INVITE",
			entityId: invite.id,
		});

		return revoked;
	}

	async resendTeamInvite(userId: string, inviteId: string) {
		const { organization } = await this.requireTeamPermission(
			userId,
			"team.invite",
		);
		const invite = await this.requireInviteInOrg(inviteId, organization.id);
		this.assertPendingInvite(invite);

		const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
		if (
			invite.resentCount >= 3 &&
			(invite.lastSentAt?.getTime() ?? 0) > oneDayAgo
		) {
			throw new BadRequestException("This invite was resent too recently.");
		}

		const token = this.generateToken();
		const updated = takeFirstOrThrow(
			await this.db
				.update(teamInvites)
				.set({
					tokenHash: this.hashToken(token),
					resentCount: invite.resentCount + 1,
					lastSentAt: new Date(),
					expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
					updatedAt: new Date(),
				})
				.where(eq(teamInvites.id, invite.id))
				.returning(),
			"resend team invite",
		);

		void this.sendTeamInviteEmail({
			to: updated.email,
			organizationName: organization.organizationName,
			role: updated.role,
			designation: updated.designation,
			token,
			expiresAt: updated.expiresAt,
		});

		return { ...updated, token, inviteUrl: this.inviteUrl(token) };
	}

	async acceptTeamInvite(userId: string, token: string) {
		return this.acceptInvite(userId, await this.requireInviteByToken(token));
	}

	/**
	 * Accept from the in-app notification, which carries the invite's id - the
	 * token only ever travels in the email, so an invitee who never opened it
	 * had no way in. Safe for the same reason the token path is: the invite's
	 * email must equal the signed-in account's.
	 */
	async acceptTeamInviteById(userId: string, inviteId: string) {
		return this.acceptInvite(userId, await this.requireInviteById(inviteId));
	}

	private async acceptInvite(
		userId: string,
		invite: typeof teamInvites.$inferSelect,
	) {
		const user = await this.requireUser(userId);
		this.assertPendingInvite(invite);
		if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
			throw new ForbiddenException(
				"This invite was sent to a different email.",
			);
		}

		await this.assertCanJoinTeam(userId);

		const member = await this.db.transaction(async (tx) => {
			await this.grantOrganisationRole(tx, userId);
			const inserted = takeFirstOrThrow(
				await tx
					.insert(organizationAdmins)
					.values({
						organizationId: invite.organizationId,
						userId,
						designation: invite.designation,
						role: invite.role,
						status: "ACTIVE",
						isOwner: false,
						invitedBy: invite.invitedBy,
						invitedAt: invite.createdAt,
					})
					.returning(),
				"accept team invite",
			);
			await tx
				.update(teamInvites)
				.set({
					status: "ACCEPTED",
					acceptedBy: userId,
					acceptedAt: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(teamInvites.id, invite.id));
			return inserted;
		});

		void this.audit.record({
			performedBy: userId,
			action: "ACCEPT_TEAM_INVITE",
			entityName: "ORGANIZATION_ADMIN",
			entityId: member.id,
			newValue: { inviteId: invite.id, role: invite.role },
		});

		if (invite.invitedBy) {
			void this.notifications.notify({
				userId: invite.invitedBy,
				type: "TEAM_INVITE_ACCEPTED",
				title: `${user.fullName ?? user.email} joined your team`,
				body: `They accepted your invite as ${invite.role.toLowerCase()}.`,
				entityName: "ORGANIZATION_ADMIN",
				entityId: member.id,
			});
		}

		return member;
	}

	async declineTeamInvite(userId: string, token: string) {
		return this.declineInvite(userId, await this.requireInviteByToken(token));
	}

	/** Decline from the in-app notification - see `acceptTeamInviteById`. */
	async declineTeamInviteById(userId: string, inviteId: string) {
		return this.declineInvite(userId, await this.requireInviteById(inviteId));
	}

	private async declineInvite(
		userId: string,
		invite: typeof teamInvites.$inferSelect,
	) {
		const user = await this.requireUser(userId);
		this.assertPendingInvite(invite);
		if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
			throw new ForbiddenException(
				"This invite was sent to a different email.",
			);
		}

		const updated = takeFirstOrThrow(
			await this.db
				.update(teamInvites)
				.set({
					status: "DECLINED",
					declinedAt: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(teamInvites.id, invite.id))
				.returning(),
			"decline team invite",
		);

		void this.audit.record({
			performedBy: userId,
			action: "DECLINE_TEAM_INVITE",
			entityName: "TEAM_INVITE",
			entityId: invite.id,
		});

		return updated;
	}

	async updateAdmin(
		userId: string,
		memberId: string,
		input: UpdateOrgAdminInput,
	) {
		const actor = await this.requireTeamPermission(userId, "team.changeRole");
		const member = await this.requireOwnedMember(userId, memberId);
		if (
			(member.role === "OWNER" || member.isOwner) &&
			(input.role || input.status)
		) {
			throw new BadRequestException(
				"The owner can only be changed by ownership transfer.",
			);
		}
		const changes: Partial<typeof organizationAdmins.$inferInsert> = {
			updatedAt: new Date(),
		};

		if (input.role && input.role !== member.role) {
			this.assertCanChangeRole(
				"role" in actor ? actor.role : "OWNER",
				member.role,
				input.role,
			);
			changes.role = input.role;
			changes.isOwner = false;
		}
		if ("designation" in input) changes.designation = input.designation ?? null;
		if (input.isPublic !== undefined) changes.isPublic = input.isPublic;
		if (input.status !== undefined) changes.status = input.status;

		const updated = takeFirstOrThrow(
			await this.db
				.update(organizationAdmins)
				.set(changes)
				.where(eq(organizationAdmins.id, member.id))
				.returning(),
			"update team member",
		);

		void this.audit.record({
			performedBy: userId,
			action: input.role ? "CHANGE_TEAM_ROLE" : "UPDATE_ORG_ADMIN",
			entityName: "ORGANIZATION_ADMIN",
			entityId: member.id,
			oldValue: {
				role: member.role,
				designation: member.designation,
				isPublic: member.isPublic,
			},
			newValue: input,
		});

		if (changes.role) {
			void this.notifications.notify({
				userId: member.userId,
				type: "TEAM_ROLE_CHANGED",
				title: `You're now ${changes.role.toLowerCase()} on the team`,
				body: "What you can do for the organization has changed.",
				entityName: "ORGANIZATION",
				entityId: member.organizationId,
			});
		}

		return updated;
	}

	async removeAdmin(userId: string, memberId: string) {
		await this.requireTeamPermission(userId, "team.remove");
		const member = await this.requireOwnedMember(userId, memberId);

		if (member.role === "OWNER" || member.isOwner) {
			throw new BadRequestException(
				"The owner cannot be removed from the team. Transfer ownership first.",
			);
		}
		await this.assertCanRemove(userId, member);

		await this.db
			.update(organizationAdmins)
			.set({ status: "REMOVED", leftAt: new Date(), updatedAt: new Date() })
			.where(eq(organizationAdmins.id, member.id));

		void this.audit.record({
			performedBy: userId,
			action: "REMOVE_TEAM_MEMBER",
			entityName: "ORGANIZATION_ADMIN",
			entityId: memberId,
			oldValue: { role: member.role, status: member.status },
			newValue: { status: "REMOVED" },
		});

		void this.notifications.notify({
			userId: member.userId,
			type: "TEAM_REMOVED",
			title: "You were removed from the team",
			body: "You no longer have access to this organization.",
			entityName: "ORGANIZATION",
			entityId: member.organizationId,
		});

		return { removed: true };
	}

	async leaveTeam(userId: string) {
		const membership =
			await this.organizationsService.getActiveMembership(userId);
		if (!membership) throw new NotFoundException("Team membership not found.");
		if (membership.role === "OWNER") {
			throw new BadRequestException(
				"The owner must transfer ownership before leaving.",
			);
		}

		await this.db
			.update(organizationAdmins)
			.set({ status: "LEFT", leftAt: new Date(), updatedAt: new Date() })
			.where(eq(organizationAdmins.id, membership.id));

		void this.audit.record({
			performedBy: userId,
			action: "LEAVE_ORG_TEAM",
			entityName: "ORGANIZATION_ADMIN",
			entityId: membership.id,
			oldValue: { status: "ACTIVE" },
			newValue: { status: "LEFT" },
		});

		return { left: true };
	}

	async requestOwnershipTransfer(userId: string, toMemberId: string) {
		const membership = await this.requireOwner(userId);
		if (!("id" in membership)) {
			throw new BadRequestException("Owner membership row is missing.");
		}
		const target = await this.requireOwnedMember(userId, toMemberId);
		if (target.role !== "ADMIN" || target.status !== "ACTIVE") {
			throw new BadRequestException(
				"Ownership can only be transferred to an active admin.",
			);
		}

		const token = this.generateToken();
		const transfer = takeFirstOrThrow(
			await this.db
				.insert(organizationOwnershipTransfers)
				.values({
					organizationId: membership.organization.id,
					fromMemberId: membership.id,
					toMemberId: target.id,
					requestedBy: userId,
					tokenHash: this.hashToken(token),
					expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
				})
				.returning(),
			"request ownership transfer",
		);

		void this.audit.record({
			performedBy: userId,
			action: "REQUEST_ORG_OWNERSHIP_TRANSFER",
			entityName: "ORGANIZATION_OWNERSHIP_TRANSFER",
			entityId: transfer.id,
			newValue: { toMemberId: target.id },
		});

		return { ...transfer, token };
	}

	async confirmOwnershipTransfer(
		userId: string,
		input: ConfirmOwnershipTransferInput,
	) {
		const transfer = await this.requireTransferByToken(input.token);
		if (transfer.status !== "PENDING") {
			throw new ConflictException(
				"This ownership transfer has already been used.",
			);
		}
		if (transfer.expiresAt.getTime() <= Date.now()) {
			await this.expireTransfer(transfer.id);
			throw new BadRequestException("This ownership transfer has expired.");
		}

		const target = await this.db.query.organizationAdmins.findFirst({
			where: eq(organizationAdmins.id, transfer.toMemberId),
		});
		if (
			!target ||
			target.userId !== userId ||
			target.status !== "ACTIVE" ||
			target.role !== "ADMIN"
		) {
			throw new ForbiddenException(
				"Only the target active admin can confirm this transfer.",
			);
		}

		await this.db.transaction(async (tx) => {
			await tx
				.update(organizations)
				.set({ ownerUserId: target.userId, updatedAt: new Date() })
				.where(eq(organizations.id, transfer.organizationId));
			await tx
				.update(organizationAdmins)
				.set({ role: "ADMIN", isOwner: false, updatedAt: new Date() })
				.where(eq(organizationAdmins.id, transfer.fromMemberId));
			await tx
				.update(organizationAdmins)
				.set({ role: "OWNER", isOwner: true, updatedAt: new Date() })
				.where(eq(organizationAdmins.id, transfer.toMemberId));
			await tx
				.update(organizationOwnershipTransfers)
				.set({
					status: "CONFIRMED",
					confirmedBy: userId,
					confirmedAt: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(organizationOwnershipTransfers.id, transfer.id));
		});

		void this.audit.record({
			performedBy: userId,
			action: "TRANSFER_ORG_OWNERSHIP",
			entityName: "ORGANIZATION",
			entityId: transfer.organizationId,
			oldValue: { fromMemberId: transfer.fromMemberId },
			newValue: { toMemberId: transfer.toMemberId },
		});

		// The previous owner learns the handover completed (they are an admin now).
		const previous = await this.db.query.organizationAdmins.findFirst({
			where: eq(organizationAdmins.id, transfer.fromMemberId),
			columns: { userId: true },
		});
		if (previous) {
			void this.notifications.notify({
				userId: previous.userId,
				type: "OWNERSHIP_TRANSFERRED",
				title: "Ownership transferred",
				body: "The new owner confirmed. You remain on the team as an admin.",
				entityName: "ORGANIZATION",
				entityId: transfer.organizationId,
			});
		}

		return { transferred: true };
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

	private async requireTeamPermission(
		userId: string,
		action: Parameters<OrganizationsService["requireOrgPermission"]>[1],
	) {
		return this.organizationsService.requireOrgPermission(userId, action);
	}

	private async requireOwner(userId: string) {
		const membership =
			await this.organizationsService.getActiveMembership(userId);
		if (!membership) {
			const organization =
				await this.organizationsService.requireOwnedOrganization(userId);
			return { organization };
		}
		if (membership.role !== "OWNER") {
			throw new ForbiddenException("Only the owner can transfer ownership.");
		}
		return membership;
	}

	private async addActiveMember(input: {
		organizationId: string;
		userId: string;
		role: Exclude<TeamRole, "OWNER">;
		designation: string | null;
		invitedBy: string | null;
	}) {
		const existing = await this.db.query.organizationAdmins.findFirst({
			where: and(
				eq(organizationAdmins.organizationId, input.organizationId),
				eq(organizationAdmins.userId, input.userId),
				eq(organizationAdmins.status, "ACTIVE"),
			),
		});
		if (existing) throw new ConflictException("They're already on your team.");

		return this.db.transaction(async (tx) => {
			await this.grantOrganisationRole(tx, input.userId);
			return takeFirstOrThrow(
				await tx
					.insert(organizationAdmins)
					.values({
						organizationId: input.organizationId,
						userId: input.userId,
						designation: input.designation,
						role: input.role,
						status: "ACTIVE",
						isOwner: false,
						invitedBy: input.invitedBy,
						invitedAt: new Date(),
					})
					.returning(),
				"add organization admin",
			);
		});
	}

	/**
	 * Joining a team is what makes an account an NGO account, so the checks
	 * that role-select and onboarding make elsewhere have to be made here.
	 *
	 * - One team per account. `getActiveMembership` resolves the org an
	 *   `org/*` request acts on with `limit(1)`, so a second membership would
	 *   make every request act on whichever row Postgres returned first.
	 * - The role must be `organisation` or not yet chosen. Roles are picked
	 *   once (`UsersService.selectRole`) and every client route keys off the
	 *   first one, so a volunteer account that joined a team would still land
	 *   in the volunteer app with a membership it can never reach.
	 */
	private async assertCanJoinTeam(userId: string) {
		const [membership] = await this.db
			.select({ organizationName: organizations.organizationName })
			.from(organizationAdmins)
			.innerJoin(
				organizations,
				eq(organizationAdmins.organizationId, organizations.id),
			)
			.where(
				and(
					eq(organizationAdmins.userId, userId),
					eq(organizationAdmins.status, "ACTIVE"),
				),
			)
			.limit(1);
		const owned = membership
			? null
			: await this.db.query.organizations.findFirst({
					where: eq(organizations.ownerUserId, userId),
					columns: { organizationName: true },
				});
		const current = membership ?? owned;
		if (current) {
			throw new ConflictException(
				`This account is already on ${current.organizationName}'s team. An account can belong to one organization at a time.`,
			);
		}

		const held = await this.db
			.select({ name: roles.name })
			.from(userRoles)
			.innerJoin(roles, eq(userRoles.roleId, roles.id))
			.where(eq(userRoles.userId, userId));
		const other = held.find((role) => role.name !== "organisation");
		if (other) {
			throw new ForbiddenException(
				`This is a ${other.name} account. Team members need an organisation account - sign up with the invited email as an organisation, or ask for the invite to go to another address.`,
			);
		}
	}

	/** Grants `organisation` to an account that has no role yet. Idempotent. */
	private async grantOrganisationRole(
		tx: Parameters<Parameters<typeof dbType.transaction>[0]>[0],
		userId: string,
	) {
		const role = await tx.query.roles.findFirst({
			where: eq(roles.name, "organisation"),
			columns: { id: true },
		});
		if (!role) {
			throw new NotFoundException(
				'Role "organisation" is not configured. Run the database seed.',
			);
		}
		// `user_roles` has no unique index, so idempotency is a read first.
		const held = await tx.query.userRoles.findFirst({
			where: and(eq(userRoles.userId, userId), eq(userRoles.roleId, role.id)),
			columns: { id: true },
		});
		if (!held) await tx.insert(userRoles).values({ userId, roleId: role.id });
	}

	private async assertCanGrantRole(
		actorUserId: string,
		organizationId: string,
		role: TeamRole,
	) {
		const actor = await this.db.query.organizationAdmins.findFirst({
			where: and(
				eq(organizationAdmins.organizationId, organizationId),
				eq(organizationAdmins.userId, actorUserId),
				eq(organizationAdmins.status, "ACTIVE"),
			),
		});
		const actorRole = actor?.role ?? "OWNER";
		if (role === "OWNER") {
			throw new BadRequestException(
				"Ownership can only be changed by transfer.",
			);
		}
		if (actorRole === "ADMIN" && role === "ADMIN") {
			throw new ForbiddenException("Only the owner can invite another admin.");
		}
	}

	private async assertCanChangeRole(
		actorRole: TeamRole,
		currentRole: TeamRole,
		nextRole: Exclude<TeamRole, "OWNER">,
	) {
		if (currentRole === "OWNER") {
			throw new BadRequestException(
				"The owner can only be changed by transfer.",
			);
		}
		if (
			actorRole === "ADMIN" &&
			(currentRole === "ADMIN" || nextRole === "ADMIN")
		) {
			throw new ForbiddenException("Only the owner can change admin roles.");
		}
	}

	private async assertCanRemove(
		userId: string,
		member: typeof organizationAdmins.$inferSelect,
	) {
		const actor = await this.db.query.organizationAdmins.findFirst({
			where: and(
				eq(organizationAdmins.organizationId, member.organizationId),
				eq(organizationAdmins.userId, userId),
				eq(organizationAdmins.status, "ACTIVE"),
			),
		});
		const actorRole = actor?.role ?? "OWNER";
		if (actorRole === "ADMIN" && member.role === "ADMIN") {
			throw new ForbiddenException("Only the owner can remove another admin.");
		}
	}

	private async requireInviteInOrg(inviteId: string, organizationId: string) {
		const invite = await this.db.query.teamInvites.findFirst({
			where: eq(teamInvites.id, inviteId),
		});
		if (!invite) throw new NotFoundException("Team invite not found.");
		if (invite.organizationId !== organizationId) {
			throw new ForbiddenException(
				"That invite belongs to another organization.",
			);
		}
		return invite;
	}

	private async requireInviteByToken(token: string) {
		const tokenHash = this.hashToken(token);
		const invite = await this.db.query.teamInvites.findFirst({
			where: eq(teamInvites.tokenHash, tokenHash),
		});
		if (!invite || !this.constantTimeEqual(invite.tokenHash, tokenHash)) {
			throw new NotFoundException("Invite link not found.");
		}
		return invite;
	}

	private async requireInviteById(inviteId: string) {
		const invite = await this.db.query.teamInvites.findFirst({
			where: eq(teamInvites.id, inviteId),
		});
		if (!invite) throw new NotFoundException("Team invite not found.");
		return invite;
	}

	private async requireTransferByToken(token: string) {
		const tokenHash = this.hashToken(token);
		const transfer =
			await this.db.query.organizationOwnershipTransfers.findFirst({
				where: eq(organizationOwnershipTransfers.tokenHash, tokenHash),
			});
		if (!transfer || !this.constantTimeEqual(transfer.tokenHash, tokenHash)) {
			throw new NotFoundException("Ownership transfer link not found.");
		}
		return transfer;
	}

	private assertPendingInvite(invite: typeof teamInvites.$inferSelect) {
		if (invite.status === "ACCEPTED") {
			throw new ConflictException("This invite has already been accepted.");
		}
		if (invite.status === "REVOKED") {
			throw new BadRequestException("This invite has been revoked.");
		}
		if (invite.status === "DECLINED") {
			throw new BadRequestException("This invite has been declined.");
		}
		if (
			invite.status === "EXPIRED" ||
			invite.expiresAt.getTime() <= Date.now()
		) {
			throw new BadRequestException("This invite has expired.");
		}
	}

	private async expireTransfer(transferId: string) {
		await this.db
			.update(organizationOwnershipTransfers)
			.set({ status: "EXPIRED", updatedAt: new Date() })
			.where(eq(organizationOwnershipTransfers.id, transferId));
	}

	private async requireUser(userId: string) {
		const user = await this.db.query.users.findFirst({
			where: eq(users.id, userId),
			columns: { id: true, email: true, fullName: true },
		});
		if (!user) throw new NotFoundException("User not found.");
		return user;
	}

	private async sendTeamInviteEmail(input: {
		to: string;
		organizationName: string;
		role: string;
		designation?: string | null;
		token: string;
		expiresAt: Date;
	}) {
		try {
			await this.mail.sendTeamInvite({
				to: input.to,
				organizationName: input.organizationName,
				role: input.role,
				designation: input.designation,
				inviteUrl: this.inviteUrl(input.token),
				expiresAt: input.expiresAt,
			});
		} catch (error) {
			console.warn(
				`Failed to send team invite email to ${input.to}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	private inviteUrl(token: string) {
		const base =
			env.TEAM_INVITE_URL_BASE ?? env.CORS_ORIGIN.split(",")[0] ?? "";
		return `${base.replace(/\/$/, "")}/team/invites/${token}`;
	}

	private generateToken() {
		return randomBytes(32).toString("base64url");
	}

	private hashToken(token: string) {
		return createHash("sha256").update(token).digest("hex");
	}

	private constantTimeEqual(a: string, b: string) {
		const left = Buffer.from(a);
		const right = Buffer.from(b);
		return left.length === right.length && timingSafeEqual(left, right);
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
