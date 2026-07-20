import type {
	CreateNeedInput,
	OrgNeedQuery,
	PaginationQuery,
	ReviewPledgeInput,
	UpdateNeedInput,
} from "@nabhya/shared";
import {
	createNeedSchema,
	orgNeedQuerySchema,
	paginationQuerySchema,
	reviewPledgeSchema,
	updateNeedSchema,
} from "@nabhya/shared";
import {
	Body,
	Controller,
	Delete,
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
	ApiResponse,
	ApiTags,
} from "@nestjs/swagger";
import { CurrentUser, Roles } from "../../common/decorators";
import { ZodValidationPipe } from "../../common/pipes";
import type { AuthUser } from "../../common/types";
import { NeedsService } from "./needs.service";

/**
 * "We need X" / "We're giving away Y" management for the caller's organization.
 */
@ApiTags("Organization Needs")
@Controller("org/needs")
@Roles("organisation")
@ApiBearerAuth("access-token")
export class OrgNeedsController {
	constructor(
		@Inject(NeedsService) private readonly needsService: NeedsService,
	) {}

	@Get()
	@ApiOperation({ summary: "List the organization's posts" })
	list(
		@CurrentUser() user: AuthUser,
		@Query(new ZodValidationPipe(orgNeedQuerySchema)) query: OrgNeedQuery,
	) {
		return this.needsService.listForMyOrganization(user.id, query);
	}

	@Post()
	@ApiOperation({ summary: "Post something the organization needs or offers" })
	@ApiResponse({
		status: 403,
		description: "Posting requires a verified organization.",
	})
	create(
		@CurrentUser() user: AuthUser,
		@Body(new ZodValidationPipe(createNeedSchema)) body: CreateNeedInput,
	) {
		return this.needsService.create(user.id, body);
	}

	@Patch(":id")
	@ApiOperation({ summary: "Update a post" })
	update(
		@CurrentUser() user: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
		@Body(new ZodValidationPipe(updateNeedSchema)) body: UpdateNeedInput,
	) {
		return this.needsService.update(user.id, id, body);
	}

	@Delete(":id")
	@ApiOperation({
		summary: "Delete a post, or close it if pledges have been accepted",
	})
	remove(
		@CurrentUser() user: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
	) {
		return this.needsService.remove(user.id, id);
	}

	@Get(":id/pledges")
	@ApiOperation({ summary: "List responses to a post" })
	listPledges(
		@CurrentUser() user: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
		@Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
	) {
		return this.needsService.listPledges(user.id, id, query);
	}

	@Patch(":id/pledges/:pledgeId")
	@ApiOperation({ summary: "Accept, reject or complete a pledge" })
	reviewPledge(
		@CurrentUser() user: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
		@Param("pledgeId", ParseUUIDPipe) pledgeId: string,
		@Body(new ZodValidationPipe(reviewPledgeSchema)) body: ReviewPledgeInput,
	) {
		return this.needsService.reviewPledge(user.id, id, pledgeId, body);
	}
}
