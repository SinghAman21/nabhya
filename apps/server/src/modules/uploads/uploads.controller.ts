import type { DownloadUrlInput, UploadIntentInput } from "@nabhya/shared";
import { downloadUrlSchema, uploadIntentSchema } from "@nabhya/shared";
import { Body, Controller, Inject, Post } from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser, OptionalAuth } from "../../common/decorators";
import { ZodValidationPipe } from "../../common/pipes";
import type { AuthUser } from "../../common/types";
import { UploadsService } from "./uploads.service";

/**
 * Direct-to-storage uploads. File bytes never pass through this server: the
 * client asks for a ticket, PUTs straight to Supabase Storage, then submits
 * the returned key to whichever endpoint owns the record.
 */
@ApiTags("Uploads")
@Controller("uploads")
@ApiBearerAuth("access-token")
export class UploadsController {
	constructor(
		@Inject(UploadsService) private readonly uploadsService: UploadsService,
	) {}

	// Each ticket is a signed write into our bucket; a loose limit here is an
	// invitation to fill it.
	@Throttle({ strict: { limit: 20, ttl: 60_000 } })
	@Post("intent")
	@ApiOperation({ summary: "Get a pre-signed URL to upload a file" })
	@ApiResponse({
		status: 201,
		description:
			"Returns { key, url, headers, expiresAt }. PUT the file to `url` with " +
			"`headers` verbatim, then send `key` to the endpoint that stores it.",
	})
	createIntent(
		@CurrentUser() user: AuthUser,
		@Body(new ZodValidationPipe(uploadIntentSchema)) body: UploadIntentInput,
	) {
		return this.uploadsService.createIntent(user, body);
	}

	@Post("download-url")
	@OptionalAuth()
	@ApiOperation({ summary: "Get a short-lived signed URL to read a file" })
	@ApiResponse({
		status: 403,
		description:
			"The caller cannot read this private file. Public NGO profile and report files can be read without signing in.",
	})
	createDownloadUrl(
		@CurrentUser() user: AuthUser | undefined,
		@Body(new ZodValidationPipe(downloadUrlSchema)) body: DownloadUrlInput,
	) {
		return this.uploadsService.createDownloadUrl(user, body.key);
	}
}
