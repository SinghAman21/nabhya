import type {
	ApplicationQuery,
	ApplyToEventInput,
	PublicEventQuery,
} from "@nabhya/shared";
import {
	applicationQuerySchema,
	applyToEventSchema,
	publicEventQuerySchema,
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
	ApiResponse,
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
import { EventsService } from "./events.service";

/**
 * The public event feed plus the volunteer's own application actions.
 * Organisation-side management lives in OrgEventsController.
 */
@ApiTags("Events")
@Controller("events")
export class EventsController {
	constructor(
		@Inject(EventsService) private readonly eventsService: EventsService,
	) {}

	@Public()
	@Get()
	@ApiOperation({
		summary: "Browse published events from verified NGOs (public)",
	})
	@ApiQuery({ name: "search", required: false })
	@ApiQuery({ name: "city", required: false })
	@ApiQuery({
		name: "when",
		required: false,
		enum: ["upcoming", "past", "all"],
	})
	@ApiQuery({ name: "organizationId", required: false })
	listPublic(
		@Query(new ZodValidationPipe(publicEventQuerySchema))
		query: PublicEventQuery,
	) {
		return this.eventsService.listPublic(query);
	}

	// Declared before ":id" so "me" is not parsed as a UUID.
	@Get("me/applications")
	@Roles("volunteer")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "List the volunteer's own event applications" })
	listMyApplications(
		@CurrentUser() user: AuthUser,
		@Query(new ZodValidationPipe(applicationQuerySchema))
		query: ApplicationQuery,
	) {
		return this.eventsService.listMyApplications(user.id, query);
	}

	@OptionalAuth()
	@Get(":id")
	@ApiOperation({
		summary:
			"Event detail. Signed-in volunteers also receive their own application.",
	})
	getPublicById(
		@Param("id", ParseUUIDPipe) id: string,
		@CurrentUser() user: AuthUser | undefined,
	) {
		return this.eventsService.getPublicById(id, user?.id);
	}

	@Post(":id/applications")
	@Roles("volunteer")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Apply to volunteer at an event" })
	@ApiResponse({
		status: 409,
		description: "Already applied, or event is full.",
	})
	apply(
		@CurrentUser() user: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
		@Body(new ZodValidationPipe(applyToEventSchema)) body: ApplyToEventInput,
	) {
		return this.eventsService.apply(user.id, id, body);
	}

	@Delete(":id/applications/me")
	@Roles("volunteer")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Withdraw the volunteer's application" })
	withdraw(
		@CurrentUser() user: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
	) {
		return this.eventsService.withdraw(user.id, id);
	}
}
