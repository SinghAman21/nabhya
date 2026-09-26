import {
	type CanActivate,
	type ExecutionContext,
	ForbiddenException,
	Inject,
	Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY, type RoleType } from "../decorators";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import type { AuthUser } from "../types";

@Injectable()
export class RolesGuard implements CanActivate {
	constructor(@Inject(Reflector) private reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		if (isPublic) {
			return true;
		}

		const requiredRoles = this.reflector.getAllAndOverride<RoleType[]>(
			ROLES_KEY,
			[context.getHandler(), context.getClass()],
		);

		if (!requiredRoles || requiredRoles.length === 0) {
			return true;
		}

		const request = context.switchToHttp().getRequest();
		const user: AuthUser | undefined = request.user;

		if (!user?.roles?.length) {
			throw new ForbiddenException(
				"No account role is set. Choose a role to continue.",
			);
		}

		// OR semantics - holding any one of the listed roles is enough.
		if (!requiredRoles.some((role) => user.roles.includes(role))) {
			throw new ForbiddenException(
				`This action requires the ${requiredRoles.join(" or ")} role.`,
			);
		}

		return true;
	}
}
