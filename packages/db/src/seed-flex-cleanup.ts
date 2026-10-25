/**
 * Removes everything `seed-flex.ts` added, children before parents.
 *
 *   pnpm --filter @nabhya/db db:seed:flex:cleanup          # dry run: counts only
 *   pnpm --filter @nabhya/db db:seed:flex:cleanup --yes    # actually delete
 *
 * What counts as seeded (see seed-flex-lib.ts):
 * - any row whose id starts with `5eedf1e0-`;
 * - rows that only exist because of seeded rows - e.g. a real user's like,
 *   comment, application, pledge, donation or notification that points at a
 *   seeded event/need/post/org (otherwise those would dangle or block deletes);
 * - storage objects referenced by seeded rows, receipts/certificate PDFs the
 *   server rendered for seeded donations/certificates, and anything under a
 *   `seed` path segment (including the shared `seed/pool`).
 *
 * On the three demo accounts it reverts only what the seeder filled in: a
 * field is cleared back to NULL when it still holds exactly the seeded value.
 * Anything the user has since changed is left alone.
 */
import { sql } from "drizzle-orm";
import {
	loadServerEnv,
	removeObjects,
	SEED_EMAIL_DOMAIN,
	SEED_ID_PREFIX,
	storageConfigured,
} from "./seed-flex-lib";

loadServerEnv();
const { db } = await import("./index");

const APPLY = process.argv.includes("--yes");
const P = `'${SEED_ID_PREFIX}-%'`;
const seeded = (column: string) => `${column}::text like ${P}`;

/** Seeded orgs/users/events/needs, as SQL sub-selects. */
const ORG = `(select id from organizations where ${seeded("id")})`;
const USER = `(select id from users where ${seeded("id")} and email like '%@${SEED_EMAIL_DOMAIN}')`;
const EVENT = `(select id from events where ${seeded("id")} or organization_id in ${ORG})`;
const NEED = `(select id from needs where ${seeded("id")} or organization_id in ${ORG})`;
const POST = `(select id from posts where ${seeded("id")} or organization_id in ${ORG} or author_user_id in ${USER})`;

const steps: [table: string, where: string][] = [
	[
		"post_interactions",
		`${seeded("id")} or ${seeded("post_id")} or user_id in ${USER} or post_id in ${POST}`,
	],
	[
		"post_comments",
		`${seeded("id")} or ${seeded("post_id")} or user_id in ${USER} or post_id in ${POST}`,
	],
	[
		"notifications",
		`${seeded("id")} or ${seeded("coalesce(entity_id::text, '')")} or user_id in ${USER}`,
	],
	[
		"audit_logs",
		`${seeded("id")} or ${seeded("coalesce(entity_id::text, '')")}`,
	],
	[
		"certificates",
		`${seeded("id")} or event_id in ${EVENT} or organization_id in ${ORG} or volunteer_id in ${USER}`,
	],
	[
		"event_applications",
		`${seeded("id")} or event_id in ${EVENT} or volunteer_id in ${USER}`,
	],
	[
		"need_pledges",
		`${seeded("id")} or need_id in ${NEED} or user_id in ${USER}`,
	],
	["posts_media", `${seeded("id")} or post_id in ${POST}`],
	["posts", `${seeded("id")} or id in ${POST}`],
	[
		"donations",
		`${seeded("id")} or organization_id in ${ORG} or provider_payment_id like 'seed\\_%' or provider_checkout_id like 'seed\\_%'`,
	],
	[
		"reviews",
		`${seeded("id")} or organization_id in ${ORG} or user_id in ${USER}`,
	],
	[
		"follows",
		`${seeded("id")} or organization_id in ${ORG} or user_id in ${USER}`,
	],
	[
		"bookmarks",
		`${seeded("id")} or organization_id in ${ORG} or user_id in ${USER}`,
	],
	["announcements", `${seeded("id")} or organization_id in ${ORG}`],
	["financial_reports", `${seeded("id")} or organization_id in ${ORG}`],
	["events", `${seeded("id")} or organization_id in ${ORG}`],
	["needs", `${seeded("id")} or organization_id in ${ORG}`],
	["team_invites", `${seeded("id")} or organization_id in ${ORG}`],
	["organization_ownership_transfers", `organization_id in ${ORG}`],
	["organization_documents", `${seeded("id")} or organization_id in ${ORG}`],
	["organization_categories", `${seeded("id")} or organization_id in ${ORG}`],
	[
		"organization_admins",
		`${seeded("id")} or organization_id in ${ORG} or user_id in ${USER}`,
	],
	["user_documents", `${seeded("id")} or user_id in ${USER}`],
	["user_categories", `${seeded("id")} or user_id in ${USER}`],
	["user_roles", `${seeded("id")} or user_id in ${USER}`],
	["organizations", seeded("id")],
	["users", `${seeded("id")} and email like '%@${SEED_EMAIL_DOMAIN}'`],
];

/** Fields the seeder may have filled on the demo accounts: column -> seeded value. */
const NAMED_ORG_FILLS: Record<string, string> = {
	description:
		"Nabhya Foundation runs after-school learning centres, a community kitchen and a girls' mentoring programme across Navi Mumbai and Mumbai. About 600 volunteers give their time with us every year, and every rupee donated is reported back in our annual utilisation statement.",
	mission:
		"Learning, a full meal and a fair start for every child in our neighbourhoods.",
	vision:
		"Neighbourhoods where no child drops out of school for want of a meal, a book or a mentor.",
	website: "https://nabhya.com",
	email: "ngo@nabhya.com",
	address: "Plot 14, Sector 17, Vashi, Navi Mumbai",
	city: "Navi Mumbai",
	state: "Maharashtra",
	pincode: "400703",
	latitude: "19.0771",
	longitude: "72.9986",
	team_size: "18",
	founding_year: "2016",
	registration_number: "MH/2016/0184207",
};

const lit = (v: string) => `'${v.replace(/'/g, "''")}'`;

async function count(query: string): Promise<number> {
	const result = await db.execute<{ n: string }>(sql.raw(query));
	return Number(result.rows[0]?.n ?? 0);
}

async function main() {
	console.log(
		APPLY
			? "Flex cleanup: DELETING seeded data"
			: "Flex cleanup: dry run (pass --yes to delete)",
	);

	// Storage keys first, while the rows that reference them still exist.
	const keyQuery = `
		select profile_image as key from users where ${seeded("id")}
		union select logo from organizations where ${seeded("id")} or logo like '%/seed/%'
		union select cover_image from organizations where ${seeded("id")} or cover_image like '%/seed/%'
		union select cover_image from events where ${seeded("id")} or organization_id in ${ORG}
		union select cover_image from needs where ${seeded("id")} or organization_id in ${ORG}
		union select cover_image_key from announcements where ${seeded("id")} or organization_id in ${ORG}
		union select document_key from financial_reports where ${seeded("id")} or organization_id in ${ORG}
		union select object_key from posts_media where ${seeded("id")} or post_id in ${POST}
		union select document_key from user_documents where ${seeded("id")} or user_id in ${USER}
		union select document_key from organization_documents where ${seeded("id")} or organization_id in ${ORG}
		union select pdf_key from certificates where ${seeded("id")} or event_id in ${EVENT}
		union select 'ngo_verification/receipts/' || id || '/' || coalesce(receipt_number, 'receipt') || '.pdf' from donations where ${seeded("id")} or organization_id in ${ORG}
		union select bucket_id || '/' || name from storage.objects where name like 'seed/%' or name like '%/seed/%' or name like 'org-documents/seed/%'`;
	const keyRows = await db.execute<{ key: string | null }>(sql.raw(keyQuery));
	const keys = [
		...new Set(
			keyRows.rows
				.map((r) => r.key)
				.filter((k): k is string => !!k && !/^https?:/.test(k)),
		),
	];

	const counts: [string, number][] = [];
	if (APPLY) {
		await db.transaction(async (tx) => {
			for (const [table, where] of steps) {
				const result = await tx.execute(
					sql.raw(`delete from ${table} where ${where}`),
				);
				counts.push([table, result.rowCount ?? 0]);
			}
			// Demo accounts: clear only values that are still exactly what was seeded.
			for (const [column, value] of Object.entries(NAMED_ORG_FILLS)) {
				await tx.execute(
					sql.raw(
						`update organizations set ${column} = null where owner_user_id = (select id from users where email = 'ngo@nabhya.com') and ${column}::text = ${lit(value)}`,
					),
				);
			}
			await tx.execute(
				sql.raw(
					"update organizations set logo = null where logo like '%/seed/%'",
				),
			);
			await tx.execute(
				sql.raw(
					"update organizations set cover_image = null where cover_image like '%/seed/%'",
				),
			);
			const userFills: [string, string, string][] = [
				["ngo@nabhya.com", "full_name", "Meera Joshi"],
				["ngo@nabhya.com", "city", "Navi Mumbai"],
				["ngo@nabhya.com", "state", "Maharashtra"],
				["superadmin@nabhya.com", "full_name", "Nabhya Admin"],
				["volunteer@nabhya.com", "state", "Maharashtra"],
				["volunteer@nabhya.com", "latitude", "19.033"],
				["volunteer@nabhya.com", "longitude", "73.0297"],
			];
			for (const [email, column, value] of userFills) {
				await tx.execute(
					sql.raw(
						`update users set ${column} = null where email = ${lit(email)} and ${column}::text = ${lit(value)}`,
					),
				);
			}
		});
	} else {
		for (const [table, where] of steps) {
			counts.push([
				table,
				await count(`select count(*) as n from ${table} where ${where}`),
			]);
		}
	}

	for (const [table, n] of counts)
		console.log(`  ${table.padEnd(34)} ${String(n).padStart(6)}`);
	console.log(
		`  ${"storage objects".padEnd(34)} ${String(keys.length).padStart(6)}`,
	);

	if (APPLY && keys.length > 0) {
		if (!storageConfigured()) {
			console.warn("  storage not configured - objects were left in place");
		} else {
			// Objects that were never rendered (receipts/certificates) are simply
			// absent; Supabase ignores them.
			const byBucket = new Map<string, string[]>();
			for (const key of keys)
				byBucket.set(key.split("/")[0] as string, [
					...(byBucket.get(key.split("/")[0] as string) ?? []),
					key,
				]);
			let removed = 0;
			for (const [bucket, list] of byBucket) {
				try {
					removed += await removeObjects(list);
				} catch (error) {
					console.warn(
						`  storage: could not clean bucket ${bucket}: ${error instanceof Error ? error.message : String(error)}`,
					);
				}
			}
			console.log(`  removed ${removed} storage object(s)`);
		}
	}
	console.log(
		APPLY ? "Cleanup complete." : "Dry run complete - nothing deleted.",
	);
	process.exit(0);
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
});
