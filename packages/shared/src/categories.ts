import { z } from "zod";
import { optionalText } from "./common";

const categoryNameSchema = z.string().trim().min(2).max(80);
const categorySlugSchema = z
	.string()
	.trim()
	.min(2)
	.max(80)
	.regex(
		/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
		"Use lowercase letters, numbers and hyphens",
	);

export const createCategorySchema = z.object({
	name: categoryNameSchema,
	slug: categorySlugSchema,
	description: optionalText(500),
	icon: optionalText(60),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema
	.partial()
	.extend({ isActive: z.boolean().optional() })
	.refine((input) => Object.keys(input).length > 0, {
		message: "Provide at least one category field to update",
	});
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export interface AdminCategory {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	icon: string | null;
	isActive: boolean;
}
