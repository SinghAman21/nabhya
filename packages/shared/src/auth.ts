import { z } from "zod";

// Volunteers sign in on the same form as NGOs, so the copy says "email",
// not "organization email".
const email = z.email("Enter a valid email address");
const newPassword = z.string().min(8, "Password must be at least 8 characters");

export const signInSchema = z.object({
	email,
	password: z.string().min(1, "Password is required"),
});

export const signUpSchema = z.object({
	email,
	password: newPassword,
	name: z.string().min(1, "Full name is required"),
});

/** "Forgot password?" - where to send the reset link. */
export const passwordResetRequestSchema = z.object({ email });

/** The new password set from a reset link. */
export const newPasswordSchema = z.object({ password: newPassword });

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type PasswordResetRequestInput = z.infer<
	typeof passwordResetRequestSchema
>;
export type NewPasswordInput = z.infer<typeof newPasswordSchema>;
