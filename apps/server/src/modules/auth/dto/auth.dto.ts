import { ApiProperty } from "@nestjs/swagger";
import { z } from "zod";

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

export const RoleSchema = z.enum(["superadmin", "volunteer", "organisation"]);

export const RegisterSchema = z.object({
	name: z.string().min(2, "Name must be at least 2 characters"),
	email: z.string().email("Invalid email address"),
	password: z.string().min(8, "Password must be at least 8 characters"),
	role: RoleSchema.default("volunteer"),
});

export const LoginSchema = z.object({
	email: z.string().email("Invalid email address"),
	password: z.string().min(8, "Password must be at least 8 characters"),
});

export const RefreshTokenSchema = z.object({
	refreshToken: z.string().min(1, "Refresh token is required"),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;
export type LoginDto = z.infer<typeof LoginSchema>;
export type RefreshTokenDto = z.infer<typeof RefreshTokenSchema>;

// ─── Class-based DTOs (for Swagger) ──────────────────────────────────────────

export class RegisterBodyDto {
	@ApiProperty({
		type: String,
		example: "John Doe",
		description: "Full name (min 2 characters)",
		minLength: 2,
	})
	name!: string;

	@ApiProperty({
		type: String,
		example: "john@example.com",
		description: "Email address",
	})
	email!: string;

	@ApiProperty({
		type: String,
		example: "password123",
		description: "Password (min 8 characters)",
		minLength: 8,
	})
	password!: string;

	@ApiProperty({
		type: String,
		enum: ["superadmin", "volunteer", "organisation"],
		example: "volunteer",
		description: "User role",
		default: "volunteer",
	})
	role?: string;
}

export class LoginBodyDto {
	@ApiProperty({
		type: String,
		example: "john@example.com",
		description: "Email address",
	})
	email!: string;

	@ApiProperty({
		type: String,
		example: "password123",
		description: "Password (min 8 characters)",
		minLength: 8,
	})
	password!: string;
}

export class RefreshTokenBodyDto {
	@ApiProperty({
		type: String,
		description: "Refresh token",
	})
	refreshToken!: string;
}

export class UserDto {
	@ApiProperty({
		type: String,
		format: "uuid",
	})
	id!: string;

	@ApiProperty({
		type: String,
	})
	email!: string;

	@ApiProperty({
		type: String,
		nullable: true,
	})
	name!: string | null;

	@ApiProperty({
		type: String,
		enum: ["superadmin", "volunteer", "organisation"],
	})
	role!: string;

	@ApiProperty({
		type: String,
		format: "date-time",
	})
	createdAt!: string;

	@ApiProperty({
		type: String,
		format: "date-time",
	})
	updatedAt!: string;
}

export class AuthResponseDto {
	@ApiProperty({
		type: String,
		example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
		description: "JWT Access token (15 min expiry)",
	})
	accessToken!: string;

	@ApiProperty({
		type: String,
		example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
		description: "JWT Refresh token (7 days expiry)",
	})
	refreshToken!: string;

	@ApiProperty({
		type: UserDto,
	})
	user!: UserDto;
}

export class MessageResponseDto {
	@ApiProperty({
		type: String,
		example: "Operation successful",
	})
	message!: string;
}
