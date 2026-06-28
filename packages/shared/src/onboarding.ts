import { z } from "zod";

export const step1BasicInfoSchema = z.object({
	orgName: z
		.string()
		.min(2, "Organization name must be at least 2 characters")
		.max(100, "Organization name must be under 100 characters"),
	phone: z
		.string()
		.min(10, "Enter a valid phone number")
		.max(15, "Enter a valid phone number"),
	orgType: z.enum(["trust", "society", "section8", "others"] as const, {
		message: "Select your organization type",
	}),
});

export const step2AddressSchema = z.object({
	address: z
		.string()
		.min(10, "Please enter your full address")
		.max(500, "Address must be under 500 characters"),
	city: z.string().min(2, "City is required"),
	state: z.string().min(2, "State is required"),
	pincode: z
		.string()
		.min(4, "Enter a valid pincode")
		.max(10, "Enter a valid pincode"),
});

export const step4TeamSchema = z.object({
	teamSize: z.coerce
		.number()
		.int("Must be a whole number")
		.min(1, "At least 1 member")
		.max(100000, "That seems too high"),
	foundingYear: z.coerce
		.number()
		.int("Must be a valid year")
		.min(1900, "Enter a valid year")
		.max(new Date().getFullYear(), "Year cannot be in the future"),
	description: z
		.string()
		.max(500, "Description must be under 500 characters")
		.optional(),
	website: z.string().url("Enter a valid URL").optional().or(z.literal("")),
});

export type Step1BasicInfo = z.infer<typeof step1BasicInfoSchema>;
export type Step2Address = z.infer<typeof step2AddressSchema>;
export type Step4Team = z.infer<typeof step4TeamSchema>;
