import { z } from "zod";

export const signInSchema = z.object({
	email: z.email("Please enter a valid org email"),
	password: z.string().min(1, "Password is required"),
});

export const signUpSchema = z.object({
	email: z.email("Please enter your organization email"),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
