import { sql } from "drizzle-orm";
import { db } from "./index";
import { roles } from "./schema/users";

async function main() {
	console.log("Seeding database...");

	const defaultRoles = [
		{ name: "USER", description: "Default user role" },
		{ name: "ORG_ADMIN", description: "Organization administrator" },
		{ name: "SUPER_ADMIN", description: "System super administrator" },
	];

	for (const role of defaultRoles) {
		await db
			.insert(roles)
			.values(role)
			.onConflictDoUpdate({
				target: roles.name,
				set: { description: role.description },
			});
	}

	console.log("Seeding complete!");
	process.exit(0);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
