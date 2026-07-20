import { db } from "./index";
import { categories } from "./schema/categories";
import { roles } from "./schema/users";

const DEFAULT_ROLES = [
	{ name: "volunteer", description: "Default volunteer role" },
	{ name: "organisation", description: "Organization account role" },
	{ name: "superadmin", description: "System super administrator" },
];

const DEFAULT_CATEGORIES = [
	{ name: "Education", slug: "education", icon: "GraduationCap" },
	{ name: "Healthcare", slug: "healthcare", icon: "Stethoscope" },
	{ name: "Environment", slug: "environment", icon: "Leaf" },
	{ name: "Women & Child Welfare", slug: "women-child", icon: "Baby" },
	{ name: "Animal Welfare", slug: "animal-welfare", icon: "PawPrint" },
	{ name: "Disaster Relief", slug: "disaster-relief", icon: "LifeBuoy" },
	{ name: "Food & Nutrition", slug: "food-nutrition", icon: "Utensils" },
	{ name: "Livelihood & Skills", slug: "livelihood", icon: "Hammer" },
	{ name: "Elderly Care", slug: "elderly-care", icon: "HeartHandshake" },
	{ name: "Rural Development", slug: "rural-development", icon: "Sprout" },
];

async function main() {
	console.log("Seeding database...");

	for (const role of DEFAULT_ROLES) {
		await db
			.insert(roles)
			.values(role)
			.onConflictDoUpdate({
				target: roles.name,
				set: { description: role.description },
			});
	}
	console.log(`  roles         → ${DEFAULT_ROLES.length}`);

	for (const category of DEFAULT_CATEGORIES) {
		await db
			.insert(categories)
			.values(category)
			.onConflictDoUpdate({
				target: categories.slug,
				set: { name: category.name, icon: category.icon },
			});
	}
	console.log(`  categories    → ${DEFAULT_CATEGORIES.length}`);

	console.log("Seeding complete!");
	process.exit(0);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
