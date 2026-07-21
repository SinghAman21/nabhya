import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthUser } from "../types";

/**
 * Injects the authenticated user attached by JwtGuard.
 *
 * On a @Public() route there is no user, so handlers that opt out of auth must
 * type the parameter as `AuthUser | undefined`.
 */
export const CurrentUser = createParamDecorator(
	(_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
		const request = ctx.switchToHttp().getRequest();
		return request.user;
	},
);
