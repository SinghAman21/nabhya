import type {
	BulkAttendanceInput,
	IssueCertificateInput,
	MarkAttendanceInput,
	PaginationQuery,
	RevokeCertificateInput,
} from "@nabhya/shared";
import {
	bulkAttendanceSchema,
	issueCertificateSchema,
	markAttendanceSchema,
	paginationQuerySchema,
	revokeCertificateSchema,
} from "@nabhya/shared";
import {
	Body,
	Controller,
	Get,
	Inject,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Query,
	Req,
	Res,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { CurrentUser, Public, Roles } from "../../common/decorators";
import { ZodValidationPipe } from "../../common/pipes";
import type { AuthUser } from "../../common/types";
import { CertificatesService } from "./certificates.service";

@ApiTags("Certificates")
@Controller()
export class CertificatesController {
	constructor(
		@Inject(CertificatesService)
		private readonly certificatesService: CertificatesService,
	) {}

	// ─── Organisation ────────────────────────────────────────────────────────

	@Post("org/events/:eventId/applications/bulk-attendance")
	@Roles("organisation")
	@ApiBearerAuth("access-token")
	@ApiOperation({
		summary:
			"Mark a selection of accepted volunteers present, or issue their " +
			"certificates. Returns per-volunteer outcomes.",
	})
	bulkAttendance(
		@CurrentUser() user: AuthUser,
		@Param("eventId", ParseUUIDPipe) eventId: string,
		@Body(new ZodValidationPipe(bulkAttendanceSchema))
		body: BulkAttendanceInput,
	) {
		return this.certificatesService.bulkAttendance(user.id, eventId, body);
	}

	@Patch("org/events/:eventId/applications/:applicationId/attendance")
	@Roles("organisation")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Mark whether an accepted volunteer attended" })
	markAttendance(
		@CurrentUser() user: AuthUser,
		@Param("eventId", ParseUUIDPipe) eventId: string,
		@Param("applicationId", ParseUUIDPipe) applicationId: string,
		@Body(new ZodValidationPipe(markAttendanceSchema))
		body: MarkAttendanceInput,
	) {
		return this.certificatesService.markAttendance(
			user.id,
			eventId,
			applicationId,
			body,
		);
	}

	@Post("org/events/:eventId/applications/:applicationId/certificate")
	@Roles("organisation")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Issue a certificate for an attended volunteer" })
	issue(
		@CurrentUser() user: AuthUser,
		@Param("eventId", ParseUUIDPipe) eventId: string,
		@Param("applicationId", ParseUUIDPipe) applicationId: string,
		@Body(new ZodValidationPipe(issueCertificateSchema))
		body: IssueCertificateInput,
	) {
		return this.certificatesService.issue(
			user.id,
			eventId,
			applicationId,
			body,
		);
	}

	@Patch("org/certificates/:id/revoke")
	@Roles("organisation")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Revoke a certificate (the code still resolves)" })
	revoke(
		@CurrentUser() user: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
		@Body(new ZodValidationPipe(revokeCertificateSchema))
		body: RevokeCertificateInput,
	) {
		return this.certificatesService.revoke(user.id, id, body);
	}

	// ─── Volunteer ───────────────────────────────────────────────────────────

	@Get("me/certificates")
	@Roles("volunteer")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "The caller's certificates" })
	listMine(
		@CurrentUser() user: AuthUser,
		@Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
	) {
		return this.certificatesService.listMine(user.id, query);
	}

	@Get("me/certificates/:id/pdf")
	@Roles("volunteer")
	@ApiBearerAuth("access-token")
	@ApiOperation({
		summary: "Link to the certificate's PDF (the public render route)",
	})
	getPdf(
		@CurrentUser() user: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
		@Req() req: Request,
	) {
		// This API's own public base, so the link works from any client:
		// `trust proxy` makes protocol and host the ones the client used.
		const apiBaseUrl = `${req.protocol}://${req.get("host")}/api`;
		return this.certificatesService.getPdfUrl(user.id, id, apiBaseUrl);
	}

	// ─── Public verification ─────────────────────────────────────────────────

	@Public()
	@Get("certificates/:code/verify")
	@ApiOperation({
		summary:
			"Verify a certificate by code. Public by design - a certificate is " +
			"only worth something if a third party can check it.",
	})
	verify(@Param("code") code: string) {
		return this.certificatesService.verify(code);
	}

	@Public()
	@Get("certificates/:code/pdf")
	@ApiOperation({
		summary:
			"The certificate as a PDF, rendered on request with a verification QR. " +
			"Public like verify: it shows nothing the verification page does not.",
	})
	async pdf(@Param("code") code: string, @Res() res: Response) {
		// Written directly: the global envelope interceptor would wrap a
		// returned buffer in { success, data } JSON.
		const { code: canonical, pdf } =
			await this.certificatesService.renderPdf(code);
		res
			.status(200)
			.set({
				"Content-Type": "application/pdf",
				"Content-Disposition": `inline; filename="nabhya-certificate-${canonical}.pdf"`,
				"Cache-Control": "no-store",
			})
			.send(Buffer.from(pdf));
	}
}
