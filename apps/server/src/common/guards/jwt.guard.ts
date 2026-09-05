import type { db as dbType } from "@nabhya/db";
import { userRoles, users } from "@nabhya/db/schema";
import { env } from "@nabhya/env/server";
import {
	type CanActivate,
	type ExecutionContext,
	HttpException,
	Inject,
	Injectable,
	Logger,
	ServiceUnavailableException,
	UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { eq } from "drizzle-orm";
import { createRemoteJWKSet, errors as joseErrors, jwtVerify } from "jose";
import { DB_TOKEN } from "../database";
import { IS_OPTIONAL_AUTH_KEY } from "../decorators/optional-auth.decorator";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import type { AuthUser, SupabaseJwtPayload, UserRole } from "../types";

@Injectable()
export class JwtGuard implements CanActivate {
	private readonly logger = new Logger(JwtGuard.name);
	private readonly supabaseJwks = createRemoteJWKSet(
		new URL(env.SUPABASE_AUTH_JWKS_URL),
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

		const isOptional = this.reflector.getAllAndOverride<boolean>(
			IS_OPTIONAL_AUTH_KEY,
			[context.getHandler(), context.getClass()],
		);

		const request = context.switchToHttp().getRequest();
		const authHeader = request.headers.authorization;

		if (!authHeader) {
			if (isOptional) return true;
			throw new UnauthorizedException("Authorization header missing");
		}

		const [scheme, token] = authHeader.split(" ");

		if (scheme !== "Bearer" || !token) {
			if (isOptional) return true;
			throw new UnauthorizedException("Token missing");
		}

		try {
			const { payload } = await jwtVerify<SupabaseJwtPayload>(
				token,
				this.supabaseJwks,
			);

			if (!payload.sub || !payload.email) {
				throw new UnauthorizedException(
					"Invalid token payload: missing sub or email",
				);
			}

			const dbUser = await this.syncSupabaseUser(payload);

			const roleRows = await this.db.query.userRoles.findMany({
				where: eq(userRoles.userId, dbUser.id),
				with: { role: true },
			});

			// Stable priority order — the join table returns rows in arbitrary
			// order, and a flip-flopping `role` sends the app's routing gate and
			// the role-guarded layouts into a redirect loop.
			const ROLE_PRIORITY: UserRole[] = [
				"superadmin",
				"organisation",
				"volunteer",
			];
			const assignedRoles = (
				roleRows.map((ur) => ur.role.name) as UserRole[]
			).sort((a, b) => ROLE_PRIORITY.indexOf(a) - ROLE_PRIORITY.indexOf(b));

			// Attach fully loaded user to request. `roles` is empty until the user
			// picks one on the role-select screen — routes that need a role are
			// gated by @Roles() rather than by a server-side default.
			request.user = {
				id: dbUser.id,
				email: dbUser.email,
				role: assignedRoles[0] ?? null,
				roles: assignedRoles,
				name: dbUser.fullName,
			} satisfies AuthUser;

			return true;
		} catch (error) {
			// On an optional-auth route a bad token simply means "anonymous" —
			// a stale token in the app must not break the public feed.
			if (isOptional) return true;
			if (error instanceof HttpException) throw error;
			if (error instanceof joseErrors.JOSEError) {
				this.logger.warn(`Supabase JWT verification failed: ${error.message}`);
				throw new UnauthorizedException("Token validation failed");
			}
			// Anything else (DB/network blip) is our failure, not the caller's.
			// A 401 here would force-log-out the app on a transient error.
			this.logger.error(
				`Auth infrastructure error: ${error instanceof Error ? error.message : String(error)}`,
			);
			throw new ServiceUnavailableException(
				"Authentication temporarily unavailable, please retry",
			);
		}
	}

	private async syncSupabaseUser(payload: SupabaseJwtPayload) {
		const name =
			payload.user_metadata?.name ?? payload.user_metadata?.full_name;

		let dbUser = await this.db.query.users.findFirst({
			where: eq(users.authUserId, payload.sub),
		});

		if (!dbUser) {
			const existingByEmail = await this.db.query.users.findFirst({
				where: eq(users.email, payload.email.toLowerCase()),
			});

			if (existingByEmail) {
				const [updatedUser] = await this.db
					.update(users)
					.set({
						authUserId: payload.sub,
						fullName: name ?? existingByEmail.fullName,
						updatedAt: new Date(),
					})
					.where(eq(users.id, existingByEmail.id))
					.returning();
				dbUser = updatedUser;
			} else {
				const [createdUser] = await this.db
					.insert(users)
					.values({
						authUserId: payload.sub,
						email: payload.email.toLowerCase(),
						fullName: name ?? null,
						status: "ACTIVE",
						verificationStatus: "PENDING",
					})
					.returning();
				dbUser = createdUser;
			}
		}

		if (!dbUser) {
			throw new UnauthorizedException("User account could not be resolved");
		}

		if (dbUser.status === "SUSPENDED") {
			throw new UnauthorizedException(
				"Your account has been suspended. Contact support for help.",
			);
		}

		if (dbUser.status !== "ACTIVE") {
			throw new UnauthorizedException("User account is not active");
		}

		return dbUser;
	}
}
