import type {
	BroadcastInput,
	MarkReadInput,
	NotificationQuery,
} from "@nabhya/shared";
import {
	broadcastSchema,
	markReadSchema,
	notificationQuerySchema,
} from "@nabhya/shared";
import { Body, Controller, Get, Inject, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser, Roles } from "../../common/decorators";
import { ZodValidationPipe } from "../../common/pipes";
import type { AuthUser } from "../../common/types";
import { NotificationsService } from "./notifications.service";

@ApiTags("Notifications")
@Controller("notifications")
@ApiBearerAuth("access-token")
export class NotificationsController {
	constructor(
		@Inject(NotificationsService)
		private readonly notificationsService: NotificationsService,
	) {}

	@Get()
	@ApiOperation({ summary: "The caller's inbox, newest first" })
	list(
		@CurrentUser() user: AuthUser,
		@Query(new ZodValidationPipe(notificationQuerySchema))
		query: NotificationQuery,
	) {
		return this.notificationsService.list(user.id, query);
	}

	@Get("unread-count")
	@ApiOperation({ summary: "Unread badge count" })
	unreadCount(@CurrentUser() user: AuthUser) {
		return this.notificationsService.unreadCount(user.id);
	}

	@Post("read")
	@ApiOperation({ summary: "Mark notifications read (all, if no ids given)" })
	markRead(
		@CurrentUser() user: AuthUser,
		@Body(new ZodValidationPipe(markReadSchema)) body: MarkReadInput,
	) {
		return this.notificationsService.markRead(user.id, body);
	}

	@Post("broadcast")
	@Roles("superadmin")
	@ApiOperation({ summary: "Send a platform-wide announcement" })
	broadcast(
		@CurrentUser() user: AuthUser,
		@Body(new ZodValidationPipe(broadcastSchema)) body: BroadcastInput,
	) {
		return this.notificationsService.broadcast(user.id, body);
	}
}
