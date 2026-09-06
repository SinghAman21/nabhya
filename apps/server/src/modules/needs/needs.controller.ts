import type {
	CreatePledgeInput,
	PaginationQuery,
	PublicNeedQuery,
} from "@nabhya/shared";
import {
	createPledgeSchema,
	paginationQuerySchema,
	publicNeedQuerySchema,
} from "@nabhya/shared";
import {
	Body,
	Controller,
	Delete,
	Get,
	Inject,
	Param,
	ParseUUIDPipe,
	Post,
	Query,
} from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiOperation,
	ApiQuery,
	ApiTags,
} from "@nestjs/swagger";
import {
	CurrentUser,
	OptionalAuth,
	Public,
	Roles,
} from "../../common/decorators";
import { ZodValidationPipe } from "../../common/pipes";
import type { AuthUser } from "../../common/types";
import { NeedsService } from "./needs.service";

/**
 * Public feed of what NGOs need or are giving away, plus a volunteer's own
 * responses. Organisation-side management lives in OrgNeedsController.
 */
@ApiTags("Needs")
@Controller("needs")
export class NeedsController {
	constructor(
		@Inject(NeedsService) private readonly needsService: NeedsService,
	) {}

	@Public()
	@Get()
	@ApiOperation({ summary: "Browse open needs and offers (public)" })
	@ApiQuery({ name: "search", required: false })
	@ApiQuery({ name: "type", required: false, enum: ["WANT", "OFFER"] })
	@ApiQuery({
		name: "urgency",
		required: false,
		enum: ["LOW", "MEDIUM", "HIGH"],
	})
	@ApiQuery({ name: "city", required: false })
	listPublic(
		@Query(new ZodValidationPipe(publicNeedQuerySchema)) query: PublicNeedQuery,
	) {
		return this.needsService.listPublic(query);
	}

	@Get("me/pledges")
	@Roles("volunteer")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "List the caller's own pledges" })
	listMyPledges(
		@CurrentUser() user: AuthUser,
		@Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
	) {
		return this.needsService.listMyPledges(user.id, query);
	}

	@OptionalAuth()
	@Get(":id")
	@ApiOperation({ summary: "Need detail, including the caller's own pledge" })
	getPublicById(
		@Param("id", ParseUUIDPipe) id: string,
		@CurrentUser() user: AuthUser | undefined,
	) {
		return this.needsService.getPublicById(id, user?.id);
	}

	@Post(":id/pledges")
	@Roles("volunteer")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Offer to fulfil a need, or claim an offer" })
	pledge(
		@CurrentUser() user: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
		@Body(new ZodValidationPipe(createPledgeSchema)) body: CreatePledgeInput,
	) {
		return this.needsService.pledge(user.id, id, body);
	}

	@Delete(":id/pledges/me")
	@Roles("volunteer")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Withdraw your pending pledge" })
	withdrawPledge(
		@CurrentUser() user: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
	) {
		return this.needsService.withdrawPledge(user.id, id);
	}
}
