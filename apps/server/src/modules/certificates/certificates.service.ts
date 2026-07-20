import { randomBytes } from "node:crypto";
import type { db as dbType } from "@nabhya/db";
import {
	certificates,
	eventApplications,
	events,
	organizations,
	users,
} from "@nabhya/db/schema";
import { env } from "@nabhya/env/server";
import type {
	CertificateVerification,
	IssueCertificateInput,
	MarkAttendanceInput,
	PaginationQuery,
	RevokeCertificateInput,
} from "@nabhya/shared";
import {
	BadRequestException,
	ForbiddenException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { and, count, desc, eq } from "drizzle-orm";
import { AuditService } from "../../common/audit";
import { DB_TOKEN } from "../../common/database";
import { STORAGE_TOKEN, type StorageProvider } from "../../common/storage";
import { paginate, takeFirstOrThrow, toOffset } from "../../common/utils";
import { NotificationsService } from "../notifications/notifications.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { renderCertificatePdf } from "./certificate-pdf";

/** Unambiguous alphabet — no O/0 or I/1, since codes get read aloud and typed. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

@Injectable()
export class CertificatesService {
	constructor(
		@Inject(DB_TOKEN) private readonly db: typeof dbType,
		@Inject(AuditService) private readonly audit: AuditService,
		@Inject(STORAGE_TOKEN) private readonly storage: StorageProvider,
		@Inject(NotificationsService)
		private readonly notifications: NotificationsService,
		@Inject(OrganizationsService)
		private readonly organizationsService: OrganizationsService,
	) {}

	// ─── Attendance ──────────────────────────────────────────────────────────

	/**
	 * Records that an accepted volunteer actually turned up. This is the gate on
	 * certificate issuance, so it is deliberately a separate, explicit action
	 * rather than something inferred from the event's end date.
	 */
	async markAttendance(
		userId: string,
		eventId: string,
		applicationId: string,
		input: MarkAttendanceInput,
	) {
		const organization =
			await this.organizationsService.requireOwnedOrganization(userId);

		const application = await this.db.query.eventApplications.findFirst({
			where: and(
				eq(eventApplications.id, applicationId),
				eq(eventApplications.eventId, eventId),
			),
			with: { event: { columns: { organizationId: true } } },
		});

		if (!application) throw new NotFoundException("Application not found");
		if (application.event.organizationId !== organization.id) {
			throw new ForbiddenException(
				"That event belongs to another organization.",
			);
		}
		if (application.status !== "ACCEPTED") {
			throw new BadRequestException(
				"Only accepted volunteers can be marked as attended.",
			);
		}

		// Un-marking would orphan an issued certificate.
		if (!input.attended) {
			const existing = await this.db.query.certificates.findFirst({
				where: eq(certificates.applicationId, applicationId),
				columns: { id: true },
			});
			if (existing) {
				throw new BadRequestException(
					"Revoke the certificate before removing attendance.",
				);
			}
		}

		const [updated] = await this.db
			.update(eventApplications)
			.set({
				attendedAt: input.attended ? new Date() : null,
				updatedAt: new Date(),
			})
			.where(eq(eventApplications.id, applicationId))
			.returning();

		void this.audit.record({
			performedBy: userId,
			action: input.attended ? "MARK_ATTENDED" : "UNMARK_ATTENDED",
			entityName: "EVENT_APPLICATION",
			entityId: applicationId,
		});

		return updated;
	}

	// ─── Issuance ────────────────────────────────────────────────────────────

	/**
	 * Issues a certificate for an attended application.
	 *
	 * The record is created first and the PDF rendered after: a storage failure
	 * must not lose the certificate, and `pdfKey` staying null is a recoverable
	 * state that `regeneratePdf` can fix.
	 */
	async issue(
		userId: string,
		eventId: string,
		applicationId: string,
		input: IssueCertificateInput,
	) {
		const organization =
			await this.organizationsService.requireOwnedOrganization(userId);

		const application = await this.db.query.eventApplications.findFirst({
			where: and(
				eq(eventApplications.id, applicationId),
				eq(eventApplications.eventId, eventId),
			),
			with: {
				event: true,
				volunteer: { columns: { id: true, fullName: true, email: true } },
			},
		});

		if (!application) throw new NotFoundException("Application not found");
		if (application.event.organizationId !== organization.id) {
			throw new ForbiddenException(
				"That event belongs to another organization.",
			);
		}
		if (!application.attendedAt) {
			throw new BadRequestException(
				"Mark the volunteer as attended before issuing a certificate.",
			);
		}

		const existing = await this.db.query.certificates.findFirst({
			where: eq(certificates.applicationId, applicationId),
		});
		if (existing) {
			throw new BadRequestException(
				"A certificate has already been issued for this volunteer.",
			);
		}

		const certificate = takeFirstOrThrow(
			await this.db
				.insert(certificates)
				.values({
					applicationId,
					eventId,
					volunteerId: application.volunteerId,
					organizationId: organization.id,
					code: await this.generateUniqueCode(),
					note: input.note ?? null,
					issuedBy: userId,
				})
				.returning(),
			"issue certificate",
		);

		await this.generateAndStorePdf(certificate.id);

		void this.notifications.notify({
			userId: application.volunteerId,
			type: "CERTIFICATE_ISSUED",
			title: "Your certificate is ready",
			body: `${organization.organizationName} issued a certificate for "${application.event.title}".`,
			entityName: "CERTIFICATE",
			entityId: certificate.id,
		});

		void this.audit.record({
			performedBy: userId,
			action: "ISSUE_CERTIFICATE",
			entityName: "CERTIFICATE",
			entityId: certificate.id,
			newValue: { code: certificate.code },
		});

		return certificate;
	}

	async revoke(
		userId: string,
		certificateId: string,
		input: RevokeCertificateInput,
	) {
		const organization =
			await this.organizationsService.requireOwnedOrganization(userId);

		const certificate = await this.db.query.certificates.findFirst({
			where: eq(certificates.id, certificateId),
		});

		if (!certificate) throw new NotFoundException("Certificate not found");
		if (certificate.organizationId !== organization.id) {
			throw new ForbiddenException("That certificate belongs to another NGO.");
		}

		const [updated] = await this.db
			.update(certificates)
			.set({ revokedAt: new Date(), revokedReason: input.reason })
			.where(eq(certificates.id, certificateId))
			.returning();

		void this.audit.record({
			performedBy: userId,
			action: "REVOKE_CERTIFICATE",
			entityName: "CERTIFICATE",
			entityId: certificateId,
			newValue: { reason: input.reason },
		});

		return updated;
	}

	// ─── Reads ───────────────────────────────────────────────────────────────

	async listMine(volunteerId: string, query: PaginationQuery) {
		const where = eq(certificates.volunteerId, volunteerId);
		const { limit, offset } = toOffset(query);

		const [items, [totals]] = await Promise.all([
			this.db
				.select({
					id: certificates.id,
					code: certificates.code,
					note: certificates.note,
					pdfKey: certificates.pdfKey,
					issuedAt: certificates.issuedAt,
					revokedAt: certificates.revokedAt,
					event: {
						id: events.id,
						title: events.title,
						startAt: events.startAt,
						city: events.city,
					},
					organization: {
						id: organizations.id,
						organizationName: organizations.organizationName,
						logo: organizations.logo,
					},
				})
				.from(certificates)
				.innerJoin(events, eq(certificates.eventId, events.id))
				.innerJoin(
					organizations,
					eq(certificates.organizationId, organizations.id),
				)
				.where(where)
				.orderBy(desc(certificates.issuedAt))
				.limit(limit)
				.offset(offset),
			this.db.select({ value: count() }).from(certificates).where(where),
		]);

		return paginate(items, totals?.value ?? 0, query);
	}

	/**
	 * Public verification by code. No auth: the whole point is that a third
	 * party can check a certificate. Only what's needed to corroborate the
	 * claim is returned — never contact details.
	 */
	async verify(code: string): Promise<CertificateVerification> {
		const [row] = await this.db
			.select({
				code: certificates.code,
				note: certificates.note,
				issuedAt: certificates.issuedAt,
				revokedAt: certificates.revokedAt,
				revokedReason: certificates.revokedReason,
				volunteerName: users.fullName,
				organizationName: organizations.organizationName,
				eventTitle: events.title,
				eventDate: events.startAt,
			})
			.from(certificates)
			.innerJoin(users, eq(certificates.volunteerId, users.id))
			.innerJoin(events, eq(certificates.eventId, events.id))
			.innerJoin(
				organizations,
				eq(certificates.organizationId, organizations.id),
			)
			.where(eq(certificates.code, code.trim().toUpperCase()))
			.limit(1);

		if (!row) throw new NotFoundException("No certificate with that code");

		return {
			code: row.code,
			valid: !row.revokedAt,
			revoked: !!row.revokedAt,
			revokedReason: row.revokedReason,
			volunteerName: row.volunteerName,
			organizationName: row.organizationName,
			eventTitle: row.eventTitle,
			eventDate: row.eventDate.toISOString(),
			issuedAt: row.issuedAt.toISOString(),
			note: row.note,
		};
	}

	/** Signed link to the PDF, regenerating it if storage lost or never had it. */
	async getPdfUrl(userId: string, certificateId: string) {
		const certificate = await this.db.query.certificates.findFirst({
			where: eq(certificates.id, certificateId),
		});

		if (!certificate) throw new NotFoundException("Certificate not found");
		if (certificate.volunteerId !== userId) {
			throw new ForbiddenException("That certificate belongs to someone else.");
		}

		let key = certificate.pdfKey;
		if (!key || !(await this.storage.head(key))) {
			key = await this.generateAndStorePdf(certificate.id);
		}

		return { url: await this.storage.createDownloadUrl(key) };
	}

	// ─── Internals ───────────────────────────────────────────────────────────

	private async generateAndStorePdf(certificateId: string): Promise<string> {
		const [row] = await this.db
			.select({
				code: certificates.code,
				note: certificates.note,
				issuedAt: certificates.issuedAt,
				volunteerName: users.fullName,
				volunteerEmail: users.email,
				organizationName: organizations.organizationName,
				eventTitle: events.title,
				eventDate: events.startAt,
			})
			.from(certificates)
			.innerJoin(users, eq(certificates.volunteerId, users.id))
			.innerJoin(events, eq(certificates.eventId, events.id))
			.innerJoin(
				organizations,
				eq(certificates.organizationId, organizations.id),
			)
			.where(eq(certificates.id, certificateId))
			.limit(1);

		if (!row) throw new NotFoundException("Certificate not found");

		const formatDate = (value: Date) =>
			new Intl.DateTimeFormat("en-IN", {
				day: "numeric",
				month: "long",
				year: "numeric",
			}).format(value);

		const pdf = await renderCertificatePdf({
			code: row.code,
			// Falls back to the email local part when a volunteer never set a name.
			volunteerName:
				row.volunteerName ?? row.volunteerEmail.split("@")[0] ?? "Volunteer",
			organizationName: row.organizationName,
			eventTitle: row.eventTitle,
			eventDate: formatDate(row.eventDate),
			issuedAt: formatDate(row.issuedAt),
			note: row.note,
			verifyUrl: `${env.CORS_ORIGIN.split(",")[0]}/certificates/${row.code}`,
		});

		const key = `certificates/${certificateId}/${row.code}.pdf`;
		await this.storage.putObject({
			key,
			body: pdf,
			contentType: "application/pdf",
		});

		await this.db
			.update(certificates)
			.set({ pdfKey: key })
			.where(eq(certificates.id, certificateId));

		return key;
	}

	/** Retries on the astronomically unlikely collision rather than assuming. */
	private async generateUniqueCode(): Promise<string> {
		for (let attempt = 0; attempt < 5; attempt++) {
			const code = `NBH-${randomSegment(4)}-${randomSegment(4)}`;
			const clash = await this.db.query.certificates.findFirst({
				where: eq(certificates.code, code),
				columns: { id: true },
			});
			if (!clash) return code;
		}
		throw new BadRequestException(
			"Could not allocate a certificate code. Please retry.",
		);
	}
}

function randomSegment(length: number): string {
	const bytes = randomBytes(length);
	let out = "";
	for (let i = 0; i < length; i++) {
		out += CODE_ALPHABET[(bytes[i] as number) % CODE_ALPHABET.length];
	}
	return out;
}
