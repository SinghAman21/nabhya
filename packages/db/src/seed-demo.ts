import { eq, inArray, like } from "drizzle-orm";
import { db } from "./index";
import { categories, organizationCategories } from "./schema/categories";
import { donations } from "./schema/donations";
import { events } from "./schema/events";
import { posts, postsMedia } from "./schema/feed";
import { needs } from "./schema/needs";
import { organizations } from "./schema/organizations";
import { announcements } from "./schema/publishing";
import { roles, userRoles, users } from "./schema/users";

/**
 * Demo content so the app looks lived-in: six verified NGOs across four cities
 * with needs, offers, upcoming events and updates. Re-runnable — everything it
 * creates is tagged (`DEMO-` registration numbers, `@demo.nabhya.org` owners)
 * and is removed before being re-inserted, so it never duplicates and never
 * touches real rows.
 *
 *   pnpm --filter @nabhya/db db:seed:demo
 *
 * Run `db:seed` first for roles and categories.
 */

const DAY = 86_400_000;
const DEMO_IMAGES = [
	"https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1200&q=80",
	"https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=1200&q=80",
	"https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=1200&q=80",
	"https://images.unsplash.com/photo-1542810634-71277d95dcbb?auto=format&fit=crop&w=1200&q=80",
	"https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=1200&q=80",
	"https://images.unsplash.com/photo-1593113646773-028c64a8f1b8?auto=format&fit=crop&w=1200&q=80",
];
const DEMO_VIDEO =
	"https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
const inDays = (n: number, hour = 9) => {
	const d = new Date(Date.now() + n * DAY);
	d.setHours(hour, 0, 0, 0);
	return d;
};
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

type Need = {
	type: "WANT" | "OFFER";
	title: string;
	description: string;
	quantity?: number;
	unit?: string;
	urgency?: "LOW" | "MEDIUM" | "HIGH";
	fulfilled?: number;
	expiresInDays?: number;
	postedDaysAgo?: number;
};

type Event = {
	title: string;
	description: string;
	venue: string;
	inDays: number;
	hours?: number;
	volunteersNeeded: number;
	accepted?: number;
	deadlineDaysBefore?: number;
	coverImage?: string;
};

type Story = {
	title: string;
	body: string;
	pinned?: boolean;
	daysAgo: number;
	coverImage?: string;
};

type Ngo = {
	name: string;
	city: string;
	state: string;
	categories: string[];
	description: string;
	mission: string;
	website: string;
	founded: number;
	teamSize: number;
	needs: Need[];
	events: Event[];
	stories: Story[];
};

const DEMO_POST_TEXT = [
	"A small team, a long day, and a lot of neighbours showing up. Here is what moved forward this week.",
	"Behind every number in our impact report is a person who gave time, materials, or a little encouragement.",
	"We are opening the doors this weekend. Bring a friend, comfortable shoes, and the willingness to learn.",
	"Today's field notes: the work is practical, local, and much more hopeful when done together.",
];

const NGOS: Ngo[] = [
	{
		name: "Annapurna Seva Foundation",
		city: "Mumbai",
		state: "Maharashtra",
		categories: ["food-nutrition", "elderly-care"],
		description:
			"Community kitchens serving 2,000 hot meals a day across Dharavi, Kurla and Govandi, run largely by volunteers.",
		mission: "No one in Mumbai should sleep hungry.",
		website: "https://annapurnaseva.org",
		founded: 2011,
		teamSize: 24,
		needs: [
			{
				type: "WANT",
				title: "Rice for the Dharavi kitchen",
				description:
					"Our Dharavi kitchen runs through 60kg of rice a day. Stocks are down to four days. Any quantity helps; drop-off is at the kitchen between 8 and 11am.",
				quantity: 500,
				unit: "kg",
				urgency: "HIGH",
				fulfilled: 180,
				expiresInDays: 5,
				postedDaysAgo: 1,
			},
			{
				type: "WANT",
				title: "Steel tiffin boxes for daily-wage workers",
				description:
					"Reusable tiffins let us stop using foil packs. Used ones in good condition are perfect.",
				quantity: 300,
				unit: "tiffins",
				urgency: "MEDIUM",
				fulfilled: 45,
				expiresInDays: 30,
				postedDaysAgo: 6,
			},
			{
				type: "OFFER",
				title: "Cooked meals for shelters, 6pm daily",
				description:
					"We cook for 2,000 and usually have 100 to 150 portions to spare. Shelters and hostels can collect from Kurla from 6pm.",
				quantity: 150,
				unit: "meals",
				urgency: "LOW",
				postedDaysAgo: 3,
			},
		],
		events: [
			{
				title: "Sunday kitchen shift, Kurla",
				description:
					"Chop, cook, pack and serve alongside our regular team. No experience needed; we will show you everything. Breakfast and chai on us.",
				venue: "Annapurna Kitchen, Kurla West",
				inDays: 4,
				hours: 4,
				volunteersNeeded: 20,
				accepted: 13,
				deadlineDaysBefore: 1,
			},
		],
		stories: [
			{
				title: "1 million meals since 2011",
				body: "This week the Dharavi kitchen served its millionth meal. It took 13 years, 400 regular volunteers and more rice than we can count. Thank you to everyone who has ever chopped an onion with us.",
				pinned: true,
				daysAgo: 2,
			},
		],
	},
	{
		name: "Pragati Shiksha Trust",
		city: "Pune",
		state: "Maharashtra",
		categories: ["education", "women-child"],
		description:
			"After-school learning centres for first-generation learners in Pune's construction-worker settlements.",
		mission: "Every child in a settlement finishes school.",
		website: "https://pragatishiksha.in",
		founded: 2015,
		teamSize: 11,
		needs: [
			{
				type: "WANT",
				title: "Class 6 to 8 textbooks, Maharashtra board",
				description:
					"Second-hand is fine as long as pages are intact. We need Marathi and English medium sets for 40 students who joined mid-year.",
				quantity: 40,
				unit: "sets",
				urgency: "HIGH",
				fulfilled: 12,
				expiresInDays: 12,
				postedDaysAgo: 2,
			},
			{
				type: "WANT",
				title: "Weekend maths tutors",
				description:
					"Two hours on Saturday mornings at our Hadapsar centre. You need to be comfortable with Class 7 maths and patient with kids who are not.",
				quantity: 6,
				unit: "tutors",
				urgency: "MEDIUM",
				fulfilled: 2,
				postedDaysAgo: 9,
			},
		],
		events: [
			{
				title: "Science fair volunteer day",
				description:
					"Help 120 students set up and present their projects. We need judges, table helpers and two people to run the crowd.",
				venue: "Hadapsar Community Hall",
				inDays: 11,
				hours: 6,
				volunteersNeeded: 15,
				accepted: 4,
				deadlineDaysBefore: 3,
			},
		],
		stories: [
			{
				title: "All 28 of our Class 10 students passed",
				body: "Results came out this morning. 28 of 28, nine with distinction. Three years ago most of these children were not enrolled anywhere.",
				daysAgo: 5,
			},
		],
	},
	{
		name: "Harit Bharat Collective",
		city: "Bengaluru",
		state: "Karnataka",
		categories: ["environment", "rural-development"],
		description:
			"Lake restoration and urban tree cover in Bengaluru, with a rural nursery programme in Ramanagara.",
		mission: "Bring Bengaluru's lakes back to life.",
		website: "https://haritbharat.org",
		founded: 2018,
		teamSize: 9,
		needs: [
			{
				type: "OFFER",
				title: "Native saplings for housing societies",
				description:
					"Neem, pongamia and jamun saplings from our Ramanagara nursery, free for any society or school that commits to watering them for the first year.",
				quantity: 800,
				unit: "saplings",
				urgency: "LOW",
				fulfilled: 320,
				postedDaysAgo: 4,
			},
			{
				type: "WANT",
				title: "Gardening gloves and hand tools",
				description:
					"For our weekend lake clean-ups. Gloves get destroyed fast; trowels and hand rakes last.",
				quantity: 100,
				unit: "pairs",
				urgency: "MEDIUM",
				fulfilled: 60,
				postedDaysAgo: 7,
			},
		],
		events: [
			{
				title: "Kaikondrahalli Lake clean-up",
				description:
					"Monthly shoreline clean-up and invasive weed removal. Wear clothes you do not mind ruining. Gloves, bags and breakfast provided.",
				venue: "Kaikondrahalli Lake, Sarjapur Road",
				inDays: 2,
				hours: 3,
				volunteersNeeded: 60,
				accepted: 52,
				deadlineDaysBefore: 1,
			},
			{
				title: "Tree census, Indiranagar",
				description:
					"Walk assigned streets with our app and log every tree: species, girth, health. Good for anyone who likes walking and spreadsheets.",
				venue: "Meet at Indiranagar Metro",
				inDays: 16,
				hours: 4,
				volunteersNeeded: 30,
				accepted: 8,
			},
		],
		stories: [
			{
				title: "Kaikondrahalli water quality is up two grades",
				body: "Eighteen months of clean-ups and the lake has gone from Class D to Class B on the state pollution board scale. Birds are back. So are the fishermen.",
				pinned: true,
				daysAgo: 8,
			},
		],
	},
	{
		name: "Sahara Elder Care Society",
		city: "Delhi",
		state: "Delhi",
		categories: ["elderly-care", "healthcare"],
		description:
			"Day-care and home visits for elderly people living alone in South Delhi, with a free physiotherapy clinic.",
		mission: "Nobody grows old alone.",
		website: "https://saharaeldercare.org",
		founded: 2009,
		teamSize: 17,
		needs: [
			{
				type: "WANT",
				title: "Wheelchairs and walkers",
				description:
					"We lend mobility aids to families who cannot afford them. Folding wheelchairs and walkers in working condition; we service them ourselves.",
				quantity: 15,
				unit: "aids",
				urgency: "HIGH",
				fulfilled: 4,
				expiresInDays: 20,
				postedDaysAgo: 3,
			},
			{
				type: "WANT",
				title: "Companions for weekly home visits",
				description:
					"An hour a week with an elder who lives alone: a chat, a walk, help with a phone. We match you with someone near you and stay in touch.",
				quantity: 25,
				unit: "volunteers",
				urgency: "MEDIUM",
				fulfilled: 11,
				postedDaysAgo: 12,
			},
		],
		events: [
			{
				title: "Free eye camp, Malviya Nagar",
				description:
					"Help register patients, guide them between stations and hand out spectacles. Doctors from AIIMS are volunteering their day too.",
				venue: "Sahara Centre, Malviya Nagar",
				inDays: 7,
				hours: 7,
				volunteersNeeded: 25,
				accepted: 19,
				deadlineDaysBefore: 2,
			},
		],
		stories: [
			{
				title: "Our physio clinic now runs six days a week",
				body: "Thanks to two new volunteer physiotherapists, the clinic is open Monday to Saturday. 340 elders came through last month.",
				daysAgo: 4,
			},
		],
	},
	{
		name: "Paws of Pune",
		city: "Pune",
		state: "Maharashtra",
		categories: ["animal-welfare"],
		description:
			"Street-animal rescue, sterilisation drives and a 60-kennel shelter in Wagholi.",
		mission: "A safe Pune for every street dog.",
		website: "https://pawsofpune.org",
		founded: 2016,
		teamSize: 8,
		needs: [
			{
				type: "WANT",
				title: "Old bedsheets and towels for the shelter",
				description:
					"Monsoon means wet dogs. We go through bedding faster than we can wash it. Anything absorbent, any condition.",
				quantity: 200,
				unit: "pieces",
				urgency: "HIGH",
				fulfilled: 70,
				expiresInDays: 8,
				postedDaysAgo: 1,
			},
			{
				type: "OFFER",
				title: "Puppies ready for adoption",
				description:
					"Nine vaccinated, dewormed pups between two and four months old. We do a home check and stay in touch for the first year.",
				quantity: 9,
				unit: "pups",
				urgency: "MEDIUM",
				fulfilled: 3,
				postedDaysAgo: 5,
			},
		],
		events: [
			{
				title: "Shelter walk-and-wash morning",
				description:
					"Walk the dogs, help with baths and give the kennels a scrub. Bring old clothes. Kids over 12 welcome with a parent.",
				venue: "Paws Shelter, Wagholi",
				inDays: 5,
				hours: 3,
				volunteersNeeded: 12,
				accepted: 12,
			},
		],
		stories: [
			{
				title: "412 dogs sterilised this quarter",
				body: "Our biggest quarter yet, with the municipal corporation covering surgical costs for the first time. Volunteers handled every pickup and drop.",
				daysAgo: 10,
			},
		],
	},
	{
		name: "Udaan Skill Centre",
		city: "Mumbai",
		state: "Maharashtra",
		categories: ["livelihood", "women-child"],
		description:
			"Tailoring, digital literacy and spoken-English courses for women in Mankhurd, with job placement support.",
		mission: "A first salary for every woman who walks in.",
		website: "https://udaanskills.org",
		founded: 2019,
		teamSize: 6,
		needs: [
			{
				type: "WANT",
				title: "Working laptops for the digital literacy lab",
				description:
					"Any laptop that boots and runs a browser. We wipe and set them up ourselves. Currently three women share one machine.",
				quantity: 12,
				unit: "laptops",
				urgency: "HIGH",
				fulfilled: 5,
				expiresInDays: 25,
				postedDaysAgo: 2,
			},
			{
				type: "WANT",
				title: "Mock-interview volunteers",
				description:
					"Thirty minutes on a video call with a woman about to sit her first job interview. HR and hiring managers especially welcome.",
				quantity: 20,
				unit: "volunteers",
				urgency: "MEDIUM",
				fulfilled: 7,
				postedDaysAgo: 8,
			},
		],
		events: [
			{
				title: "Placement day with local employers",
				description:
					"Twelve employers, sixty candidates. Help with registration, keep interviews on schedule and calm some nerves.",
				venue: "Udaan Centre, Mankhurd",
				inDays: 9,
				hours: 6,
				volunteersNeeded: 10,
				accepted: 3,
				deadlineDaysBefore: 2,
			},
		],
		stories: [
			{
				title: "Batch 14 graduates: 31 women, 24 placed",
				body: "Our best placement rate so far. Average starting salary ₹14,500. Six graduates are the first earning women in their families.",
				pinned: true,
				daysAgo: 6,
			},
		],
	},
];

async function main() {
	console.log("Seeding demo content...");

	// Remove a previous run. Orgs cascade to needs, events, stories and
	// category links; owners are restricted, so they go after their orgs.
	const stale = await db
		.select({ id: organizations.id })
		.from(organizations)
		.where(like(organizations.registrationNumber, "DEMO-%"));
	if (stale.length > 0) {
		const staleIds = stale.map((organization) => organization.id);
		// Donations deliberately restrict organization deletion, so clear only
		// demo donations before removing the demo organizations.
		await db
			.delete(donations)
			.where(inArray(donations.organizationId, staleIds));
		await db.delete(organizations).where(inArray(organizations.id, staleIds));
	}
	await db.delete(users).where(like(users.email, "%@demo.nabhya.org"));

	const [orgRole] = await db
		.select()
		.from(roles)
		.where(eq(roles.name, "organisation"));
	if (!orgRole) throw new Error("Run `db:seed` first: roles are missing.");

	const allCategories = await db.select().from(categories);
	const categoryBySlug = new Map(allCategories.map((c) => [c.slug, c.id]));

	let needCount = 0;
	let eventCount = 0;
	let storyCount = 0;
	let postCount = 0;
	let mediaCount = 0;

	for (const [index, ngo] of NGOS.entries()) {
		const slug = ngo.name.toLowerCase().replace(/[^a-z]+/g, "-");

		const [owner] = await db
			.insert(users)
			.values({
				email: `${slug}@demo.nabhya.org`,
				fullName: `${ngo.name} Admin`,
				city: ngo.city,
				state: ngo.state,
				emailVerified: true,
				onboardedAt: daysAgo(400),
			})
			.returning();
		if (!owner) throw new Error("owner insert failed");
		await db.insert(userRoles).values({ userId: owner.id, roleId: orgRole.id });

		const [org] = await db
			.insert(organizations)
			.values({
				ownerUserId: owner.id,
				organizationName: ngo.name,
				registrationNumber: `DEMO-${String(index + 1).padStart(3, "0")}`,
				email: `hello@${slug}.org`,
				phone: `+91 98${String(20000000 + index * 111111).slice(0, 8)}`,
				description: ngo.description,
				mission: ngo.mission,
				website: ngo.website,
				city: ngo.city,
				state: ngo.state,
				teamSize: ngo.teamSize,
				foundingYear: ngo.founded,
				verificationStatus: "VERIFIED",
				status: "ACTIVE",
				reviewedAt: daysAgo(300),
			})
			.returning();
		if (!org) throw new Error("organization insert failed");

		for (const catSlug of ngo.categories) {
			const categoryId = categoryBySlug.get(catSlug);
			if (categoryId) {
				await db
					.insert(organizationCategories)
					.values({ organizationId: org.id, categoryId });
			}
		}

		for (const n of ngo.needs) {
			await db.insert(needs).values({
				organizationId: org.id,
				type: n.type,
				title: n.title,
				description: n.description,
				quantity: n.quantity ?? null,
				unit: n.unit ?? null,
				fulfilledQuantity: n.fulfilled ?? 0,
				urgency: n.urgency ?? "MEDIUM",
				status: "OPEN",
				city: ngo.city,
				state: ngo.state,
				expiresAt: n.expiresInDays ? inDays(n.expiresInDays, 23) : null,
				createdBy: owner.id,
				createdAt: daysAgo(n.postedDaysAgo ?? 3),
				updatedAt: daysAgo(n.postedDaysAgo ?? 3),
			});
			needCount++;
		}

		const eventFixtures: Event[] = [
			...ngo.events,
			...Array.from({ length: 3 }, (_, extraIndex) => ({
				title:
					[
						"Volunteer orientation and open house",
						"Community field visit",
						"Saturday impact workshop",
					][extraIndex] ?? "Community volunteer day",
				description:
					"Spend a few useful hours with the team, meet other volunteers, and see the work up close. Everyone is welcome; we will provide a short briefing on arrival.",
				venue: `${ngo.name} Community Centre`,
				inDays: 20 + index * 2 + extraIndex * 9,
				hours: 3 + (extraIndex % 3),
				volunteersNeeded: 18 + extraIndex * 7,
				accepted: extraIndex * 3,
				deadlineDaysBefore: 2,
				coverImage: DEMO_IMAGES[(index + extraIndex + 2) % DEMO_IMAGES.length],
			})),
		];

		for (const [eventIndex, e] of eventFixtures.entries()) {
			const startAt = inDays(e.inDays);
			const endAt = new Date(startAt.getTime() + (e.hours ?? 3) * 3_600_000);
			await db.insert(events).values({
				organizationId: org.id,
				title: e.title,
				description: e.description,
				venue: e.venue,
				address: `${e.venue}, ${ngo.city}`,
				coverImage:
					e.coverImage ??
					DEMO_IMAGES[(index + eventIndex) % DEMO_IMAGES.length],
				city: ngo.city,
				state: ngo.state,
				startAt,
				endAt,
				applicationDeadline: e.deadlineDaysBefore
					? inDays(e.inDays - e.deadlineDaysBefore, 18)
					: null,
				volunteersNeeded: e.volunteersNeeded,
				acceptedCount: e.accepted ?? 0,
				status: "PUBLISHED",
				createdBy: owner.id,
				createdAt: daysAgo(Math.max(1, e.inDays - 10)),
				updatedAt: daysAgo(Math.max(1, e.inDays - 10)),
			});
			eventCount++;
		}

		for (const s of ngo.stories) {
			await db.insert(announcements).values({
				organizationId: org.id,
				title: s.title,
				body: s.body,
				coverImageKey:
					s.coverImage ??
					DEMO_IMAGES[(index + storyCount) % DEMO_IMAGES.length],
				status: "PUBLISHED",
				isPinned: s.pinned ?? false,
				publishedAt: daysAgo(s.daysAgo),
				createdBy: owner.id,
				createdAt: daysAgo(s.daysAgo),
				updatedAt: daysAgo(s.daysAgo),
			});
			storyCount++;
		}

		for (const [postIndex, text] of DEMO_POST_TEXT.entries()) {
			const [post] = await db
				.insert(posts)
				.values({
					authorUserId: owner.id,
					organizationId: org.id,
					tag: postIndex === 1 ? "URGENT" : "POST",
					city: ngo.city,
					state: ngo.state,
					mediaFolder: `demo-${String(index + 1).padStart(2, "0")}-${postIndex + 1}-${Date.now()}`,
					text: `${ngo.name}: ${text}`,
					createdAt: daysAgo(postIndex + index + 1),
				})
				.returning();
			if (!post) throw new Error("post insert failed");

			const mediaKeys =
				postIndex === 0
					? [DEMO_IMAGES[index % DEMO_IMAGES.length]]
					: postIndex === 1
						? [DEMO_IMAGES[(index + 1) % DEMO_IMAGES.length], DEMO_VIDEO]
						: postIndex === 2
							? [
									DEMO_IMAGES[(index + 2) % DEMO_IMAGES.length],
									DEMO_IMAGES[(index + 3) % DEMO_IMAGES.length],
									DEMO_IMAGES[(index + 4) % DEMO_IMAGES.length],
								]
							: [DEMO_VIDEO, DEMO_IMAGES[(index + 5) % DEMO_IMAGES.length]];
			await db.insert(postsMedia).values(
				mediaKeys.map((objectKey, sortOrder) => {
					const mediaKey = objectKey ?? (DEMO_IMAGES[0] as string);
					return {
						postId: post.id,
						objectKey: `${mediaKey}${mediaKey.includes("?") ? `&demo=${index}-${postIndex}-${sortOrder}` : `?demo=${index}-${postIndex}-${sortOrder}`}`,
						mediaType: mediaKey.includes(".mp4")
							? ("VIDEO" as const)
							: ("IMAGE" as const),
						mimeType: mediaKey.includes(".mp4") ? "video/mp4" : "image/jpeg",
						sortOrder,
					};
				}),
			);
			postCount++;
			mediaCount += mediaKeys.length;
		}
	}

	console.log(`  NGOs     → ${NGOS.length}`);
	console.log(`  needs    → ${needCount}`);
	console.log(`  events   → ${eventCount}`);
	console.log(`  stories  → ${storyCount}`);
	console.log(`  posts    → ${postCount}`);
	console.log(`  media    → ${mediaCount} (images + videos)`);
	console.log("Demo seed complete.");
	process.exit(0);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
