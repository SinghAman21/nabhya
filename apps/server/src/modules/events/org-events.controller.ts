import type {
	ApplicationQuery,
	CreateEventInput,
	OrgEventQuery,
	ReviewApplicationInput,
	UpdateEventInput,
} from "@nabhya/shared";
import {
	applicationQuerySchema,
	createEventSchema,
	orgEventQuerySchema,
	reviewApplicationSchema,
	updateEventSchema,
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
import { EventsService } from "./events.service";

/**
 * Event management for the organization the caller owns. Every route resolves
 * the org from the token — an organization id is never accepted from the client.
 */
@ApiTags("Organization Events")
@Controller("org/events")
@Roles("organisation")
@ApiBearerAuth("access-token")
export class OrgEventsController {
	constructor(
		@Inject(EventsService) private readonly eventsService: EventsService,
	) {}

	@Get()
	@ApiOperation({ summary: "List the organization's events" })
	list(
		@CurrentUser() user: AuthUser,
		@Query(new ZodValidationPipe(orgEventQuerySchema)) query: OrgEventQuery,
	) {
		return this.eventsService.listForMyOrganization(user.id, query);
	}

	@Post()
	@ApiOperation({ summary: "Create an event" })
	@ApiResponse({
		status: 403,
		description: "Publishing requires a verified organization.",
	})
	create(
		@CurrentUser() user: AuthUser,
		@Body(new ZodValidationPipe(createEventSchema)) body: CreateEventInput,
	) {
		return this.eventsService.create(user.id, body);
	}

	@Patch(":id")
	@ApiOperation({ summary: "Update an event" })
	update(
		@CurrentUser() user: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
		@Body(new ZodValidationPipe(updateEventSchema)) body: UpdateEventInput,
	) {
		return this.eventsService.update(user.id, id, body);
	}

	@Delete(":id")
	@ApiOperation({
		summary:
			"Delete an event, or cancel it if volunteers have already been accepted",
	})
	remove(
		@CurrentUser() user: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
	) {
		return this.eventsService.remove(user.id, id);
	}

	@Get(":id/applications")
	@ApiOperation({ summary: "List applicants for an event" })
	listApplicants(
		@CurrentUser() user: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
		@Query(new ZodValidationPipe(applicationQuerySchema))
		query: ApplicationQuery,
	) {
		return this.eventsService.listApplicants(user.id, id, query);
	}

	@Patch(":id/applications/:applicationId")
	@ApiOperation({ summary: "Accept or reject an applicant" })
	@ApiResponse({ status: 409, description: "All volunteer places are filled." })
	reviewApplication(
		@CurrentUser() user: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
		@Param("applicationId", ParseUUIDPipe) applicationId: string,
		@Body(new ZodValidationPipe(reviewApplicationSchema))
		body: ReviewApplicationInput,
	) {
		return this.eventsService.reviewApplication(
			user.id,
			id,
			applicationId,
			body,
		);
	}
}
