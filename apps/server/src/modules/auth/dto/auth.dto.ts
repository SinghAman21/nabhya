import { ApiProperty } from "@nestjs/swagger";
import { z } from "zod";

// ─── Zod schemas (used for runtime validation) ───────────────────────────────

export const LoginSchema = z.object({
	email: z.string().email("Invalid email address"),
	password: z.string().min(8, "Password must be at least 8 characters"),
});

export const RegisterSchema = z.object({
	name: z.string().min(2, "Name must be at least 2 characters"),
	email: z.string().email("Invalid email address"),
	password: z.string().min(8, "Password must be at least 8 characters"),
});

export type LoginDto = z.infer<typeof LoginSchema>;
export type RegisterDto = z.infer<typeof RegisterSchema>;

// ─── Class-based DTOs (used by @nestjs/swagger for OpenAPI schema generation) ─

export class LoginBodyDto {
	@ApiProperty({
		type: String,
		example: "user@example.com",
		description: "User email address",
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

export class RegisterBodyDto {
	@ApiProperty({
		type: String,
		example: "Jane Doe",
		description: "Full name (min 2 characters)",
		minLength: 2,
	})
	name!: string;

	@ApiProperty({
		type: String,
		example: "jane@example.com",
		description: "User email address",
	})
	email!: string;

	@ApiProperty({
		type: String,
		example: "securepass1",
		description: "Password (min 8 characters)",
		minLength: 8,
	})
	password!: string;
}

// ─── Common response DTOs ─────────────────────────────────────────────────────

export class MessageResponseDto {
	@ApiProperty({ type: String, example: "login — not implemented yet" })
	message!: string;
}
