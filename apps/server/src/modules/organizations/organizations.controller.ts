import type {
	PaginationQuery,
	UpdateOrganizationInput,
	UploadOrgDocumentInput,
} from "@nabhya/shared";
import {
	paginationQuerySchema,
	updateOrganizationSchema,
	uploadOrgDocumentSchema,
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
import {
	ApiBearerAuth,
	ApiOperation,
	ApiQuery,
	ApiTags,
} from "@nestjs/swagger";
import { z } from "zod";
import { CurrentUser, Public, Roles } from "../../common/decorators";
import { ZodValidationPipe } from "../../common/pipes";
import type { AuthUser } from "../../common/types";
import { OrganizationsService } from "./organizations.service";

const publicOrgQuerySchema = paginationQuerySchema.extend({
	search: z.string().trim().max(120).optional(),
	city: z.string().trim().max(80).optional(),
});

@ApiTags("Organizations")
@Controller("organizations")
export class OrganizationsController {
	constructor(
		@Inject(OrganizationsService)
		private readonly organizationsService: OrganizationsService,
	) {}

	// ─── Public directory ────────────────────────────────────────────────────

	@Public()
	@Get()
	@ApiOperation({ summary: "Browse verified organizations (public)" })
	@ApiQuery({ name: "search", required: false })
	@ApiQuery({ name: "city", required: false })
	listPublic(
		@Query(new ZodValidationPipe(publicOrgQuerySchema))
		query: PaginationQuery & { search?: string; city?: string },
	) {
		return this.organizationsService.listPublic(query);
	}

	// ─── Caller's own organization ───────────────────────────────────────────
	// Declared before ":id" so "me" is never parsed as a UUID param.

	@Get("me")
	@Roles("organisation")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Get the organization owned by the caller" })
	getMine(@CurrentUser() user: AuthUser) {
		return this.organizationsService.getMyOrganization(user.id);
	}

	@Patch("me")
	@Roles("organisation")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Update the caller's organization profile" })
	updateMine(
		@CurrentUser() user: AuthUser,
		@Body(new ZodValidationPipe(updateOrganizationSchema))
		body: UpdateOrganizationInput,
	) {
		return this.organizationsService.updateMyOrganization(user.id, body);
	}

	@Get("me/documents")
	@Roles("organisation")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "List the organization's verification documents" })
	listDocuments(@CurrentUser() user: AuthUser) {
		return this.organizationsService.listDocuments(user.id);
	}

	@Post("me/documents")
	@Roles("organisation")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Submit a verification document" })
	uploadDocument(
		@CurrentUser() user: AuthUser,
		@Body(new ZodValidationPipe(uploadOrgDocumentSchema))
		body: UploadOrgDocumentInput,
	) {
		return this.organizationsService.uploadDocument(user.id, body);
	}

	// ─── Public detail ───────────────────────────────────────────────────────

	@Public()
	@Get(":id")
	@ApiOperation({ summary: "Get a verified organization's public profile" })
	getPublicById(@Param("id", ParseUUIDPipe) id: string) {
		return this.organizationsService.getPublicById(id);
	}
}
