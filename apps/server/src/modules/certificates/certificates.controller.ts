import type {
	IssueCertificateInput,
	MarkAttendanceInput,
	PaginationQuery,
	RevokeCertificateInput,
} from "@nabhya/shared";
import {
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
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
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
		summary: "Signed download link, regenerating the PDF if lost",
	})
	getPdf(
		@CurrentUser() user: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
	) {
		return this.certificatesService.getPdfUrl(user.id, id);
	}

	// ─── Public verification ─────────────────────────────────────────────────

	@Public()
	@Get("certificates/:code/verify")
	@ApiOperation({
		summary:
			"Verify a certificate by code. Public by design — a certificate is " +
			"only worth something if a third party can check it.",
	})
	verify(@Param("code") code: string) {
		return this.certificatesService.verify(code);
	}
}
