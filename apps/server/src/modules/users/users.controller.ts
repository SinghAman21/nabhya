import type {
	SelectRoleInput,
	UpdateUserProfileInput,
	UploadUserDocumentInput,
} from "@nabhya/shared";
import {
	selectRoleSchema,
	updateUserProfileSchema,
	uploadUserDocumentSchema,
} from "@nabhya/shared";
import { Body, Controller, Get, Inject, Patch, Post } from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators";
import { ZodValidationPipe } from "../../common/pipes";
import type { AuthUser } from "../../common/types";
import { UsersService } from "./users.service";

@ApiTags("Users")
@Controller("users")
@ApiBearerAuth("access-token")
export class UsersController {
	constructor(
		@Inject(UsersService) private readonly usersService: UsersService,
	) {}

	@Get("me")
	@ApiOperation({ summary: "Get the authenticated user's full profile" })
	@ApiResponse({
		status: 200,
		description:
			"Profile, assigned roles, interests and the owned organization (if any).",
	})
	getMe(@CurrentUser() user: AuthUser) {
		return this.usersService.getProfile(user.id);
	}

	@Patch("me")
	@ApiOperation({ summary: "Update the authenticated user's profile" })
	updateMe(
		@CurrentUser() user: AuthUser,
		@Body(new ZodValidationPipe(updateUserProfileSchema))
		body: UpdateUserProfileInput,
	) {
		return this.usersService.updateProfile(user.id, body);
	}

	@Post("me/role")
	@ApiOperation({ summary: "Choose an account role (one-shot)" })
	@ApiResponse({
		status: 409,
		description: "A role is already assigned to this account.",
	})
	selectRole(
		@CurrentUser() user: AuthUser,
		@Body(new ZodValidationPipe(selectRoleSchema)) body: SelectRoleInput,
	) {
		return this.usersService.selectRole(user.id, body.role);
	}

	@Get("me/documents")
	@ApiOperation({ summary: "List the user's identity documents" })
	listDocuments(@CurrentUser() user: AuthUser) {
		return this.usersService.listDocuments(user.id);
	}

	@Post("me/documents")
	@ApiOperation({ summary: "Submit an identity document for verification" })
	uploadDocument(
		@CurrentUser() user: AuthUser,
		@Body(new ZodValidationPipe(uploadUserDocumentSchema))
		body: UploadUserDocumentInput,
	) {
		return this.usersService.uploadDocument(user.id, body);
	}
}
