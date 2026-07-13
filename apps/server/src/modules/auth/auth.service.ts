import { db } from "@my-better-t-app/db";
import { users } from "@my-better-t-app/db/schema";
import { env } from "@my-better-t-app/env/server";
import { BadRequestException, Injectable } from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import type { AuthResponse, JwtPayload } from "../../common/types";
import type { LoginDto, RegisterDto } from "./dto/auth.dto";

@Injectable()
export class AuthService {
	constructor(private jwtService: JwtService) {}

	/**
	 * Register a new user
	 * 1. Check if email exists
	 * 2. Hash password with bcrypt
	 * 3. Create user in PostgreSQL
	 * 4. Generate tokens
	 * 5. Return user data and tokens
	 */
	async register(dto: RegisterDto) {
		// Step 1: Check if email already exists
		const existingUser = await db.query.users.findFirst({
			where: eq(users.email, dto.email),
		});

		if (existingUser) {
			throw new BadRequestException("Email already registered");
		}

		// Step 2: Hash password
		const hashedPassword = await bcrypt.hash(dto.password, 10);

		try {
			// Step 3: Create user in PostgreSQL
			const newUser = await db
				.insert(users)
				.values({
					email: dto.email,
					name: dto.name,
					role: (dto.role || "volunteer") as any,
					phoneNumber: null,
					profilePicture: null,
					passwordHash: hashedPassword, // Store hashed password
					isEmailVerified: "false",
					isPhoneVerified: "false",
				})
				.returning();

			if (!newUser[0]) {
				throw new BadRequestException("Failed to create user");
			}

			// Step 4: Generate tokens
			const tokens = this.generateTokens(
				newUser[0].id,
				newUser[0].email,
				newUser[0].role,
			);

			// Step 5: Return response
			const response: AuthResponse = {
				user: {
					id: newUser[0].id,
					email: newUser[0].email,
					name: newUser[0].name,
					role: newUser[0].role,
					createdAt: newUser[0].createdAt,
					updatedAt: newUser[0].updatedAt,
				},
				accessToken: tokens.accessToken,
				refreshToken: tokens.refreshToken,
			};

			return response;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Login user
	 * 1. Find user by email
	 * 2. Compare passwords
	 * 3. Generate tokens
	 * 4. Return user data and tokens
	 */
	async login(dto: LoginDto) {
		// Step 1: Find user by email
		const user = await db.query.users.findFirst({
			where: eq(users.email, dto.email),
		});

		if (!user) {
			throw new BadRequestException("Invalid email or password");
		}

		// Step 2: Compare passwords
		const isPasswordValid = await bcrypt.compare(
			dto.password,
			user.passwordHash || "",
		);

		if (!isPasswordValid) {
			throw new BadRequestException("Invalid email or password");
		}

		// Step 3: Generate tokens
		const tokens = this.generateTokens(user.id, user.email, user.role);

		// Step 4: Return response
		const response: AuthResponse = {
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				role: user.role,
				createdAt: user.createdAt,
				updatedAt: user.updatedAt,
			},
			accessToken: tokens.accessToken,
			refreshToken: tokens.refreshToken,
		};

		return response;
	}

	/**
	 * Refresh access token
	 * 1. Verify refresh token
	 * 2. Fetch user from database
	 * 3. Generate new tokens
	 */
	async refreshToken(refreshToken: string) {
		try {
			// Step 1: Verify refresh token
			const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
				secret: env.REFRESH_TOKEN_SECRET,
			});

			if (payload.type !== "refresh") {
				throw new BadRequestException("Invalid token type");
			}

			// Step 2: Fetch user from database
			const user = await db.query.users.findFirst({
				where: eq(users.id, payload.sub as any),
			});

			if (!user) {
				throw new BadRequestException("User not found");
			}

			// Step 3: Generate new tokens
			const tokens = this.generateTokens(user.id, user.email, user.role);

			const response: AuthResponse = {
				user: {
					id: user.id,
					email: user.email,
					name: user.name,
					role: user.role,
					createdAt: user.createdAt,
					updatedAt: user.updatedAt,
				},
				accessToken: tokens.accessToken,
				refreshToken: tokens.refreshToken,
			};

			return response;
		} catch (error) {
			throw new BadRequestException("Invalid or expired refresh token");
		}
	}

	/**
	 * Generate JWT tokens (access + refresh)
	 */
	private generateTokens(userId: string, email: string, role: string) {
		const accessPayload: JwtPayload = {
			sub: userId,
			email,
			role: role as any,
			type: "access",
			iat: Math.floor(Date.now() / 1000),
			exp: Math.floor(Date.now() / 1000) + 15 * 60, // 15 minutes
		};

		const refreshPayload: JwtPayload = {
			sub: userId,
			email,
			role: role as any,
			type: "refresh",
			iat: Math.floor(Date.now() / 1000),
			exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
		};

		const accessToken = this.jwtService.sign(accessPayload, {
			secret: env.ACCESS_TOKEN_SECRET,
			expiresIn: "15m",
		});

		const refreshToken = this.jwtService.sign(refreshPayload, {
			secret: env.REFRESH_TOKEN_SECRET,
			expiresIn: "7d",
		});

		return { accessToken, refreshToken };
	}

	/**
	 * Logout user (optional - can be handled client-side)
	 */
	async logout() {
		return { message: "Logged out successfully" };
	}
}
