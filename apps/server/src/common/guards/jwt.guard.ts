import type { db as dbType } from "@my-better-t-app/db";
import { users } from "@my-better-t-app/db/schema";
import { env } from "@my-better-t-app/env/server";
import {
	type CanActivate,
	type ExecutionContext,
	Inject,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { eq } from "drizzle-orm";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { DB_TOKEN } from "../database";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

@Injectable()
export class JwtGuard implements CanActivate {
	private readonly jwks = createRemoteJWKSet(new URL(env.NEON_AUTH_JWKS_URL));

	constructor(
		@Inject(Reflector) private reflector: Reflector,
		@Inject(DB_TOKEN) private db: typeof dbType,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
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
			const { payload } = await jwtVerify(token, this.jwks);

			if (!payload.sub || !payload.email) {
				throw new UnauthorizedException(
					"Invalid token payload: missing sub or email",
				);
			}

			// Upsert user in the database (Find or Create)
			let dbUser = await this.db.query.users.findFirst({
				where: eq(users.id, payload.sub),
			});

			if (!dbUser) {
				const [newUser] = await this.db
					.insert(users)
					.values({
						id: payload.sub,
						email: payload.email as string,
						name: (payload.name as string) || null,
					})
					.returning();

				if (!newUser) {
					throw new UnauthorizedException("Could not create user profile");
				}
				dbUser = newUser;
			}

			// Attach fully loaded user to request
			request.user = {
				id: dbUser.id,
				email: dbUser.email,
				role: dbUser.role,
			};

			return true;
		} catch (error) {
			throw new UnauthorizedException("Token validation failed");
		}
	}
}
