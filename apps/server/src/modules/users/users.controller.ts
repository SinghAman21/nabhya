import { Controller, Get } from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators";

@ApiTags("Users")
@Controller("users")
@ApiBearerAuth("access-token")
export class UsersController {
	@Get("me")
	@ApiOperation({ summary: "Get current user profile" })
	@ApiResponse({
		status: 200,
		description: "Returns the authenticated user's profile and role.",
	})
	getMe(@CurrentUser() user: any) {
		return user;
	}
}
