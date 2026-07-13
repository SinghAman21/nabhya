import { env } from "@my-better-t-app/env/server";
import {
	type CanActivate,
	type ExecutionContext,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import type { JwtService } from "@nestjs/jwt";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import type { JwtPayload } from "../types";

@Injectable()
export class JwtGuard implements CanActivate {
	constructor(
		private reflector: Reflector,
		private jwtService: JwtService,
	) {}

	canActivate(context: ExecutionContext): boolean {
		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		if (isPublic) {
			return true;
		}

		const request = context.switchToHttp().getRequest();
		const authHeader = request.headers.authorization;

		if (!authHeader) {
			throw new UnauthorizedException("Authorization header missing");
		}

		const token = authHeader.replace("Bearer ", "");

		if (!token) {
			throw new UnauthorizedException("Token missing");
		}

		try {
			const payload = this.jwtService.verify<JwtPayload>(token, {
				secret: env.ACCESS_TOKEN_SECRET,
			});

			if (payload.type !== "access") {
				throw new UnauthorizedException("Invalid token type");
			}

			// Attach user to request
			request.user = {
				id: payload.sub,
				email: payload.email,
				role: payload.role,
			};

			return true;
		} catch (error) {
			throw new UnauthorizedException("Token validation failed");
		}
	}
}
