import {
	type CanActivate,
	type ExecutionContext,
	Inject,
	Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY, type RoleType } from "../decorators";

@Injectable()
export class RolesGuard implements CanActivate {
	constructor(@Inject(Reflector) private reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const requiredRoles = this.reflector.getAllAndOverride<RoleType[]>(
			ROLES_KEY,
			[context.getHandler(), context.getClass()],
		);

		if (!requiredRoles || requiredRoles.length === 0) {
			return true;
		}

		const request = context.switchToHttp().getRequest();
		const user = request.user;

		if (!user || !user.roles) {
			return false;
		}

		// Check if the user has any of the required roles
		return requiredRoles.some((role) => user.roles.includes(role));
	}
}
