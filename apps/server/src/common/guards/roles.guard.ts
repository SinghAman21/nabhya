import {
	type CanActivate,
	type ExecutionContext,
	Injectable,
} from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { ROLES_KEY, type RoleType } from "../decorators";

@Injectable()
export class RolesGuard implements CanActivate {
	constructor(private reflector: Reflector) {}

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

		if (!user) {
			return false;
		}

		return requiredRoles.includes(user.role);
	}
}
