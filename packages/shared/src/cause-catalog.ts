/** Starter causes shared by the database seed and the public site's offline view. */
export const DEFAULT_CAUSE_CATEGORIES = [
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
] as const;
