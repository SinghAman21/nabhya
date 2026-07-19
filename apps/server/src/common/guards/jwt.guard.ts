import type { db as dbType } from "@nabhya/db";
import { roles, userRoles, users } from "@nabhya/db/schema";
import { env } from "@nabhya/env/server";
import {
	type CanActivate,
	type ExecutionContext,
	Inject,
	Injectable,
	Logger,
	UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { eq } from "drizzle-orm";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { DB_TOKEN } from "../database";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import type { NeonJwtPayload } from "../types";

@Injectable()
export class JwtGuard implements CanActivate {
	private readonly logger = new Logger(JwtGuard.name);
	private readonly neonJwks = createRemoteJWKSet(
		new URL(env.NEON_AUTH_JWKS_URL),
	);

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

		const [scheme, token] = authHeader.split(" ");

		if (scheme !== "Bearer" || !token) {
			throw new UnauthorizedException("Token missing");
		}

		try {
			const { payload } = await jwtVerify<NeonJwtPayload>(token, this.neonJwks);

			if (!payload.sub || !payload.email) {
				throw new UnauthorizedException(
					"Invalid token payload: missing sub or email",
				);
			}

			const dbUser = await this.syncNeonUser(payload);

			const roleRows = await this.db.query.userRoles.findMany({
				where: eq(userRoles.userId, dbUser.id),
				with: { role: true },
			});

			const assignedRoles = roleRows.map((ur) => ur.role.name);

			// Attach fully loaded user to request
			request.user = {
				id: dbUser.id,
				email: dbUser.email,
				role: assignedRoles[0] ?? "volunteer",
				roles: assignedRoles,
				name: dbUser.fullName,
			};

			return true;
		} catch (error) {
			if (error instanceof UnauthorizedException) throw error;
			this.logger.warn(
				`Neon JWT verification failed: ${error instanceof Error ? error.message : String(error)}`,
			);
			throw new UnauthorizedException("Token validation failed");
		}
	}

	private async syncNeonUser(payload: NeonJwtPayload) {
		let dbUser = await this.db.query.users.findFirst({
			where: eq(users.neonUserId, payload.sub),
		});

		if (!dbUser) {
			const existingByEmail = await this.db.query.users.findFirst({
				where: eq(users.email, payload.email.toLowerCase()),
			});

			if (existingByEmail) {
				const [updatedUser] = await this.db
					.update(users)
					.set({
						neonUserId: payload.sub,
						fullName: payload.name ?? existingByEmail.fullName,
						updatedAt: new Date(),
					})
					.where(eq(users.id, existingByEmail.id))
					.returning();
				dbUser = updatedUser;
			} else {
				const [createdUser] = await this.db
					.insert(users)
					.values({
						neonUserId: payload.sub,
						email: payload.email.toLowerCase(),
						fullName: payload.name ?? null,
						status: "ACTIVE",
						verificationStatus: "PENDING",
					})
					.returning();
				dbUser = createdUser;
			}
		}

		if (!dbUser || dbUser.status !== "ACTIVE") {
			throw new UnauthorizedException("User account is not active");
		}

		const currentRoles = await this.db.query.userRoles.findMany({
			where: eq(userRoles.userId, dbUser.id),
		});
		if (currentRoles.length === 0) {
			let volunteerRole = await this.db.query.roles.findFirst({
				where: eq(roles.name, "volunteer"),
			});
			if (!volunteerRole) {
				const [createdRole] = await this.db
					.insert(roles)
					.values({
						name: "volunteer",
						description: "Default application role",
					})
					.returning();
				volunteerRole = createdRole;
			}
			if (volunteerRole) {
				await this.db.insert(userRoles).values({
					userId: dbUser.id,
					roleId: volunteerRole.id,
				});
			}
		}

		return dbUser;
	}
}
