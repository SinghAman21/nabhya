/**
 * "Flex" seed: a large, internally consistent dataset so every screen, table and
 * chart in the app has something real to show - ~45 NGOs, ~300 volunteers,
 * events with applications in every state, attendance and certificates, needs
 * with pledges, a year of donations, reviews, follows, feed engagement,
 * notifications, documents for the verification queues and an audit trail.
 * It also fills in the empty fields on the three demo accounts
 * (ngo@nabhya.com, volunteer@nabhya.com, superadmin@nabhya.com) and gives them
 * a full history.
 *
 *   pnpm --filter @nabhya/db db:seed:flex           # seed (idempotent)
 *   pnpm --filter @nabhya/db db:seed:flex:cleanup   # dry run of the removal
 *
 * Additive only: it never updates or deletes a pre-existing row, except to fill
 * NULL/empty fields on the three demo accounts. Every id it writes starts with
 * `5eedf1e0-` and is derived from a stable label, so a second run inserts
 * nothing new. See seed-flex-lib.ts for the full tagging scheme.
 *
 * Nothing here sends email, touches Razorpay or creates Supabase Auth users:
 * rows go straight in with Drizzle, files straight into Supabase Storage.
 * Logos and document images are rendered with @resvg/resvg-js, which is not a
 * dependency of this package - point SEED_FLEX_RESVG_DIR at a folder where it
 * is installed (`npm i @resvg/resvg-js` in any scratch folder). It is only
 * needed the first time; rendered files are reused from storage afterwards.
 *
 * Run `db:seed` first for roles and categories.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { eq, inArray, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import * as s from "./schema";
import {
	ANNOUNCEMENTS,
	APPLICATION_MESSAGES,
	AVATAR_POOL,
	BIO_TEMPLATES,
	CAUSE_LABEL,
	type Cause,
	CITY_COORDS,
	CITY_STATES,
	COMMENTS,
	DESIGNATIONS,
	DONATION_MESSAGES,
	EVENTS,
	FIRST_NAMES,
	LANGS,
	LAST_NAMES,
	NEEDS,
	ORGS,
	type OrgDef,
	PHOTO_POOL,
	PLEDGE_MESSAGES,
	POSTS,
	PROFESSIONS,
	REVIEW_REPLIES,
	REVIEWS,
	SELFIE_POOL,
	VOLUNTEER_POSTS,
} from "./seed-flex-data";
import {
	copyObject,
	hashHex,
	loadServerEnv,
	mapLimit,
	type Rng,
	rngFor,
	SEED_EMAIL_DOMAIN,
	SEED_PAYMENT_PREFIX,
	sid,
	storageConfigured,
	uploadObject,
} from "./seed-flex-lib";

loadServerEnv();
const { db } = await import("./index");

// ─── Time ────────────────────────────────────────────────────────────────────

const DAY = 86_400_000;
const HOUR = 3_600_000;
/**
 * "Now" for the dataset. Every timestamp is an offset from it, and several
 * choices (who was eligible to apply, which events are past) compare those
 * timestamps, so a re-run must use the same value or it builds a slightly
 * different dataset and inserts the difference. The first run stores it as an
 * audit row (`SEED_FLEX_ANCHOR`); later runs read it back.
 */
let NOW = Date.now();
const ANCHOR_ID = sid("anchor");
const ago = (days: number) => new Date(NOW - days * DAY);
/** A wall-clock time in IST, `days` from today. */
function istAt(days: number, hour: number, minute = 0) {
	const d = new Date(NOW + days * DAY);
	d.setUTCHours(0, 0, 0, 0);
	return new Date(d.getTime() + (hour - 5.5) * HOUR + minute * 60_000);
}
const clampPast = (d: Date) => (d.getTime() > NOW ? new Date(NOW - 60_000) : d);
const between = (r: Rng, from: Date, to: Date) =>
	new Date(
		from.getTime() + r.next() * Math.max(0, to.getTime() - from.getTime()),
	);
/**
 * A moment `minDays`-`maxDays` after `t`, squeezed into the past when that
 * would land in the future - clamping to "now" instead piles hundreds of rows
 * onto the same minute, which reads as "5 minutes ago" everywhere and spikes
 * every per-day chart.
 */
function soonAfter(r: Rng, t: Date, minDays: number, maxDays: number) {
	const span = r.float(minDays, maxDays) * DAY;
	if (t.getTime() + span < NOW) return new Date(t.getTime() + span);
	const room = NOW - t.getTime();
	return room > 0 ? new Date(t.getTime() + r.float(0.15, 0.95) * room) : t;
}
const minDate = (a: Date, b: Date) => (a.getTime() < b.getTime() ? a : b);
const maxDate = (a: Date, b: Date) => (a.getTime() > b.getTime() ? a : b);

// ─── Types for what we build ────────────────────────────────────────────────

type Insert<T extends PgTable> = T["$inferInsert"];

interface Person {
	id: string;
	name: string;
	email: string;
	city: string;
	createdAt: Date;
}

interface Vol extends Person {
	status: "VERIFIED" | "PENDING" | "REJECTED";
	verifiedAt: Date;
	causes: Cause[];
	named?: boolean;
}

interface Org {
	id: string;
	def: OrgDef;
	ownerId: string;
	createdAt: Date;
	visible: boolean;
	named?: boolean;
	team: string[];
	causes: Cause[];
	city: string;
	state: string;
	lat: number;
	lng: number;
}

interface Ev {
	id: string;
	org: Org;
	title: string;
	startAt: Date;
	endAt: Date;
	createdAt: Date;
	status: "DRAFT" | "PUBLISHED" | "CANCELLED" | "COMPLETED";
	needed: number;
	hours: number;
	kind:
		| "past"
		| "upcoming"
		| "full"
		| "closed"
		| "urgent"
		| "draft"
		| "cancelled";
}

// ─── Collections ────────────────────────────────────────────────────────────

const rows = {
	users: [] as Insert<typeof s.users>[],
	userRoles: [] as Insert<typeof s.userRoles>[],
	userCategories: [] as Insert<typeof s.userCategories>[],
	userDocuments: [] as Insert<typeof s.userDocuments>[],
	organizations: [] as Insert<typeof s.organizations>[],
	organizationCategories: [] as Insert<typeof s.organizationCategories>[],
	organizationAdmins: [] as Insert<typeof s.organizationAdmins>[],
	organizationDocuments: [] as Insert<typeof s.organizationDocuments>[],
	teamInvites: [] as Insert<typeof s.teamInvites>[],
	events: [] as Insert<typeof s.events>[],
	eventApplications: [] as Insert<typeof s.eventApplications>[],
	certificates: [] as Insert<typeof s.certificates>[],
	needs: [] as Insert<typeof s.needs>[],
	needPledges: [] as Insert<typeof s.needPledges>[],
	donations: [] as Insert<typeof s.donations>[],
	reviews: [] as Insert<typeof s.reviews>[],
	follows: [] as Insert<typeof s.follows>[],
	bookmarks: [] as Insert<typeof s.bookmarks>[],
	announcements: [] as Insert<typeof s.announcements>[],
	financialReports: [] as Insert<typeof s.financialReports>[],
	posts: [] as Insert<typeof s.posts>[],
	postsMedia: [] as Insert<typeof s.postsMedia>[],
	postInteractions: [] as Insert<typeof s.postInteractions>[],
	postComments: [] as Insert<typeof s.postComments>[],
	notifications: [] as Insert<typeof s.notifications>[],
	auditLogs: [] as Insert<typeof s.auditLogs>[],
};

/** Storage work: objects rendered/downloaded into the pool, then copied out. */
const poolUploads = new Map<
	string,
	() => Promise<{ body: Uint8Array; contentType: string }>
>();
const directUploads = new Map<
	string,
	() => Promise<{ body: Uint8Array; contentType: string }>
>();
const copies = new Map<string, string>(); // destination -> source

const FEED = "feed_media";
const DOCS = "ngo_verification";
const photoPoolKey = (id: number) => `${FEED}/seed/pool/photo-${id}.jpg`;
const avatarPoolKey = (id: number) => `${FEED}/seed/pool/avatar-${id}.jpg`;
const selfiePoolKey = (id: number) => `${DOCS}/seed/pool/selfie-${id}.jpg`;
const idPoolKey = (n: number) => `${DOCS}/seed/pool/id-card-${n}.png`;
const reportPoolKey = (n: number) => `${FEED}/seed/pool/report-${n}.png`;

function wantPhoto(id: number) {
	const key = photoPoolKey(id);
	if (!poolUploads.has(key))
		poolUploads.set(key, () =>
			fetchImage(`https://picsum.photos/id/${id}/1200/800.jpg`),
		);
	return key;
}
function wantAvatar(id: number) {
	const key = avatarPoolKey(id);
	if (!poolUploads.has(key))
		poolUploads.set(key, () =>
			fetchImage(`https://picsum.photos/id/${id}/400/400.jpg`),
		);
	return key;
}
function wantSelfie(id: number) {
	const key = selfiePoolKey(id);
	if (!poolUploads.has(key))
		poolUploads.set(key, () =>
			fetchImage(`https://picsum.photos/id/${id}/600/800.jpg`),
		);
	return key;
}
function copyTo(destination: string, source: string) {
	copies.set(destination, source);
	return destination;
}

async function fetchImage(url: string) {
	for (let attempt = 0; ; attempt++) {
		try {
			const response = await fetch(url);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const type = response.headers.get("content-type") ?? "";
			if (!type.startsWith("image/")) throw new Error(`not an image: ${type}`);
			return {
				body: new Uint8Array(await response.arrayBuffer()),
				contentType: "image/jpeg",
			};
		} catch (error) {
			if (attempt >= 3)
				throw new Error(`Could not download ${url}: ${String(error)}`);
			await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
		}
	}
}

// ─── Rendering: SVG → PNG via resvg (optional dep), and tiny PDFs ───────────

type Resvg = new (
	svg: string,
	options?: Record<string, unknown>,
) => { render(): { asPng(): Uint8Array } };
let resvgCtor: Resvg | null | undefined;
function resvg(): Resvg {
	if (resvgCtor === undefined) {
		resvgCtor = null;
		const dirs = [process.env.SEED_FLEX_RESVG_DIR, process.cwd()].filter(
			Boolean,
		) as string[];
		for (const dir of dirs) {
			try {
				const req = createRequire(path.join(dir, "package.json"));
				resvgCtor = (req("@resvg/resvg-js") as { Resvg: Resvg }).Resvg;
				break;
			} catch {}
		}
	}
	if (!resvgCtor) {
		throw new Error(
			"Rendering logos/documents needs @resvg/resvg-js. Install it in a scratch folder and set SEED_FLEX_RESVG_DIR to that folder.",
		);
	}
	return resvgCtor;
}
function renderPng(svg: string) {
	const R = resvg();
	return {
		body: new R(svg, { font: { loadSystemFonts: true } }).render().asPng(),
		contentType: "image/png",
	};
}

const esc = (t: string) =>
	t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function initials(name: string) {
	const skip = new Set(["of", "the", "and", "for", "&"]);
	const words = name.split(/\s+/).filter((w) => !skip.has(w.toLowerCase()));
	return ((words[0]?.[0] ?? "N") + (words[1]?.[0] ?? "")).toUpperCase();
}

function logoSvg(name: string, color: string, variant: number) {
	const letters = esc(initials(name));
	const shapes = [
		`<rect width="512" height="512" rx="120" fill="${color}"/>`,
		`<circle cx="256" cy="256" r="256" fill="${color}"/>`,
		`<rect width="512" height="512" rx="40" fill="#FFFBF5"/><rect x="36" y="36" width="440" height="440" rx="28" fill="${color}"/>`,
		`<rect width="512" height="512" rx="120" fill="${color}"/><circle cx="400" cy="112" r="70" fill="#ffffff" fill-opacity="0.18"/>`,
	];
	const fonts = ["Georgia", "Segoe UI", "Trebuchet MS", "Cambria"];
	const font = fonts[variant % fonts.length];
	const weight = variant % 2 === 0 ? 700 : 600;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${shapes[variant % shapes.length]}<text x="256" y="${letters.length > 1 ? 322 : 330}" font-family="${font}" font-weight="${weight}" font-size="${letters.length > 1 ? 196 : 240}" fill="#ffffff" text-anchor="middle" letter-spacing="-4">${letters}</text></svg>`;
}

function idCardSvg(variant: number) {
	const tones = ["#E0F2FE", "#FEF3C7", "#DCFCE7"];
	const labels = ["IDENTITY CARD", "PERMANENT ACCOUNT", "DRIVING LICENCE"];
	return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="630" viewBox="0 0 1000 630">
<rect width="1000" height="630" rx="36" fill="${tones[variant % 3]}"/>
<rect x="0" y="0" width="1000" height="110" rx="36" fill="#1E293B"/><rect x="0" y="70" width="1000" height="40" fill="#1E293B"/>
<text x="48" y="72" font-family="Segoe UI" font-size="40" font-weight="700" fill="#ffffff">SAMPLE ${labels[variant % 3]}</text>
<rect x="48" y="160" width="220" height="280" rx="16" fill="#CBD5E1"/>
<circle cx="158" cy="260" r="58" fill="#94A3B8"/><rect x="88" y="335" width="140" height="80" rx="40" fill="#94A3B8"/>
<rect x="320" y="175" width="520" height="28" rx="8" fill="#94A3B8"/>
<rect x="320" y="235" width="420" height="22" rx="8" fill="#CBD5E1"/>
<rect x="320" y="285" width="460" height="22" rx="8" fill="#CBD5E1"/>
<rect x="320" y="335" width="360" height="22" rx="8" fill="#CBD5E1"/>
<rect x="320" y="385" width="300" height="22" rx="8" fill="#CBD5E1"/>
<text x="48" y="540" font-family="Consolas" font-size="34" fill="#334155">XXXX XXXX ${String(1000 + variant * 1234).slice(0, 4)}</text>
<text x="500" y="600" font-family="Segoe UI" font-size="26" fill="#B91C1C" text-anchor="middle" font-weight="700">SPECIMEN - SEED DATA - NOT A REAL DOCUMENT</text>
</svg>`;
}

function reportSvg(variant: number) {
	const bars = [42, 58, 51, 66, 73, 80].map((v, i) => {
		const h = v * 4 + variant * 6;
		return `<rect x="${110 + i * 120}" y="${640 - h}" width="70" height="${h}" rx="8" fill="${i === 5 ? "#0F766E" : "#99F6E4"}"/>`;
	});
	return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
<rect width="900" height="1200" fill="#ffffff"/><rect width="900" height="150" fill="#0F172A"/>
<text x="60" y="95" font-family="Georgia" font-size="46" fill="#ffffff">Utilisation Certificate</text>
<text x="60" y="210" font-family="Segoe UI" font-size="26" fill="#475569">Funds received and applied, by quarter</text>
${bars.join("")}
<line x1="80" y1="640" x2="820" y2="640" stroke="#94A3B8" stroke-width="2"/>
<text x="60" y="760" font-family="Segoe UI" font-size="28" fill="#0F172A">Programme costs        78%</text>
<text x="60" y="810" font-family="Segoe UI" font-size="28" fill="#0F172A">Administration          14%</text>
<text x="60" y="860" font-family="Segoe UI" font-size="28" fill="#0F172A">Fundraising                8%</text>
<text x="450" y="1140" font-family="Segoe UI" font-size="22" fill="#B91C1C" text-anchor="middle">SAMPLE - SEED DATA</text>
</svg>`;
}

/** A one-page PDF with a title and lines of Helvetica text. ASCII only. */
function makePdf(title: string, lines: string[]): Uint8Array {
	const clean = (t: string) =>
		t.replace(/[^\x20-\x7E]/g, "-").replace(/([\\()])/g, "\\$1");
	const body = [
		"0.06 0.09 0.16 rg 0 772 612 70 re f",
		`BT /F2 20 Tf 1 1 1 rg 50 800 Td (${clean(title)}) Tj ET`,
		"BT /F1 11 Tf 0.1 0.1 0.1 rg 16 TL 50 735 Td",
		...lines.map((l) => `(${clean(l)}) Tj T*`),
		"ET",
		"0.8 0.1 0.1 rg BT /F2 12 Tf 50 60 Td (SAMPLE DOCUMENT - SEED DATA - NOT A REAL RECORD) Tj ET",
		"0.7 0.7 0.7 RG 40 40 532 712 re S",
	].join("\n");
	const objects = [
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
		`<< /Length ${Buffer.byteLength(body, "latin1")} >>\nstream\n${body}\nendstream`,
	];
	let out = "%PDF-1.4\n";
	const offsets: number[] = [];
	objects.forEach((obj, i) => {
		offsets.push(Buffer.byteLength(out, "latin1"));
		out += `${i + 1} 0 obj\n${obj}\nendobj\n`;
	});
	const xref = Buffer.byteLength(out, "latin1");
	out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
	for (const offset of offsets)
		out += `${String(offset).padStart(10, "0")} 00000 n \n`;
	out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
	return new Uint8Array(Buffer.from(out, "latin1"));
}

const pdf = (title: string, lines: string[]) => async () => ({
	body: makePdf(title, lines),
	contentType: "application/pdf",
});

// ─── Small helpers ──────────────────────────────────────────────────────────

const jitter = (r: Rng, v: number, by = 0.05) => v + r.float(-by, by);
const coordsOf = (city: string) =>
	CITY_COORDS[city] ?? ([20.59, 78.96] as const);
const stateOf = (city: string) => CITY_STATES[city] ?? "Maharashtra";
const fmtInr = (rupees: number) => `Rs ${rupees.toLocaleString("en-IN")}`;

function personName(i: number) {
	const first = FIRST_NAMES[i % FIRST_NAMES.length] as string;
	const last = LAST_NAMES[(i * 7 + 3) % LAST_NAMES.length] as string;
	return { first, last, full: `${first} ${last}` };
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function certCode(label: string) {
	const hex = hashHex(label, 16);
	let out = "";
	for (let i = 0; i < 8; i++) {
		const n = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
		out += CODE_ALPHABET[n % CODE_ALPHABET.length];
	}
	return `NBH-${out.slice(0, 4)}-${out.slice(4)}`;
}
function receiptNumber(createdAt: Date, id: string) {
	const year = String(createdAt.getFullYear()).slice(2);
	const month = String(createdAt.getMonth() + 1).padStart(2, "0");
	// The server slices the start of the uuid; every seeded id starts with the
	// same prefix, so take the random tail instead or every receipt collides.
	return `NBH-${year}${month}-${id.replace(/-/g, "").slice(-6).toUpperCase()}`;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
	const [anchor] = await db
		.select({
			createdAt: s.auditLogs.createdAt,
			newValue: s.auditLogs.newValue,
		})
		.from(s.auditLogs)
		.where(eq(s.auditLogs.id, ANCHOR_ID));
	if (anchor) NOW = anchor.createdAt.getTime();
	const completedAt = (anchor?.newValue as { completedAt?: string } | null)
		?.completedAt;
	if (
		completedAt &&
		!process.argv.includes("--force") &&
		!process.argv.includes("--plan")
	) {
		// A finished seed is left exactly as it is. Re-building matches the
		// stored rows only while this file is unchanged; after any edit it would
		// top the dataset up with near-duplicates. --force does that on purpose
		// (ids still rule out true duplicates, and counters are reconciled).
		console.log(
			`Flex seed: already complete (seeded ${completedAt}). Nothing to do - pass --force to top up.`,
		);
		await printSeededCounts();
		process.exit(0);
	}
	console.log(
		`Flex seed: building dataset as of ${new Date(NOW).toISOString()}${anchor ? " (anchor from first run)" : ""}...`,
	);

	const roleRows = await db.select().from(s.roles);
	const roleId = (name: string) => {
		const row = roleRows.find((r) => r.name === name);
		if (!row) throw new Error(`Role ${name} missing - run db:seed first.`);
		return row.id;
	};
	const categoryRows = await db.select().from(s.categories);
	const categoryId = (slugName: string) => {
		const row = categoryRows.find((c) => c.slug === slugName);
		if (!row)
			throw new Error(`Category ${slugName} missing - run db:seed first.`);
		return row.id;
	};

	const named = await db
		.select()
		.from(s.users)
		.where(
			inArray(s.users.email, [
				"ngo@nabhya.com",
				"volunteer@nabhya.com",
				"superadmin@nabhya.com",
			]),
		);
	const ngoUser = named.find((u) => u.email === "ngo@nabhya.com");
	const volUser = named.find((u) => u.email === "volunteer@nabhya.com");
	const adminUser = named.find((u) => u.email === "superadmin@nabhya.com");
	if (!ngoUser || !volUser || !adminUser)
		throw new Error("The three demo accounts must exist before seeding.");
	const [ngoOrgRow] = await db
		.select()
		.from(s.organizations)
		.where(eq(s.organizations.ownerUserId, ngoUser.id));
	if (!ngoOrgRow) throw new Error("ngo@nabhya.com has no organisation.");
	const ADMIN = adminUser.id;

	// ── Volunteers ────────────────────────────────────────────────────────
	const volunteerCities = [
		...ORGS.filter((o) => o.lifecycle === "verified").map((o) => o.city),
		"Mumbai",
		"Mumbai",
		"Mumbai",
		"Thane",
		"Thane",
		"Navi Mumbai",
		"Navi Mumbai",
		"Pune",
		"Pune",
		"Bengaluru",
		"Bengaluru",
		"Delhi",
		"Delhi",
		"Hyderabad",
		"Gurugram",
		"Noida",
	];
	const vols: Vol[] = [];
	const allCauses = Object.keys(EVENTS) as Cause[];
	for (let i = 0; i < 300; i++) {
		const r = rngFor(`vol:${i}`);
		const { first, last, full } = personName(i);
		const id = sid(`vol:${i}`);
		const city = r.pick(volunteerCities);
		const old = r.chance(0.3);
		const daysAgoJoined = old
			? r.float(90, 400)
			: 90 * (1 - r.next() ** 0.55) + 0.2;
		const createdAt = ago(daysAgoJoined);
		const roll = r.next();
		const status: Vol["status"] =
			roll < 0.66 ? "VERIFIED" : roll < 0.95 ? "PENDING" : "REJECTED";
		const hasDocs = status !== "PENDING" || r.chance(0.55);
		const causes = r.sample(allCauses, r.int(1, 4));
		const vol: Vol = {
			id,
			name: full,
			email: `${first}.${last}${i}@${SEED_EMAIL_DOMAIN}`.toLowerCase(),
			city,
			createdAt,
			status,
			verifiedAt: soonAfter(r, createdAt, 0.5, 3),
			causes,
		};
		vols.push(vol);
		const [lat, lng] = coordsOf(city);
		const avatar = r.chance(0.58)
			? copyTo(
					`${FEED}/avatars/${id}/seed/avatar.jpg`,
					wantAvatar(r.pick(AVATAR_POOL)),
				)
			: null;
		const suspended = i % 97 === 13;
		rows.users.push({
			id,
			fullName: full,
			email: vol.email,
			profileImage: avatar,
			bio: r.chance(0.78)
				? r
						.pick(BIO_TEMPLATES)
						.replace("{prof}", capitalise(r.pick(PROFESSIONS)))
						.replace("{city}", city)
						.replace("{cause}", CAUSE_LABEL[causes[0] as Cause])
						.replace("{lang}", r.pick(LANGS))
				: null,
			city,
			state: stateOf(city),
			latitude: String(jitter(r, lat).toFixed(5)),
			longitude: String(jitter(r, lng).toFixed(5)),
			emailVerified: true,
			verificationStatus: status,
			status: suspended ? "SUSPENDED" : "ACTIVE",
			suspendedReason: suspended
				? "Repeated no-shows after accepting event places."
				: null,
			onboardedAt: new Date(createdAt.getTime() + 12 * 60_000),
			createdAt,
			updatedAt: createdAt,
		});
		rows.userRoles.push({
			id: sid(`vol-role:${i}`),
			userId: id,
			roleId: roleId("volunteer"),
			assignedAt: new Date(createdAt.getTime() + 5 * 60_000),
		});
		for (const cause of causes) {
			rows.userCategories.push({
				id: sid(`vol-cat:${i}:${cause}`),
				userId: id,
				categoryId: categoryId(cause),
				assignedAt: createdAt,
			});
		}
		if (hasDocs) {
			const uploaded = new Date(createdAt.getTime() + r.float(0.1, 0.5) * DAY);
			const govType = r.pick([
				"AADHAR_CARD",
				"PAN_CARD",
				"DRIVING_LICENSE",
				"VOTER_ID",
			] as const);
			const govStatus =
				status === "VERIFIED"
					? "VERIFIED"
					: status === "REJECTED" && r.chance(0.6)
						? "REJECTED"
						: "PENDING";
			const selfieStatus =
				status === "VERIFIED"
					? "VERIFIED"
					: status === "REJECTED" && govStatus !== "REJECTED"
						? "REJECTED"
						: "PENDING";
			const reviewed = (st: string) =>
				st === "PENDING"
					? { verifiedBy: null, verifiedAt: null }
					: { verifiedBy: ADMIN, verifiedAt: clampPast(vol.verifiedAt) };
			rows.userDocuments.push({
				id: sid(`vol-doc:${i}:gov`),
				userId: id,
				documentType: govType,
				documentKey: copyTo(
					`${DOCS}/user-documents/${id}/seed/${govType.toLowerCase()}.png`,
					idPoolKey(i % 3),
				),
				verificationStatus: govStatus,
				remarks:
					govStatus === "REJECTED"
						? "The photo is blurred and the number is not readable. Please upload a clearer scan."
						: null,
				uploadedAt: uploaded,
				...reviewed(govStatus),
			});
			rows.userDocuments.push({
				id: sid(`vol-doc:${i}:selfie`),
				userId: id,
				documentType: "SELFIE",
				documentKey: copyTo(
					`${DOCS}/user-documents/${id}/seed/selfie.jpg`,
					wantSelfie(r.pick(SELFIE_POOL)),
				),
				verificationStatus: selfieStatus,
				remarks:
					selfieStatus === "REJECTED"
						? "The selfie does not match the ID photo. Please retake it in good light."
						: null,
				metadata: { challenge: r.pick(["BLINK", "TURN_LEFT", "TURN_RIGHT"]) },
				uploadedAt: new Date(uploaded.getTime() + 3 * 60_000),
				...reviewed(selfieStatus),
			});
		}
	}
	// Images used by idPoolKey must be rendered.
	for (let n = 0; n < 3; n++)
		poolUploads.set(idPoolKey(n), async () => renderPng(idCardSvg(n)));

	// The demo volunteer joins the pools so it can apply, pledge and review.
	const namedVol: Vol = {
		id: volUser.id,
		name: volUser.fullName ?? "Volunteer",
		email: volUser.email,
		city: volUser.city ?? "Navi Mumbai",
		createdAt: volUser.createdAt,
		status: "VERIFIED",
		verifiedAt: new Date(volUser.createdAt.getTime() + DAY),
		causes: ["education", "environment", "food-nutrition"],
		named: true,
	};
	const verifiedVols = vols.filter((v) => v.status === "VERIFIED");
	const activeVols = vols;

	// ── Organisations ─────────────────────────────────────────────────────
	const orgs: Org[] = [];
	let personSeq = 1000;
	ORGS.forEach((def, index) => {
		const r = rngFor(`org:${def.key}`);
		const id = sid(`org:${def.key}`);
		const ownerId = sid(`org-owner:${def.key}`);
		const createdAt =
			def.lifecycle === "pending" || def.lifecycle === "review"
				? ago(r.float(2, 18))
				: def.lifecycle === "rejected"
					? ago(r.float(25, 80))
					: ago(r.float(150, 420));
		const [lat, lng] = coordsOf(def.city);
		const org: Org = {
			id,
			def,
			ownerId,
			createdAt,
			visible: def.lifecycle === "verified",
			team: [],
			causes: def.causes,
			city: def.city,
			state: stateOf(def.city),
			lat: jitter(r, lat, 0.04),
			lng: jitter(r, lng, 0.04),
		};
		orgs.push(org);
		const owner = personName(personSeq++);
		const ownerCreated = new Date(createdAt.getTime() - 2 * HOUR);
		rows.users.push({
			id: ownerId,
			fullName: owner.full,
			email:
				`${owner.first}.${owner.last}.${def.key}@${SEED_EMAIL_DOMAIN}`.toLowerCase(),
			city: def.city,
			state: org.state,
			emailVerified: true,
			verificationStatus: "PENDING",
			status: "ACTIVE",
			onboardedAt: createdAt,
			createdAt: ownerCreated,
			updatedAt: ownerCreated,
		});
		rows.userRoles.push({
			id: sid(`org-owner-role:${def.key}`),
			userId: ownerId,
			roleId: roleId("organisation"),
			assignedAt: ownerCreated,
		});
		const reviewed = def.lifecycle !== "pending" && def.lifecycle !== "review";
		const reviewedAt = new Date(createdAt.getTime() + r.float(2, 9) * DAY);
		const regNo =
			def.type === "SECTION_8"
				? `U85300${stateCode(org.state)}${def.founded}NPL${r.int(100000, 999999)}`
				: def.type === "TRUST"
					? `E-${r.int(10000, 39999)} (${def.city})`
					: `S/${r.int(1000, 9999)}/${def.founded}`;
		const logo = `${FEED}/org-logos/${id}/seed/logo.png`;
		directUploads.set(logo, async () =>
			renderPng(logoSvg(def.name, def.color, index)),
		);
		const cover = copyTo(
			`${FEED}/org-covers/${id}/seed/cover.jpg`,
			wantPhoto(r.pick(PHOTO_POOL[def.causes[0] as Cause])),
		);
		rows.organizations.push({
			id,
			ownerUserId: ownerId,
			organizationName: def.name,
			orgType: def.type,
			registrationNumber: regNo,
			email: `${def.key}@${SEED_EMAIL_DOMAIN}`,
			description: def.description,
			mission: def.mission,
			vision: `A ${def.city} where ${CAUSE_LABEL[def.causes[0] as Cause]} is everyone's work, not a few people's.`,
			website: `https://${def.key}.${SEED_EMAIL_DOMAIN}`,
			logo,
			coverImage: cover,
			address: `${def.area}, ${def.city}`,
			city: def.city,
			state: org.state,
			pincode: def.pincode,
			latitude: org.lat.toFixed(6),
			longitude: org.lng.toFixed(6),
			teamSize: r.int(5, 60),
			foundingYear: def.founded,
			verificationStatus:
				def.lifecycle === "pending"
					? "PENDING"
					: def.lifecycle === "review"
						? "UNDER_REVIEW"
						: def.lifecycle === "rejected"
							? "REJECTED"
							: "VERIFIED",
			rejectionReason:
				def.lifecycle === "rejected"
					? r.pick([
							"The registration certificate is illegible and the PAN does not match the organisation name. Please upload clear copies.",
							"We could not verify the registration number with the registrar. Please upload the latest certificate.",
						])
					: null,
			reviewedBy: reviewed ? ADMIN : null,
			reviewedAt: reviewed ? reviewedAt : null,
			status:
				def.lifecycle === "suspended"
					? "SUSPENDED"
					: def.lifecycle === "deleted"
						? "DELETED"
						: "ACTIVE",
			statusReason:
				def.lifecycle === "suspended"
					? "Suspended pending review of donor complaints about undelivered items."
					: def.lifecycle === "deleted"
						? "Closed at the organisation's request."
						: null,
			deletedAt: def.lifecycle === "deleted" ? ago(12) : null,
			deletedBy: def.lifecycle === "deleted" ? ADMIN : null,
			createdAt,
			updatedAt: createdAt,
		});
		for (const cause of def.causes) {
			rows.organizationCategories.push({
				id: sid(`org-cat:${def.key}:${cause}`),
				organizationId: id,
				categoryId: categoryId(cause),
				assignedAt: createdAt,
			});
		}
		rows.organizationAdmins.push({
			id: sid(`org-admin:${def.key}:owner`),
			organizationId: id,
			userId: ownerId,
			designation: r.pick(["Founder", "Executive Director", "Founder & CEO"]),
			role: "OWNER",
			status: "ACTIVE",
			isOwner: true,
			isPublic: true,
			joinedAt: createdAt,
			lastActiveAt: ago(r.float(0, 5)),
			updatedAt: createdAt,
		});
		if (org.visible || def.lifecycle === "suspended") {
			const teamCount = r.int(2, 4);
			const roles = ["ADMIN", "MANAGER", "MEMBER", "VIEWER"] as const;
			for (let t = 0; t < teamCount; t++) {
				const role = roles[t] as (typeof roles)[number];
				addTeamMember(org, `${def.key}:${t}`, role, r, personSeq++);
			}
		}
		addOrgDocuments(org, r);
	});

	function addTeamMember(
		org: Org,
		label: string,
		role: "ADMIN" | "MANAGER" | "MEMBER" | "VIEWER",
		r: Rng,
		seq: number,
	) {
		const p = personName(seq);
		const userId = sid(`team:${label}`);
		const joined = new Date(org.createdAt.getTime() + r.float(5, 60) * DAY);
		const joinedAt = clampPast(joined);
		rows.users.push({
			id: userId,
			fullName: p.full,
			email: `${p.first}.${p.last}.t${seq}@${SEED_EMAIL_DOMAIN}`.toLowerCase(),
			city: org.city,
			state: org.state,
			emailVerified: true,
			status: "ACTIVE",
			onboardedAt: joinedAt,
			createdAt: joinedAt,
			updatedAt: joinedAt,
		});
		rows.userRoles.push({
			id: sid(`team-role:${label}`),
			userId,
			roleId: roleId("organisation"),
			assignedAt: joinedAt,
		});
		rows.organizationAdmins.push({
			id: sid(`org-admin:${label}`),
			organizationId: org.id,
			userId,
			designation: r.pick(DESIGNATIONS[role]),
			role,
			status: "ACTIVE",
			isOwner: false,
			isPublic: role !== "VIEWER",
			invitedBy: org.ownerId,
			invitedAt: new Date(joinedAt.getTime() - DAY),
			joinedAt,
			lastActiveAt: ago(r.float(0, 12)),
			updatedAt: joinedAt,
		});
		if (role !== "VIEWER") org.team.push(userId);
		return userId;
	}

	function addOrgDocuments(org: Org, r: Rng) {
		const life = org.def.lifecycle;
		const core = [
			"NGO_REGISTRATION_CERTIFICATE",
			"PAN_CARD",
			"80G_CERTIFICATE",
			"12A_CERTIFICATE",
		] as const;
		const labels: Record<string, string> = {
			NGO_REGISTRATION_CERTIFICATE: "Certificate of Registration",
			PAN_CARD: "PAN Card",
			"80G_CERTIFICATE": "80G Registration",
			"12A_CERTIFICATE": "12A Registration",
			GST_CERTIFICATE: "GST Registration Certificate",
			BANK_ACCOUNT_PROOF: "Cancelled Cheque / Bank Letter",
			OTHER: "Trust Deed",
		};
		const docs: {
			type:
				| (typeof core)[number]
				| "GST_CERTIFICATE"
				| "BANK_ACCOUNT_PROOF"
				| "OTHER";
			status: "PENDING" | "VERIFIED" | "REJECTED";
			uploaded: Date;
			remarks?: string;
		}[] = [];
		const first = new Date(org.createdAt.getTime() + HOUR);
		for (const [i, type] of core.entries()) {
			let status: "PENDING" | "VERIFIED" | "REJECTED" = "VERIFIED";
			if (life === "pending") status = "PENDING";
			if (life === "review") status = i < 2 ? "VERIFIED" : "PENDING";
			if (life === "rejected") status = i < 2 ? "REJECTED" : "VERIFIED";
			docs.push({
				type,
				status,
				uploaded: new Date(first.getTime() + i * 7 * 60_000),
				remarks:
					status === "REJECTED"
						? "The scan is cut off at the bottom and the registrar's seal is not visible."
						: undefined,
			});
		}
		if (org.visible && r.chance(0.35)) {
			docs.push({
				type: r.pick(["GST_CERTIFICATE", "BANK_ACCOUNT_PROOF"] as const),
				status: "PENDING",
				uploaded: ago(r.float(0.2, 9)),
			});
		}
		if (org.visible && r.chance(0.15)) {
			docs.push({
				type: "OTHER",
				status: "REJECTED",
				uploaded: new Date(org.createdAt.getTime() + 2 * DAY),
				remarks:
					"This appears to be an older version of the deed. Please upload the registered copy.",
			});
		}
		if (life === "pending" || life === "review")
			docs.push({
				type: "BANK_ACCOUNT_PROOF",
				status: "PENDING",
				uploaded: first,
			});
		for (const [i, doc] of docs.entries()) {
			const docId = sid(`org-doc:${org.def.key}:${i}`);
			const key = `${DOCS}/org-documents/seed/${org.id}/${doc.type.toLowerCase().replace(/_/g, "-")}-${docId.slice(-8)}.pdf`;
			directUploads.set(
				key,
				pdf(labels[doc.type] ?? doc.type, [
					`Organisation: ${org.def.name}`,
					`Address: ${org.def.area}, ${org.city}, ${org.state} ${org.def.pincode}`,
					`Constituted as: ${org.def.type.replace("_", " ")}`,
					`Year of establishment: ${org.def.founded}`,
					"",
					"This is a placeholder generated for demonstration data.",
					"It does not certify anything about any real organisation.",
				]),
			);
			const reviewedAt = new Date(doc.uploaded.getTime() + r.float(1, 5) * DAY);
			rows.organizationDocuments.push({
				id: docId,
				organizationId: org.id,
				documentType: doc.type,
				documentKey: key,
				verificationStatus: doc.status,
				remarks: doc.remarks ?? null,
				uploadedAt: doc.uploaded,
				verifiedBy: doc.status === "PENDING" ? null : ADMIN,
				verifiedAt: doc.status === "PENDING" ? null : clampPast(reviewedAt),
			});
		}
	}

	// The demo NGO participates as an org too (rows hang off its real id).
	const namedOrg: Org = {
		id: ngoOrgRow.id,
		def: {
			key: "nabhya-demo",
			name: ngoOrgRow.organizationName,
			city: ngoOrgRow.city || "Navi Mumbai",
			type: "SOCIETY",
			founded: ngoOrgRow.foundingYear ?? 2016,
			causes: ["education", "food-nutrition", "women-child"],
			mission: "",
			description: "",
			lifecycle: "verified",
			color: "#0F766E",
			area: "Sector 17, Vashi",
			pincode: "400703",
		},
		ownerId: ngoUser.id,
		createdAt: ngoOrgRow.createdAt,
		visible:
			ngoOrgRow.verificationStatus === "VERIFIED" &&
			ngoOrgRow.status === "ACTIVE",
		named: true,
		team: [],
		causes: ["education", "food-nutrition", "women-child"],
		city: ngoOrgRow.city || "Navi Mumbai",
		state: ngoOrgRow.state || "Maharashtra",
		lat: 19.0771,
		lng: 72.9986,
	};
	const namedLogo = `${FEED}/org-logos/${namedOrg.id}/seed/logo.png`;
	const namedCover = `${FEED}/org-covers/${namedOrg.id}/seed/cover.jpg`;
	if (!ngoOrgRow.logo)
		directUploads.set(namedLogo, async () =>
			renderPng(logoSvg(namedOrg.def.name, "#0F766E", 0)),
		);
	if (!ngoOrgRow.coverImage) copyTo(namedCover, wantPhoto(1010));
	{
		const r = rngFor("named-org-team");
		const roles = [
			"ADMIN",
			"MANAGER",
			"MANAGER",
			"MEMBER",
			"MEMBER",
			"VIEWER",
		] as const;
		roles.forEach((role, t) => {
			addTeamMember(namedOrg, `named:${t}`, role, r, personSeq++);
		});
		for (const [i, type] of (
			[
				"NGO_REGISTRATION_CERTIFICATE",
				"PAN_CARD",
				"80G_CERTIFICATE",
				"12A_CERTIFICATE",
				"BANK_ACCOUNT_PROOF",
			] as const
		).entries()) {
			const docId = sid(`named-org-doc:${i}`);
			const key = `${DOCS}/org-documents/seed/${namedOrg.id}/${type.toLowerCase().replace(/_/g, "-")}-${docId.slice(-8)}.pdf`;
			directUploads.set(
				key,
				pdf(type.replace(/_/g, " "), [
					`Organisation: ${namedOrg.def.name}`,
					`City: ${namedOrg.city}`,
					"This is a placeholder generated for demonstration data.",
				]),
			);
			const pending = i === 4;
			rows.organizationDocuments.push({
				id: docId,
				organizationId: namedOrg.id,
				documentType: type,
				documentKey: key,
				verificationStatus: pending ? "PENDING" : "VERIFIED",
				uploadedAt: pending
					? ago(1.5)
					: new Date(namedOrg.createdAt.getTime() + HOUR),
				verifiedBy: pending ? null : ADMIN,
				verifiedAt: pending
					? null
					: clampPast(new Date(namedOrg.createdAt.getTime() + 2 * DAY)),
			});
		}
		for (const cause of namedOrg.causes) {
			rows.organizationCategories.push({
				id: sid(`named-org-cat:${cause}`),
				organizationId: namedOrg.id,
				categoryId: categoryId(cause),
				assignedAt: namedOrg.createdAt,
			});
		}
		// Invites waiting on the team page.
		const invites = [
			["Programme Associate", "MEMBER", "PENDING", 4],
			["Volunteer Coordinator", "MANAGER", "PENDING", 1],
			["Board Member", "VIEWER", "EXPIRED", 12],
		] as const;
		invites.forEach(([designation, role, status, daysAgoSent], i) => {
			const p = personName(personSeq++);
			const created = ago(daysAgoSent);
			rows.teamInvites.push({
				id: sid(`named-invite:${i}`),
				organizationId: namedOrg.id,
				email:
					`${p.first}.${p.last}.invite${i}@${SEED_EMAIL_DOMAIN}`.toLowerCase(),
				role,
				designation,
				tokenHash: hashHex(`named-invite-token:${i}`, 64),
				invitedBy: ngoUser.id,
				status,
				expiresAt: new Date(created.getTime() + 7 * DAY),
				lastSentAt: created,
				createdAt: created,
				updatedAt: created,
			});
		});
	}
	orgs.forEach((org, i) => {
		if (!org.visible || i % 6 !== 2) return;
		const p = personName(personSeq++);
		const created = ago(2 + (i % 5));
		rows.teamInvites.push({
			id: sid(`invite:${org.def.key}`),
			organizationId: org.id,
			email: `${p.first}.${p.last}.invite@${SEED_EMAIL_DOMAIN}`.toLowerCase(),
			role: "MEMBER",
			designation: "Field Officer",
			tokenHash: hashHex(`invite-token:${org.def.key}`, 64),
			invitedBy: org.ownerId,
			status: "PENDING",
			expiresAt: new Date(created.getTime() + 7 * DAY),
			lastSentAt: created,
			createdAt: created,
			updatedAt: created,
		});
	});

	const visibleOrgs = [...orgs.filter((o) => o.visible), namedOrg];
	const contentOrgs = [
		...orgs.filter((o) => o.visible || o.def.lifecycle === "suspended"),
		namedOrg,
	];

	// ── Events + applications + certificates ─────────────────────────────
	const evs: Ev[] = [];
	for (const org of contentOrgs) {
		const r = rngFor(`events:${org.def.key}`);
		const isNamed = !!org.named;
		const plan: Ev["kind"][] = isNamed
			? [
					"past",
					"past",
					"past",
					"past",
					"past",
					"past",
					"cancelled",
					"urgent",
					"upcoming",
					"upcoming",
					"upcoming",
					"full",
					"closed",
					"draft",
					"draft",
				]
			: [
					"past",
					"past",
					"past",
					...(r.chance(0.2) ? (["cancelled"] as const) : []),
					...(r.chance(0.3) ? (["urgent"] as const) : []),
					"upcoming",
					"upcoming",
					...(r.chance(0.35) ? (["full"] as const) : ["upcoming" as const]),
					...(r.chance(0.25) ? (["closed"] as const) : []),
					...(r.chance(0.5) ? (["draft"] as const) : []),
				];
		const templates = org.causes.flatMap((c) =>
			EVENTS[c].map((tpl) => ({ ...tpl, cause: c })),
		);
		const used = new Set<string>();
		plan.forEach((kind, n) => {
			const tpl =
				r.sample(
					templates.filter((t) => !used.has(t.title)),
					1,
				)[0] ?? r.pick(templates);
			const reused = used.has(tpl.title);
			used.add(tpl.title);

			let startDays: number;
			// Past events fall inside the org's lifetime, with a week to recruit.
			const orgAgeDays = (NOW - org.createdAt.getTime()) / DAY;
			const pastSpan = Math.max(4, orgAgeDays - 9);
			if (kind === "past")
				startDays = isNamed
					? -Math.min(pastSpan, 3 + n * (pastSpan / 6) + r.float(0, 3))
					: -Math.min(pastSpan, r.float(3, 260));
			else if (kind === "cancelled")
				startDays = r.float(-Math.min(40, pastSpan), 12);
			else if (kind === "urgent") startDays = r.float(0.6, 2.6);
			else if (kind === "closed") startDays = r.float(2, 6);
			else if (kind === "draft") startDays = r.float(18, 60);
			else startDays = r.float(4, 48);
			const hour = r.pick([7, 8, 9, 10, 16]);
			const startAt = istAt(Math.round(startDays), hour, r.pick([0, 30]));
			const endAt = new Date(startAt.getTime() + tpl.hours * HOUR);
			// A repeated template is a recurring event; date it so the list
			// does not show two identical rows.
			const title = reused
				? `${tpl.title} - ${startAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}`
				: tpl.title;
			const leadDays = r.float(7, 35);
			// Upcoming events were posted weeks ago (not all in the last few days,
			// which would pile every application into this week); past ones a
			// few weeks before they ran. Always at least a day before the start.
			const orgFloor = minDate(new Date(org.createdAt.getTime() + DAY), ago(1));
			let createdAt =
				startAt.getTime() > NOW
					? maxDate(ago(r.float(3, 45)), orgFloor)
					: maxDate(new Date(startAt.getTime() - leadDays * DAY), orgFloor);
			createdAt = minDate(createdAt, new Date(startAt.getTime() - DAY));
			const needed = r.int(tpl.needed[0], tpl.needed[1]);
			const status: Ev["status"] =
				kind === "draft"
					? "DRAFT"
					: kind === "cancelled"
						? "CANCELLED"
						: endAt.getTime() < NOW
							? "COMPLETED"
							: "PUBLISHED";
			const ev: Ev = {
				id: sid(`event:${org.def.key}:${n}`),
				org,
				title,
				startAt,
				endAt,
				createdAt,
				status,
				needed,
				hours: tpl.hours,
				kind,
			};
			evs.push(ev);
			const [lat, lng] = [
				org.lat + r.float(-0.03, 0.03),
				org.lng + r.float(-0.03, 0.03),
			];
			const cover = r.chance(0.85)
				? copyTo(
						`${FEED}/event-covers/${org.id}/seed/${ev.id}.jpg`,
						wantPhoto(r.pick(PHOTO_POOL[tpl.cause])),
					)
				: null;
			rows.events.push({
				id: ev.id,
				organizationId: org.id,
				title,
				description: tpl.description,
				coverImage: cover,
				venue: `${tpl.venue}, ${org.def.area}`,
				address: `${org.def.area}, ${org.city} ${org.def.pincode}`,
				city: org.city,
				state: org.state,
				latitude: lat.toFixed(6),
				longitude: lng.toFixed(6),
				startAt,
				endAt,
				applicationDeadline:
					kind === "closed"
						? ago(r.float(0.3, 1.5))
						: new Date(startAt.getTime() - r.float(0.5, 2) * DAY),
				volunteersNeeded: needed,
				acceptedCount: 0, // set below from the applications
				status,
				isUrgent: kind === "urgent",
				createdBy: org.named
					? (r.pick(org.team) ?? org.ownerId)
					: r.chance(0.6)
						? org.ownerId
						: (r.pick(org.team) ?? org.ownerId),
				createdAt,
				updatedAt: createdAt,
			});
		});
	}

	// Which seeded events the demo volunteer takes part in, and how.
	const namedVolPlan = new Map<
		string,
		"ATTENDED" | "ACCEPTED" | "PENDING" | "REJECTED" | "WITHDRAWN"
	>();
	{
		const near = new Set(["Mumbai", "Thane", "Navi Mumbai", "Pune"]);
		const sinceJoin = (e: Ev) =>
			e.startAt.getTime() > namedVol.createdAt.getTime() + 2 * DAY;
		const rank = (e: Ev) => (near.has(e.org.city) ? 0 : 1);
		const pastPool = evs
			.filter((e) => e.status === "COMPLETED" && sinceJoin(e) && !e.org.named)
			.sort((a, b) => rank(a) - rank(b));
		const upPool = evs
			.filter(
				(e) => e.status === "PUBLISHED" && e.kind !== "full" && !e.org.named,
			)
			.sort((a, b) => rank(a) - rank(b));
		for (const e of pastPool.slice(0, 7)) namedVolPlan.set(e.id, "ATTENDED");
		for (const e of pastPool.slice(7, 8)) namedVolPlan.set(e.id, "REJECTED");
		const ups = upPool.slice(0, 7);
		const upStatuses = [
			"ACCEPTED",
			"ACCEPTED",
			"PENDING",
			"PENDING",
			"PENDING",
			"WITHDRAWN",
			"REJECTED",
		] as const;
		ups.forEach((e, i) => {
			namedVolPlan.set(e.id, upStatuses[i] as "PENDING");
		});
	}

	const applicationsByVol = new Map<
		string,
		{ evId: string; attended: boolean }[]
	>();
	const certificatesForNamed: string[] = [];
	const acceptedByEvent = new Map<string, number>();
	for (const ev of evs) {
		if (ev.status === "DRAFT") continue;
		const r = rngFor(`apps:${ev.id}`);
		const windowEnd = minDate(
			new Date(ev.startAt.getTime() - 2 * HOUR),
			new Date(NOW),
		);
		const eligible = verifiedVols.filter(
			(v) =>
				v.verifiedAt.getTime() < windowEnd.getTime() &&
				ev.createdAt.getTime() < windowEnd.getTime(),
		);
		const sameCity = r.sample(
			eligible.filter((v) => v.city === ev.org.city),
			999,
		);
		const others = r.sample(
			eligible.filter((v) => v.city !== ev.org.city),
			999,
		);
		const isPast = ev.status === "COMPLETED";
		const full = ev.kind === "full";
		let total: number;
		if (ev.kind === "cancelled") total = r.int(2, 8);
		else if (isPast) total = Math.round(ev.needed * r.float(0.8, 1.5));
		else if (full) total = ev.needed + r.int(2, 6);
		else total = Math.round(ev.needed * r.float(0.25, 1.1));
		if (ev.org.named) total = Math.round(total * 1.3) + 3;
		const picked: Vol[] = [];
		while (picked.length < total && (sameCity.length || others.length)) {
			const src =
				sameCity.length && (r.chance(0.6) || !others.length)
					? sameCity
					: others;
			const v = src.shift();
			if (v) picked.push(v);
		}
		const namedStatus = namedVolPlan.get(ev.id);
		let accepted = 0;
		let acceptTarget: number;
		if (isPast)
			acceptTarget = Math.min(
				ev.needed,
				Math.round(picked.length * r.float(0.6, 0.8)),
			);
		else if (full)
			acceptTarget = ev.needed - (namedStatus === "ACCEPTED" ? 1 : 0);
		else
			acceptTarget = Math.min(
				ev.needed - 2,
				Math.round(picked.length * r.float(0.25, 0.55)),
			);
		if (namedStatus === "ATTENDED" || namedStatus === "ACCEPTED")
			acceptTarget = Math.min(acceptTarget, ev.needed - 1);
		acceptTarget = Math.max(0, acceptTarget);

		const entries: {
			vol: Vol;
			status: "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
			attended: boolean;
		}[] = [];
		for (const vol of picked) {
			let status: "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
			if (accepted < acceptTarget) {
				status = "ACCEPTED";
				accepted++;
			} else if (isPast || ev.kind === "cancelled")
				status = r.chance(0.6) ? "REJECTED" : "WITHDRAWN";
			else if (full) status = r.chance(0.7) ? "PENDING" : "REJECTED";
			else
				status = r.weighted([
					["PENDING", 70],
					["REJECTED", 18],
					["WITHDRAWN", 12],
				] as const);
			entries.push({
				vol,
				status,
				attended: isPast && status === "ACCEPTED" && r.chance(0.86),
			});
		}
		if (namedStatus) {
			const status = namedStatus === "ATTENDED" ? "ACCEPTED" : namedStatus;
			if (status === "ACCEPTED") accepted++;
			entries.push({
				vol: namedVol,
				status,
				attended: namedStatus === "ATTENDED",
			});
		}
		acceptedByEvent.set(ev.id, accepted);

		for (const [k, entry] of entries.entries()) {
			const appId = sid(`app:${ev.id}:${entry.vol.id}`);
			const from = maxDate(ev.createdAt, entry.vol.verifiedAt);
			// Most people apply soon after an event is posted.
			const appliedAt = clampPast(
				new Date(
					from.getTime() +
						Math.max(0, windowEnd.getTime() - from.getTime()) * r.next() ** 1.8,
				),
			);
			const reviewedAt =
				entry.status === "PENDING" || entry.status === "WITHDRAWN"
					? null
					: soonAfter(r, appliedAt, 0.1, 2.5);
			const reviewer = ev.org.named
				? (r.pick(ev.org.team) ?? ev.org.ownerId)
				: ev.org.ownerId;
			const attendedAt = entry.attended
				? new Date(ev.endAt.getTime() + r.float(1, 20) * HOUR)
				: null;
			rows.eventApplications.push({
				id: appId,
				eventId: ev.id,
				volunteerId: entry.vol.id,
				status: entry.status,
				message: r.chance(0.55) ? r.pick(APPLICATION_MESSAGES) : null,
				reviewNote:
					entry.status === "REJECTED"
						? r.pick([
								"Thank you for applying - we filled all places for this one.",
								"We needed people with medical training for this event.",
								"Places went to volunteers closer to the venue this time.",
							])
						: null,
				reviewedBy: reviewedAt ? reviewer : null,
				reviewedAt,
				attendedAt: attendedAt ? clampPast(attendedAt) : null,
				hoursServed:
					entry.attended && r.chance(0.3)
						? String(Math.max(1, ev.hours - r.int(0, 2)))
						: null,
				appliedAt,
				updatedAt: reviewedAt ?? appliedAt,
			});
			const list = applicationsByVol.get(entry.vol.id) ?? [];
			list.push({ evId: ev.id, attended: entry.attended });
			applicationsByVol.set(entry.vol.id, list);
			if (
				entry.attended &&
				attendedAt &&
				(entry.vol.named
					? k >= 0 && certificatesForNamed.length < 6
					: r.chance(0.75))
			) {
				const certId = sid(`cert:${appId}`);
				const issuedAt = clampPast(
					new Date(attendedAt.getTime() + r.float(0.5, 4) * DAY),
				);
				const revoked = !entry.vol.named && r.chance(0.02);
				rows.certificates.push({
					id: certId,
					applicationId: appId,
					eventId: ev.id,
					volunteerId: entry.vol.id,
					organizationId: ev.org.id,
					code: certCode(certId),
					note: `Contributed ${ev.hours} hours to "${ev.title}".`,
					issuedBy: ev.org.ownerId,
					issuedAt,
					revokedAt: revoked
						? clampPast(new Date(issuedAt.getTime() + 3 * DAY))
						: null,
					revokedReason: revoked
						? "Issued to the wrong volunteer by mistake."
						: null,
				});
				if (entry.vol.named) certificatesForNamed.push(certId);
			}
		}
	}
	for (const row of rows.events)
		row.acceptedCount = acceptedByEvent.get(row.id as string) ?? 0;

	// ── Needs + pledges ───────────────────────────────────────────────────
	const needIds: {
		id: string;
		org: Org;
		title: string;
		createdAt: Date;
		open: boolean;
	}[] = [];
	const namedVolPledges: string[] = [];
	for (const org of contentOrgs) {
		const r = rngFor(`needs:${org.def.key}`);
		const templates = org.causes.flatMap((c) =>
			NEEDS[c].map((tpl) => ({ ...tpl, cause: c })),
		);
		const count = org.named ? Math.min(10, templates.length) : r.int(3, 5);
		const chosen = r.sample(templates, count);
		chosen.forEach((tpl, n) => {
			const id = sid(`need:${org.def.key}:${n}`);
			const quantified =
				tpl.quantity && !(r.chance(0.12) && tpl.unit === "volunteers");
			const quantity =
				quantified && tpl.quantity
					? roundQty(r.int(tpl.quantity[0], tpl.quantity[1]))
					: null;
			const statusRoll = r.next();
			const status: "OPEN" | "FULFILLED" | "CLOSED" =
				org.named && n === 0
					? "OPEN"
					: statusRoll < 0.68 || !quantity
						? "OPEN"
						: statusRoll < 0.86
							? "FULFILLED"
							: "CLOSED";
			let createdAt =
				status === "OPEN"
					? clampPast(
							maxDate(
								ago(r.float(0.5, 35)),
								new Date(org.createdAt.getTime() + DAY),
							),
						)
					: clampPast(
							maxDate(
								ago(r.float(40, 220)),
								new Date(org.createdAt.getTime() + DAY),
							),
						);
			const expiryRoll = r.next();
			const expiresAt: Date | null =
				status !== "OPEN"
					? new Date(createdAt.getTime() + 30 * DAY)
					: expiryRoll < 0.15
						? istAt(r.int(0, 2), 23, 0)
						: expiryRoll < 0.25
							? ago(r.float(1, 6))
							: expiryRoll < 0.7
								? istAt(r.int(5, 45), 23, 0)
								: null;
			if (expiresAt && expiresAt.getTime() < createdAt.getTime())
				createdAt = new Date(expiresAt.getTime() - r.float(10, 25) * DAY);
			const eligible = verifiedVols.filter(
				(v) => v.verifiedAt.getTime() < NOW - DAY,
			);
			const pledgers = r.sample(
				eligible,
				org.named ? r.int(8, 14) : r.int(2, 9),
			);
			const wantsNamedVol =
				!org.named &&
				namedVolPledges.length < 6 &&
				r.chance(0.18) &&
				status !== "CLOSED";
			if (wantsNamedVol) pledgers.push(namedVol);
			let committed = 0;
			const pledgeRows: Insert<typeof s.needPledges>[] = [];
			pledgers.forEach((vol) => {
				const pr = rngFor(`pledge:${id}:${vol.id}`);
				const qty = quantity
					? Math.max(
							1,
							Math.round((quantity / pr.int(4, 9)) * pr.float(0.4, 1.2)),
						)
					: null;
				let pStatus:
					| "PENDING"
					| "ACCEPTED"
					| "REJECTED"
					| "COMPLETED"
					| "CANCELLED";
				if (vol.named) {
					pStatus =
						(
							[
								"PENDING",
								"ACCEPTED",
								"COMPLETED",
								"REJECTED",
								"CANCELLED",
								"COMPLETED",
							] as const
						)[namedVolPledges.length] ?? "PENDING";
				} else if (status === "FULFILLED") {
					pStatus = pr.weighted([
						["COMPLETED", 60],
						["ACCEPTED", 25],
						["REJECTED", 8],
						["CANCELLED", 7],
					] as const);
				} else if (status === "CLOSED") {
					pStatus = pr.weighted([
						["COMPLETED", 50],
						["REJECTED", 25],
						["CANCELLED", 25],
					] as const);
				} else {
					pStatus = pr.weighted([
						["PENDING", 40],
						["ACCEPTED", 25],
						["COMPLETED", 18],
						["REJECTED", 9],
						["CANCELLED", 8],
					] as const);
				}
				let finalQty = qty;
				const isCommitted = pStatus === "ACCEPTED" || pStatus === "COMPLETED";
				if (quantity && isCommitted && finalQty) {
					const room = quantity - committed - (status === "OPEN" ? 1 : 0);
					if (room <= 0) {
						pStatus = pStatus === "COMPLETED" ? "CANCELLED" : "REJECTED";
					} else {
						finalQty = Math.min(finalQty, room);
						committed += finalQty;
					}
				}
				const pledgeId = sid(`pledge:${id}:${vol.id}`);
				if (vol.named) namedVolPledges.push(pledgeId);
				const created = clampPast(
					between(
						pr,
						maxDate(createdAt, vol.verifiedAt),
						new Date(Math.min(NOW, expiresAt?.getTime() ?? NOW)),
					),
				);
				const reviewed = pStatus !== "PENDING" && pStatus !== "CANCELLED";
				pledgeRows.push({
					id: pledgeId,
					needId: id,
					userId: vol.id,
					quantity: finalQty,
					message: pr.chance(0.6) ? pr.pick(PLEDGE_MESSAGES) : null,
					status: pStatus,
					reviewNote:
						pStatus === "REJECTED"
							? "Thank you - we already have enough of this for now."
							: null,
					reviewedBy: reviewed ? org.ownerId : null,
					reviewedAt: reviewed ? soonAfter(pr, created, 0.2, 3) : null,
					createdAt: created,
					updatedAt: created,
				});
			});
			// A fulfilled need's committed pledges must add up to its target.
			let finalStatus = status;
			if (quantity && status === "FULFILLED" && committed < quantity) {
				const vol = r.pick(eligible.filter((v) => !pledgers.includes(v)));
				const pledgeId = sid(`pledge:${id}:${vol.id}:topup`);
				const created = clampPast(new Date(createdAt.getTime() + 5 * DAY));
				pledgeRows.push({
					id: pledgeId,
					needId: id,
					userId: vol.id,
					quantity: quantity - committed,
					message: "Covering the rest of this one.",
					status: "COMPLETED",
					reviewedBy: org.ownerId,
					reviewedAt: clampPast(new Date(created.getTime() + DAY)),
					createdAt: created,
					updatedAt: created,
				});
				committed = quantity;
			}
			if (quantity && finalStatus === "OPEN" && committed >= quantity)
				finalStatus = "FULFILLED";
			rows.needPledges.push(...pledgeRows);
			const cover = r.chance(0.45)
				? copyTo(
						`${FEED}/need-covers/${org.id}/seed/${id}.jpg`,
						wantPhoto(r.pick(PHOTO_POOL[tpl.cause])),
					)
				: null;
			rows.needs.push({
				id,
				organizationId: org.id,
				type: tpl.type,
				title: tpl.title,
				description: tpl.description,
				coverImage: cover,
				quantity,
				unit: quantity ? (tpl.unit ?? null) : null,
				fulfilledQuantity: quantity ? committed : 0,
				urgency: tpl.urgency,
				status: finalStatus,
				city: org.city,
				state: org.state,
				expiresAt,
				createdBy: org.named ? (r.pick(org.team) ?? org.ownerId) : org.ownerId,
				createdAt,
				updatedAt: createdAt,
			});
			needIds.push({
				id,
				org,
				title: tpl.title,
				createdAt,
				open: finalStatus === "OPEN",
			});
		});
	}

	// ── Announcements + financial reports ────────────────────────────────
	const announcementIds: { id: string; org: Org; title: string; at: Date }[] =
		[];
	for (const org of contentOrgs) {
		const r = rngFor(`ann:${org.def.key}`);
		const bank = org.causes.flatMap((c) =>
			ANNOUNCEMENTS[c].map((a) => ({ ...a, cause: c })),
		);
		const chosen = r.sample(
			bank,
			org.named ? Math.min(6, bank.length) : r.int(2, 3),
		);
		chosen.forEach((a, n) => {
			const id = sid(`ann:${org.def.key}:${n}`);
			const draft =
				(org.named && n === chosen.length - 1) ||
				(!org.named && n === 2 && r.chance(0.5));
			const at = clampPast(
				maxDate(
					ago(n === 0 ? r.float(0.5, 6) : r.float(4, 120)),
					new Date(org.createdAt.getTime() + 2 * DAY),
				),
			);
			const cover = r.chance(0.65)
				? copyTo(
						`${FEED}/announcement-covers/${org.id}/seed/${id}.jpg`,
						wantPhoto(r.pick(PHOTO_POOL[a.cause])),
					)
				: null;
			rows.announcements.push({
				id,
				organizationId: org.id,
				title: a.title,
				body: a.body,
				coverImageKey: cover,
				status: draft ? "DRAFT" : "PUBLISHED",
				isPinned: !draft && n === 0 && r.chance(org.named ? 1 : 0.45),
				isUrgent:
					!draft &&
					/low|alert|advisory|cold-wave|Heatwave/i.test(a.title + a.body) &&
					r.chance(0.7),
				publishedAt: draft ? null : at,
				createdBy: org.named ? (r.pick(org.team) ?? org.ownerId) : org.ownerId,
				createdAt: at,
				updatedAt: at,
			});
			if (!draft) announcementIds.push({ id, org, title: a.title, at });
		});
		const reports = org.named ? 4 : r.int(1, 3);
		for (let n = 0; n < reports; n++) {
			const id = sid(`report:${org.def.key}:${n}`);
			const fy = 2025 - (n % 3);
			const type = (
				[
					"ANNUAL_REPORT",
					"AUDITED_STATEMENT",
					"UTILISATION_CERTIFICATE",
					"FCRA_RETURN",
				] as const
			)[n % 4] as "ANNUAL_REPORT";
			const image = type === ("UTILISATION_CERTIFICATE" as string);
			const key = image
				? copyTo(
						`${FEED}/financial-reports/${org.id}/seed/${id}.png`,
						reportPoolKey(n % 2),
					)
				: `${FEED}/financial-reports/${org.id}/seed/${id}.pdf`;
			const income = r.int(18, 240) * 100000;
			if (!image) {
				directUploads.set(
					key,
					pdf(
						`${org.def.name} - ${typeLabel(type)} FY${fy}-${String(fy + 1).slice(2)}`,
						[
							`Total income: ${fmtInr(income)}`,
							`Programme expenditure: ${fmtInr(Math.round(income * 0.78))}`,
							`Administration: ${fmtInr(Math.round(income * 0.14))}`,
							`Fundraising: ${fmtInr(Math.round(income * 0.08))}`,
							"",
							`Volunteers engaged: ${r.int(120, 2400)}`,
							`People reached: ${r.int(2000, 60000).toLocaleString("en-IN")}`,
						],
					),
				);
			}
			const created = clampPast(
				maxDate(
					ago(r.float(5, 200)),
					new Date(org.createdAt.getTime() + 3 * DAY),
				),
			);
			rows.financialReports.push({
				id,
				organizationId: org.id,
				type,
				title: `${typeLabel(type)} ${fy}-${String(fy + 1).slice(2)}`,
				financialYear: fy,
				documentKey: key,
				notes:
					n === 0 ? "Audited by an independent chartered accountant." : null,
				uploadedBy: org.named ? ngoUser.id : org.ownerId,
				createdAt: created,
			});
		}
	}
	for (let n = 0; n < 2; n++)
		poolUploads.set(reportPoolKey(n), async () => renderPng(reportSvg(n)));

	// ── Feed posts + media ────────────────────────────────────────────────
	const postIds: { id: string; at: Date; orgId: string | null }[] = [];
	for (const org of contentOrgs) {
		const r = rngFor(`posts:${org.def.key}`);
		const bank = org.causes.flatMap((c) =>
			POSTS[c].map((text) => ({ text, cause: c })),
		);
		const chosen = r.sample(
			bank,
			org.named ? Math.min(8, bank.length) : r.int(2, 4),
		);
		chosen.forEach(({ text, cause }, n) => {
			const id = sid(`post:${org.def.key}:${n}`);
			const author = org.named
				? n % 2 === 0
					? ngoUser.id
					: (r.pick(org.team) ?? ngoUser.id)
				: r.chance(0.6)
					? org.ownerId
					: (r.pick(org.team) ?? org.ownerId);
			const at = clampPast(
				maxDate(
					ago(n === 0 ? r.float(0.1, 3) : r.float(1, 60) * r.next() + 0.5),
					new Date(org.createdAt.getTime() + DAY),
				),
			);
			const folder = `seed-${hashHex(`folder:${id}`, 20)}`;
			rows.posts.push({
				id,
				authorUserId: author,
				organizationId: org.id,
				type: "POST",
				isUrgent: r.chance(0.08),
				city: org.city,
				state: org.state,
				latitude: org.lat.toFixed(6),
				longitude: org.lng.toFixed(6),
				mediaFolder: folder,
				text,
				createdAt: at,
			});
			const mediaCount = r.weighted([
				[0, 25],
				[1, 45],
				[2, 18],
				[3, 12],
			] as const);
			const photos = r.sample(PHOTO_POOL[cause], mediaCount);
			photos.forEach((photo, m) => {
				rows.postsMedia.push({
					id: sid(`media:${id}:${m}`),
					postId: id,
					objectKey: copyTo(
						`${FEED}/feed-media/${author}/${folder}/seed-${m + 1}.jpg`,
						wantPhoto(photo),
					),
					mediaType: "IMAGE",
					mimeType: "image/jpeg",
					sortOrder: m,
					createdAt: at,
				});
			});
			postIds.push({ id, at, orgId: org.id });
		});
	}
	{
		const r = rngFor("volunteer-posts");
		const authors = r.sample(verifiedVols, 30);
		authors.forEach((vol, n) => {
			const id = sid(`vpost:${n}`);
			const at = clampPast(maxDate(ago(r.float(0.2, 40)), vol.verifiedAt));
			const folder = `seed-${hashHex(`folder:${id}`, 20)}`;
			const [lat, lng] = coordsOf(vol.city);
			rows.posts.push({
				id,
				authorUserId: vol.id,
				type: "POST",
				city: vol.city,
				state: stateOf(vol.city),
				latitude: lat.toFixed(6),
				longitude: lng.toFixed(6),
				mediaFolder: folder,
				text: VOLUNTEER_POSTS[n % VOLUNTEER_POSTS.length] as string,
				createdAt: at,
			});
			if (r.chance(0.5)) {
				rows.postsMedia.push({
					id: sid(`media:${id}:0`),
					postId: id,
					objectKey: copyTo(
						`${FEED}/feed-media/${vol.id}/${folder}/seed-1.jpg`,
						wantPhoto(r.pick(PHOTO_POOL[r.pick(vol.causes)])),
					),
					mediaType: "IMAGE",
					mimeType: "image/jpeg",
					sortOrder: 0,
					createdAt: at,
				});
			}
			postIds.push({ id, at, orgId: null });
		});
		// Two posts from the demo volunteer.
		[0, 1].forEach((n) => {
			const id = sid(`named-vpost:${n}`);
			const at = ago(n === 0 ? 3.2 : 17);
			const folder = `seed-${hashHex(`folder:${id}`, 20)}`;
			rows.posts.push({
				id,
				authorUserId: namedVol.id,
				type: "POST",
				city: namedVol.city,
				state: stateOf(namedVol.city),
				mediaFolder: folder,
				text:
					n === 0
						? (VOLUNTEER_POSTS[0] as string)
						: (VOLUNTEER_POSTS[9] as string),
				createdAt: at,
			});
			rows.postsMedia.push({
				id: sid(`media:${id}:0`),
				postId: id,
				objectKey: copyTo(
					`${FEED}/feed-media/${namedVol.id}/${folder}/seed-1.jpg`,
					wantPhoto(n === 0 ? 459 : 306),
				),
				mediaType: "IMAGE",
				mimeType: "image/jpeg",
				sortOrder: 0,
				createdAt: at,
			});
			postIds.push({ id, at, orgId: null });
		});
	}

	// ── Feed engagement ───────────────────────────────────────────────────
	type Target = {
		type: "POST" | "EVENT" | "NEED" | "ANNOUNCEMENT";
		id: string;
		at: Date;
		weight: number;
	};
	const targets: Target[] = [
		...postIds.map((p) => ({
			type: "POST" as const,
			id: p.id,
			at: p.at,
			weight: 1,
		})),
		...evs
			.filter((e) => e.status === "PUBLISHED")
			.map((e) => ({
				type: "EVENT" as const,
				id: e.id,
				at: e.createdAt,
				weight: 0.8,
			})),
		...needIds
			.filter((n) => n.open)
			.map((n) => ({
				type: "NEED" as const,
				id: n.id,
				at: n.createdAt,
				weight: 0.7,
			})),
		...announcementIds.map((a) => ({
			type: "ANNOUNCEMENT" as const,
			id: a.id,
			at: a.at,
			weight: 0.9,
		})),
	];
	for (const t of targets) {
		const r = rngFor(`engage:${t.type}:${t.id}`);
		const pop = r.next() ** 2.2 * 70 * t.weight;
		const likers = r.sample(activeVols, Math.round(pop));
		const savers = r.sample(activeVols, Math.round(pop * 0.18));
		const sharers = r.sample(activeVols, Math.round(pop * 0.1));
		const viewers = r.sample(
			activeVols,
			Math.min(140, Math.round(pop * 1.6 + r.int(3, 18))),
		);
		const stamp = (label: string) =>
			clampPast(
				between(
					rngFor(label),
					t.at,
					new Date(Math.min(NOW, t.at.getTime() + r.float(1, 14) * DAY)),
				),
			);
		const push = (vol: Vol, kind: "LIKE" | "SAVE" | "SHARE" | "IMPRESSION") =>
			rows.postInteractions.push({
				id: sid(`ix:${t.id}:${vol.id}:${kind}`),
				userId: vol.id,
				targetType: t.type,
				postId: t.id,
				interactionType: kind,
				createdAt: stamp(`ixt:${t.id}:${vol.id}:${kind}`),
			});
		for (const v of likers) push(v, "LIKE");
		for (const v of savers) push(v, "SAVE");
		for (const v of sharers) push(v, "SHARE");
		for (const v of viewers) push(v, "IMPRESSION");
		const commenters = r.sample(
			verifiedVols,
			Math.min(8, Math.round(pop / 9 + (r.chance(0.3) ? 1 : 0))),
		);
		commenters.forEach((vol, c) => {
			const at = stamp(`cm:${t.id}:${c}`);
			rows.postComments.push({
				id: sid(`comment:${t.id}:${c}`),
				userId: vol.id,
				targetType: t.type,
				postId: t.id,
				body: r.pick(COMMENTS),
				createdAt: at,
				updatedAt: at,
			});
		});
	}
	{
		// The demo volunteer's own likes, saves and a couple of comments.
		const r = rngFor("named-vol-engage");
		const recent = targets.filter(
			(t) => t.at.getTime() > namedVol.createdAt.getTime(),
		);
		const liked = r.sample(recent, 18);
		liked.forEach((t, i) => {
			const at = clampPast(new Date(t.at.getTime() + r.float(0.1, 3) * DAY));
			rows.postInteractions.push({
				id: sid(`named-ix:${t.id}:LIKE`),
				userId: namedVol.id,
				targetType: t.type,
				postId: t.id,
				interactionType: "LIKE",
				createdAt: at,
			});
			if (i < 8)
				rows.postInteractions.push({
					id: sid(`named-ix:${t.id}:SAVE`),
					userId: namedVol.id,
					targetType: t.type,
					postId: t.id,
					interactionType: "SAVE",
					createdAt: at,
				});
			if (i < 3)
				rows.postComments.push({
					id: sid(`named-comment:${t.id}`),
					userId: namedVol.id,
					targetType: t.type,
					postId: t.id,
					body: r.pick(COMMENTS),
					createdAt: at,
					updatedAt: at,
				});
		});
	}

	// ── Follows, bookmarks, reviews ──────────────────────────────────────
	const followersByOrg = new Map<string, number>();
	for (const vol of [...vols, namedVol]) {
		const r = rngFor(`follow:${vol.id}`);
		const local = visibleOrgs.filter(
			(o) =>
				o.city === vol.city || o.causes.some((c) => vol.causes.includes(c)),
		);
		const count = vol.named ? 9 : 1 + Math.floor(r.next() ** 1.6 * 8);
		const chosen = new Set<Org>(
			r.sample(local.length ? local : visibleOrgs, count),
		);
		if (r.chance(vol.named ? 1 : 0.42)) chosen.add(namedOrg);
		for (const org of chosen) {
			const at = soonAfter(r, maxDate(vol.createdAt, org.createdAt), 0.1, 30);
			rows.follows.push({
				id: sid(`follow:${vol.id}:${org.id}`),
				userId: vol.id,
				organizationId: org.id,
				createdAt: at,
			});
			followersByOrg.set(org.id, (followersByOrg.get(org.id) ?? 0) + 1);
		}
		if (vol.named || r.chance(0.5)) {
			for (const org of r.sample([...chosen], vol.named ? 5 : r.int(1, 3))) {
				const at = soonAfter(r, maxDate(vol.createdAt, org.createdAt), 0.1, 30);
				rows.bookmarks.push({
					id: sid(`bookmark:${vol.id}:${org.id}`),
					userId: vol.id,
					organizationId: org.id,
					createdAt: at,
				});
			}
		}
	}
	const reviewIds: {
		id: string;
		org: Org;
		at: Date;
		userId: string;
		rating: number;
		replied: boolean;
	}[] = [];
	for (const org of [
		...visibleOrgs,
		...orgs.filter((o) => o.def.lifecycle === "suspended"),
	]) {
		const r = rngFor(`reviews:${org.def.key}`);
		const attendees = evs
			.filter((e) => e.org === org && e.status === "COMPLETED")
			.flatMap((e) =>
				rows.eventApplications
					.filter((a) => a.eventId === e.id && a.attendedAt)
					.map((a) => a.volunteerId as string),
			);
		const pool = [...new Set(attendees)].filter((id) => id !== namedVol.id);
		const extra = r.sample(
			verifiedVols.map((v) => v.id),
			6,
		);
		const reviewers = r.sample(
			[...new Set([...pool, ...extra])],
			org.named ? 28 : r.int(3, 9),
		);
		reviewers.forEach((userId, n) => {
			const rating =
				org.def.lifecycle === "suspended"
					? r.pick([1, 2, 3, 2])
					: r.weighted([
							[5, 55],
							[4, 28],
							[3, 10],
							[2, 4],
							[1, 3],
						] as const);
			const at = clampPast(
				maxDate(
					ago(r.float(0.3, 150)),
					new Date(org.createdAt.getTime() + 3 * DAY),
				),
			);
			const replied = org.named ? n % 3 === 0 : r.chance(0.5);
			const repliedAt = replied
				? clampPast(new Date(at.getTime() + r.float(0.2, 4) * DAY))
				: null;
			const id = sid(`review:${org.id}:${userId}`);
			rows.reviews.push({
				id,
				organizationId: org.id,
				userId,
				rating,
				body: r.chance(0.88)
					? r.pick(REVIEWS[rating] ?? REVIEWS[4] ?? [])
					: null,
				reply: replied ? r.pick(REVIEW_REPLIES) : null,
				repliedAt,
				createdAt: at,
				updatedAt: repliedAt ?? at,
			});
			reviewIds.push({ id, org, at, userId, rating, replied });
		});
	}
	{
		// The demo volunteer reviews three orgs it volunteered with.
		const r = rngFor("named-vol-reviews");
		const attendedOrgs = [
			...new Set(
				(applicationsByVol.get(namedVol.id) ?? [])
					.filter((a) => a.attended)
					.map((a) => evs.find((e) => e.id === a.evId)?.org)
					.filter(Boolean),
			),
		] as Org[];
		attendedOrgs.slice(0, 3).forEach((org, n) => {
			const rating = n === 2 ? 4 : 5;
			const at = ago(2 + n * 6);
			const replied = n === 0;
			rows.reviews.push({
				id: sid(`named-review:${org.id}`),
				organizationId: org.id,
				userId: namedVol.id,
				rating,
				body: r.pick(REVIEWS[rating] ?? []),
				reply: replied ? "Thank you so much - see you at the next one!" : null,
				repliedAt: replied ? ago(1) : null,
				createdAt: at,
				updatedAt: at,
			});
		});
	}

	// ── Donations ─────────────────────────────────────────────────────────
	const amounts = [
		[100, 8],
		[200, 8],
		[251, 6],
		[500, 18],
		[501, 6],
		[1000, 16],
		[1001, 5],
		[1100, 4],
		[2000, 9],
		[2100, 4],
		[2500, 6],
		[5000, 7],
		[5100, 3],
		[10000, 4],
		[11000, 2],
		[25000, 1.5],
		[51000, 0.6],
	] as const;
	const namedVolDonations: string[] = [];
	const donationsForNamedOrg: {
		id: string;
		at: Date;
		amount: number;
		name: string;
	}[] = [];
	const donors = [
		...verifiedVols,
		...vols.filter((v) => v.status !== "VERIFIED"),
	];
	const makeDonation = (
		org: Org,
		label: string,
		r: Rng,
		at: Date,
		donor: Vol | null,
		forceStatus?: "COMPLETED" | "PENDING" | "FAILED" | "REFUNDED",
	) => {
		const id = sid(`donation:${label}`);
		const status =
			forceStatus ??
			(at.getTime() > NOW - 2 * HOUR && r.chance(0.5)
				? "PENDING"
				: r.weighted([
						["COMPLETED", 86],
						["PENDING", 4],
						["FAILED", 7],
						["REFUNDED", 3],
					] as const));
		const rupees = r.weighted(amounts);
		const anonymous = r.chance(0.14);
		const guest = !donor;
		const guestName = guest ? personName(r.int(2000, 5000)) : null;
		const settled = status === "COMPLETED" || status === "REFUNDED";
		rows.donations.push({
			id,
			organizationId: org.id,
			donorUserId: donor?.id ?? null,
			amountMinor: rupees * 100,
			currency: "INR",
			status,
			provider: "razorpay",
			providerCheckoutId: `${SEED_PAYMENT_PREFIX}order_${hashHex(`order:${label}`, 14)}`,
			providerPaymentId:
				settled || status === "FAILED"
					? `${SEED_PAYMENT_PREFIX}pay_${hashHex(`pay:${label}`, 14)}`
					: null,
			message: r.chance(0.35) ? r.pick(DONATION_MESSAGES) : null,
			isAnonymous: anonymous,
			receiptNumber: settled ? receiptNumber(at, id) : null,
			donorName: donor ? donor.name : guestName?.full,
			donorEmail: donor
				? donor.email
				: `${guestName?.first}.${guestName?.last}.guest${r.int(1, 999)}@${SEED_EMAIL_DOMAIN}`.toLowerCase(),
			completedAt: settled
				? new Date(at.getTime() + r.int(20, 240) * 1000)
				: null,
			failureReason:
				status === "FAILED"
					? r.pick([
							"Payment declined by the bank.",
							"UPI request expired.",
							"Card authentication failed.",
						])
					: null,
			createdAt: at,
			updatedAt: at,
		});
		if (donor?.named) namedVolDonations.push(id);
		if (org.named && status === "COMPLETED")
			donationsForNamedOrg.push({
				id,
				at,
				amount: rupees,
				name: anonymous
					? "Someone"
					: (donor?.name ?? guestName?.full ?? "A donor"),
			});
		return id;
	};
	for (const org of [
		...visibleOrgs,
		...orgs.filter(
			(o) => o.def.lifecycle === "suspended" || o.def.lifecycle === "deleted",
		),
	]) {
		const r = rngFor(`donations:${org.def.key}`);
		const count = org.named ? 330 : r.int(14, 60);
		const maxDays = org.named
			? 365
			: Math.min(365, (NOW - org.createdAt.getTime()) / DAY - 1);
		for (let n = 0; n < count; n++) {
			// Recent-heavy, with growth over the year.
			const days = maxDays * r.next() ** (org.named ? 1.25 : 1.1);
			const at = new Date(NOW - days * DAY - r.int(0, 3600) * 1000);
			const eligible = donors.filter(
				(v) => v.createdAt.getTime() < at.getTime(),
			);
			const donor = r.chance(0.62) && eligible.length ? r.pick(eligible) : null;
			makeDonation(org, `${org.def.key}:${n}`, r, at, donor);
		}
	}
	{
		const r = rngFor("named-vol-donations");
		const targetsOrgs = r.sample(
			visibleOrgs.filter((o) => !o.named),
			9,
		);
		const statuses = [
			"COMPLETED",
			"COMPLETED",
			"COMPLETED",
			"COMPLETED",
			"COMPLETED",
			"COMPLETED",
			"COMPLETED",
			"COMPLETED",
			"COMPLETED",
			"COMPLETED",
			"COMPLETED",
			"PENDING",
			"FAILED",
			"REFUNDED",
		] as const;
		statuses.forEach((st, n) => {
			const org =
				n < 3 ? namedOrg : (targetsOrgs[n % targetsOrgs.length] as Org);
			const span = (NOW - namedVol.createdAt.getTime()) / DAY - 0.5;
			const at = st === "PENDING" ? ago(0.05) : ago(r.float(0.3, span));
			makeDonation(org, `named-vol:${n}`, r, at, namedVol, st);
		});
	}

	// ── Notifications for the demo accounts (and every type at least once) ──
	const notify = (
		userId: string,
		type: Insert<typeof s.notifications>["type"],
		title: string,
		body: string | null,
		entityName: string | null,
		entityId: string | null,
		at: Date,
		label: string,
		read: boolean,
	): void => {
		rows.notifications.push({
			id: sid(`notif:${label}`),
			userId,
			type,
			title,
			body,
			entityName,
			entityId,
			readAt: read ? clampPast(new Date(at.getTime() + 2 * HOUR)) : null,
			createdAt: at,
		});
	};
	{
		const myApps = rows.eventApplications.filter(
			(a) => a.volunteerId === namedVol.id,
		);
		for (const a of myApps) {
			const ev = evs.find((e) => e.id === a.eventId);
			if (!ev || !a.reviewedAt) continue;
			const acceptedApp = a.status === "ACCEPTED";
			notify(
				namedVol.id,
				acceptedApp ? "APPLICATION_ACCEPTED" : "APPLICATION_REJECTED",
				acceptedApp ? `You're in: ${ev.title}` : `Update on ${ev.title}`,
				acceptedApp
					? `${ev.org.def.name} accepted your application. See you there!`
					: (a.reviewNote ?? null),
				"EVENT",
				ev.id,
				a.reviewedAt,
				`nv-app:${a.id}`,
				a.reviewedAt.getTime() < NOW - 3 * DAY,
			);
		}
		for (const p of rows.needPledges.filter(
			(x) => x.userId === namedVol.id && x.reviewedAt,
		)) {
			const need = needIds.find((n) => n.id === p.needId);
			if (!need || !p.reviewedAt) continue;
			const ok = p.status !== "REJECTED";
			notify(
				namedVol.id,
				ok ? "PLEDGE_ACCEPTED" : "PLEDGE_REJECTED",
				ok
					? `${need.org.def.name} accepted your offer`
					: `${need.org.def.name} declined your offer`,
				need.title,
				"ORGANIZATION_NEED",
				need.id,
				p.reviewedAt,
				`nv-pledge:${p.id}`,
				p.reviewedAt.getTime() < NOW - 2 * DAY,
			);
		}
		for (const c of rows.certificates.filter(
			(x) => x.volunteerId === namedVol.id,
		)) {
			const ev = evs.find((e) => e.id === c.eventId);
			notify(
				namedVol.id,
				"CERTIFICATE_ISSUED",
				"Your certificate is ready",
				ev ? `For ${ev.title} with ${ev.org.def.name}.` : null,
				"CERTIFICATE",
				c.id as string,
				c.issuedAt as Date,
				`nv-cert:${c.id}`,
				(c.issuedAt as Date).getTime() < NOW - 5 * DAY,
			);
		}
		const myDocs = await db
			.select({ id: s.userDocuments.id })
			.from(s.userDocuments)
			.where(eq(s.userDocuments.userId, namedVol.id));
		const docIds = [
			...myDocs.map((d) => d.id),
			sid("named-vol-doc:gov"),
			sid("named-vol-doc:selfie"),
		];
		docIds.slice(0, 2).forEach((docId, n) => {
			notify(
				namedVol.id,
				"DOCUMENT_VERIFIED",
				n === 0 ? "Your ID was verified" : "Your selfie was verified",
				n === 1
					? "Your identity is verified - you can now apply to events and pledge."
					: null,
				"USER_DOCUMENT",
				docId,
				new Date(namedVol.createdAt.getTime() + (1 + n * 0.1) * DAY),
				`nv-doc:${n}`,
				true,
			);
		});
		for (const [n, a] of announcementIds
			.filter((x) =>
				rows.follows.some(
					(f) => f.userId === namedVol.id && f.organizationId === x.org.id,
				),
			)
			.slice(0, 6)
			.entries()) {
			notify(
				namedVol.id,
				"BROADCAST",
				`${a.org.def.name}: ${a.title}`,
				null,
				"ANNOUNCEMENT",
				a.id,
				clampPast(maxDate(a.at, namedVol.createdAt)),
				`nv-ann:${n}`,
				n > 1,
			);
		}
		notify(
			namedVol.id,
			"BROADCAST",
			"Volunteer week starts Monday",
			"Over 120 events across 30 cities this week. Find one near you on the Explore tab.",
			"BROADCAST",
			null,
			ago(1.2),
			"nv-bc:1",
			false,
		);
		notify(
			namedVol.id,
			"BROADCAST",
			"New: certificates you can share",
			"Every certificate now has a public verification link.",
			"BROADCAST",
			null,
			ago(9),
			"nv-bc:2",
			true,
		);

		// NGO owner.
		const namedEvs = evs.filter((e) => e.org.named);
		const pendingApps = rows.eventApplications
			.filter((a) => namedEvs.some((e) => e.id === a.eventId))
			.sort(
				(a, b) =>
					(b.appliedAt as Date).getTime() - (a.appliedAt as Date).getTime(),
			)
			.slice(0, 16);
		pendingApps.forEach((a, n) => {
			const ev = namedEvs.find((e) => e.id === a.eventId);
			if (ev)
				notify(
					ngoUser.id,
					"NEW_APPLICATION",
					`New applicant for ${ev.title}`,
					null,
					"EVENT",
					ev.id,
					a.appliedAt as Date,
					`ngo-app:${n}`,
					n > 5,
				);
		});
		const namedNeedIds = new Set(
			needIds.filter((x) => x.org.named).map((x) => x.id),
		);
		rows.needPledges
			.filter((p) => namedNeedIds.has(p.needId as string))
			.sort(
				(a, b) =>
					(b.createdAt as Date).getTime() - (a.createdAt as Date).getTime(),
			)
			.slice(0, 9)
			.forEach((p, n) => {
				const need = needIds.find((x) => x.id === p.needId);
				if (need)
					notify(
						ngoUser.id,
						"NEW_PLEDGE",
						`Someone offered to help: ${need.title}`,
						p.quantity ? `${p.quantity} offered` : null,
						"ORGANIZATION_NEED",
						need.id,
						p.createdAt as Date,
						`ngo-pledge:${n}`,
						n > 3,
					);
			});
		donationsForNamedOrg
			.sort((a, b) => b.at.getTime() - a.at.getTime())
			.slice(0, 12)
			.forEach((d, n) => {
				notify(
					ngoUser.id,
					"DONATION_RECEIVED",
					`${d.name} donated ${fmtInr(d.amount)}`,
					null,
					"DONATION",
					d.id,
					d.at,
					`ngo-don:${n}`,
					n > 3,
				);
			});
		reviewIds
			.filter((x) => x.org.named)
			.sort((a, b) => b.at.getTime() - a.at.getTime())
			.slice(0, 7)
			.forEach((rv, n) => {
				notify(
					ngoUser.id,
					"NEW_REVIEW",
					`New ${rv.rating}-star review`,
					null,
					"REVIEW",
					rv.id,
					rv.at,
					`ngo-rev:${n}`,
					n > 2,
				);
			});
		const createdNamed = namedOrg.createdAt;
		notify(
			ngoUser.id,
			"ORG_REJECTED",
			"Verification needs another look",
			"The PAN card upload was unreadable. Please upload a clearer copy.",
			"ORGANIZATION",
			namedOrg.id,
			new Date(createdNamed.getTime() + 0.5 * DAY),
			"ngo-orgrej",
			true,
		);
		notify(
			ngoUser.id,
			"ORG_VERIFIED",
			"Your organisation is verified",
			"You can now publish events and needs.",
			"ORGANIZATION",
			namedOrg.id,
			new Date(createdNamed.getTime() + 1.5 * DAY),
			"ngo-orgok",
			true,
		);
		rows.organizationDocuments
			.filter(
				(d) =>
					d.organizationId === namedOrg.id &&
					d.verificationStatus === "VERIFIED",
			)
			.slice(0, 3)
			.forEach((d, n) => {
				notify(
					ngoUser.id,
					"DOCUMENT_VERIFIED",
					"Document verified",
					String(d.documentType).replace(/_/g, " "),
					"ORGANIZATION_DOCUMENT",
					d.id as string,
					new Date(createdNamed.getTime() + (1.2 + n * 0.05) * DAY),
					`ngo-doc:${n}`,
					true,
				);
			});
		notify(
			ngoUser.id,
			"DOCUMENT_REJECTED",
			"Document needs a re-upload",
			"The bank letter must show the account holder's name.",
			"ORGANIZATION_DOCUMENT",
			sid("named-org-doc:4"),
			ago(6),
			"ngo-docrej",
			true,
		);
		const namedTeam = rows.organizationAdmins.filter(
			(a) => a.organizationId === namedOrg.id,
		);
		namedTeam.slice(0, 3).forEach((m, n) => {
			notify(
				ngoUser.id,
				"TEAM_INVITE_ACCEPTED",
				"A teammate joined",
				`${rows.users.find((u) => u.id === m.userId)?.fullName} accepted your invite.`,
				"ORGANIZATION_ADMIN",
				m.id as string,
				m.joinedAt as Date,
				`ngo-team:${n}`,
				n > 0,
			);
		});
		notify(
			ngoUser.id,
			"BROADCAST",
			"Volunteer week starts Monday",
			"Publish your events by Friday to be featured.",
			"BROADCAST",
			null,
			ago(1.2),
			"ngo-bc:1",
			false,
		);

		// One of each team type on seeded team members, so the enum is covered.
		const someTeam = rows.organizationAdmins
			.filter((a) => !a.isOwner && a.organizationId !== namedOrg.id)
			.slice(0, 4);
		const teamTypes = [
			["TEAM_INVITE", "You're invited to join a team", "TEAM_INVITE"],
			["TEAM_ROLE_CHANGED", "Your role was changed", "ORGANIZATION"],
			["TEAM_REMOVED", "You were removed from a team", "ORGANIZATION"],
			["OWNERSHIP_TRANSFERRED", "Ownership transferred to you", "ORGANIZATION"],
		] as const;
		someTeam.forEach((m, n) => {
			const [type, title, entity] = teamTypes[n] as (typeof teamTypes)[number];
			notify(
				m.userId as string,
				type,
				title,
				null,
				entity,
				m.organizationId as string,
				ago(5 + n),
				`team-type:${n}`,
				false,
			);
		});
		notify(
			ADMIN,
			"BROADCAST",
			"Monthly platform report is ready",
			"Signups, events and donations for the month.",
			"BROADCAST",
			null,
			ago(2),
			"admin-bc:1",
			false,
		);
	}

	// ── The demo volunteer's identity documents (VERIFIED, matching its status)
	{
		const existingDocs = await db
			.select({ id: s.userDocuments.id })
			.from(s.userDocuments)
			.where(eq(s.userDocuments.userId, namedVol.id));
		if (
			existingDocs.length === 0 &&
			volUser.verificationStatus === "VERIFIED"
		) {
			const at = new Date(namedVol.createdAt.getTime() + 0.2 * DAY);
			rows.userDocuments.push(
				{
					id: sid("named-vol-doc:gov"),
					userId: namedVol.id,
					documentType: "AADHAR_CARD",
					documentKey: copyTo(
						`${DOCS}/user-documents/${namedVol.id}/seed/aadhar_card.png`,
						idPoolKey(0),
					),
					verificationStatus: "VERIFIED",
					uploadedAt: at,
					verifiedBy: ADMIN,
					verifiedAt: new Date(at.getTime() + DAY),
				},
				{
					id: sid("named-vol-doc:selfie"),
					userId: namedVol.id,
					documentType: "SELFIE",
					documentKey: copyTo(
						`${DOCS}/user-documents/${namedVol.id}/seed/selfie.jpg`,
						wantSelfie(1005),
					),
					verificationStatus: "VERIFIED",
					metadata: { challenge: "BLINK" },
					uploadedAt: at,
					verifiedBy: ADMIN,
					verifiedAt: new Date(at.getTime() + DAY),
				},
			);
		}
	}

	// ── Audit trail ──────────────────────────────────────────────────────
	{
		const r = rngFor("audit");
		const ip = () => `10.${r.int(0, 40)}.${r.int(0, 255)}.${r.int(1, 254)}`;
		let n = 0;
		const log = (
			performedBy: string | null,
			action: string,
			entityName: string,
			entityId: string,
			at: Date,
			newValue?: Record<string, unknown>,
		) =>
			rows.auditLogs.push({
				id: sid(`audit:${n++}`),
				performedBy,
				action,
				entityName,
				entityId,
				newValue: newValue ?? null,
				ipAddress: ip(),
				createdAt: clampPast(at),
			});
		for (const u of rows.users) {
			const isVol = rows.userRoles.some(
				(x) => x.userId === u.id && x.roleId === roleId("volunteer"),
			);
			log(
				u.id as string,
				"SELECT_ROLE",
				"USER",
				u.id as string,
				new Date((u.createdAt as Date).getTime() + 2 * 60_000),
				{ role: isVol ? "volunteer" : "organisation" },
			);
			if (isVol)
				log(
					u.id as string,
					"COMPLETE_VOLUNTEER_ONBOARDING",
					"USER",
					u.id as string,
					u.onboardedAt as Date,
				);
		}
		for (const o of rows.organizations) {
			log(
				o.ownerUserId,
				"COMPLETE_ORG_ONBOARDING",
				"ORGANIZATION",
				o.id as string,
				o.createdAt as Date,
			);
			if (o.reviewedAt)
				log(
					ADMIN,
					`ORG_VERIFICATION_${o.verificationStatus}`,
					"ORGANIZATION",
					o.id as string,
					o.reviewedAt,
					{ verificationStatus: o.verificationStatus },
				);
			if (o.status === "SUSPENDED")
				log(
					ADMIN,
					"ORG_STATUS_SUSPENDED",
					"ORGANIZATION",
					o.id as string,
					ago(20),
					{ reason: o.statusReason },
				);
			if (o.status === "DELETED")
				log(
					ADMIN,
					"ORG_STATUS_DELETED",
					"ORGANIZATION",
					o.id as string,
					ago(12),
					{ reason: o.statusReason },
				);
		}
		for (const d of rows.organizationDocuments) {
			log(
				null,
				"UPLOAD_ORG_DOCUMENT",
				"ORGANIZATION_DOCUMENT",
				d.id as string,
				d.uploadedAt as Date,
				{ documentType: d.documentType },
			);
			if (d.verifiedAt)
				log(
					ADMIN,
					`ORG_DOCUMENT_${d.verificationStatus}`,
					"ORGANIZATION_DOCUMENT",
					d.id as string,
					d.verifiedAt,
					{ remarks: d.remarks ?? null },
				);
		}
		for (const d of rows.userDocuments) {
			log(
				d.userId,
				"UPLOAD_USER_DOCUMENT",
				"USER_DOCUMENT",
				d.id as string,
				d.uploadedAt as Date,
				{ documentType: d.documentType },
			);
			if (d.verifiedAt)
				log(
					ADMIN,
					`USER_DOCUMENT_${d.verificationStatus}`,
					"USER_DOCUMENT",
					d.id as string,
					d.verifiedAt,
				);
		}
		for (const e of rows.events) {
			log(
				e.createdBy ?? null,
				"CREATE_EVENT",
				"EVENT",
				e.id as string,
				e.createdAt as Date,
				{ title: e.title },
			);
			if (e.status === "CANCELLED")
				log(
					e.createdBy ?? null,
					"CANCEL_EVENT",
					"EVENT",
					e.id as string,
					new Date((e.createdAt as Date).getTime() + 3 * DAY),
				);
		}
		for (const a of rows.eventApplications) {
			if (r.chance(0.5))
				log(
					a.volunteerId,
					"APPLY_TO_EVENT",
					"EVENT_APPLICATION",
					a.id as string,
					a.appliedAt as Date,
				);
			if (a.reviewedAt && r.chance(0.5))
				log(
					a.reviewedBy ?? null,
					`REVIEW_APPLICATION_${a.status}`,
					"EVENT_APPLICATION",
					a.id as string,
					a.reviewedAt,
				);
			if (a.status === "WITHDRAWN" && r.chance(0.5))
				log(
					a.volunteerId,
					"WITHDRAW_APPLICATION",
					"EVENT_APPLICATION",
					a.id as string,
					a.updatedAt as Date,
				);
		}
		for (const c of rows.certificates)
			log(
				c.issuedBy ?? null,
				"ISSUE_CERTIFICATE",
				"CERTIFICATE",
				c.id as string,
				c.issuedAt as Date,
				{ code: c.code },
			);
		for (const nd of rows.needs)
			log(
				nd.createdBy ?? null,
				"CREATE_NEED",
				"ORGANIZATION_NEED",
				nd.id as string,
				nd.createdAt as Date,
				{ title: nd.title },
			);
		for (const p of rows.needPledges) {
			if (r.chance(0.5))
				log(
					p.userId,
					"CREATE_PLEDGE",
					"NEED_PLEDGE",
					p.id as string,
					p.createdAt as Date,
				);
			if (p.reviewedAt && r.chance(0.5))
				log(
					p.reviewedBy ?? null,
					`REVIEW_PLEDGE_${p.status}`,
					"NEED_PLEDGE",
					p.id as string,
					p.reviewedAt,
				);
		}
		for (const d of rows.donations)
			if (d.status === "COMPLETED" && r.chance(0.4))
				log(
					null,
					"DONATION_COMPLETED",
					"DONATION",
					d.id as string,
					d.completedAt as Date,
					{ amountMinor: d.amountMinor },
				);
		for (const a of rows.announcements)
			if (a.status === "PUBLISHED")
				log(
					a.createdBy ?? null,
					"CREATE_ANNOUNCEMENT",
					"ANNOUNCEMENT",
					a.id as string,
					a.createdAt as Date,
					{ title: a.title },
				);
		for (const f of rows.financialReports)
			log(
				f.uploadedBy ?? null,
				"PUBLISH_FINANCIAL_REPORT",
				"FINANCIAL_REPORT",
				f.id as string,
				f.createdAt as Date,
				{ title: f.title },
			);
		for (const rv of rows.reviews)
			log(
				rv.userId,
				"CREATE_REVIEW",
				"REVIEW",
				rv.id as string,
				rv.createdAt as Date,
				{ rating: rv.rating },
			);
		for (const p of rows.posts)
			log(
				p.authorUserId,
				"CREATE_POST",
				"POST",
				p.id as string,
				p.createdAt as Date,
			);
		for (const u of rows.users)
			if (u.status === "SUSPENDED")
				log(ADMIN, "USER_STATUS_SUSPENDED", "USER", u.id as string, ago(15), {
					reason: u.suspendedReason,
				});
	}

	if (process.argv.includes("--plan")) {
		const dupes = (name: string, keys: string[]) => {
			const n = keys.length - new Set(keys).size;
			if (n) console.log(`  !! ${n} duplicate ${name}`);
		};
		for (const [name, list] of Object.entries(rows))
			dupes(
				`${name}.id`,
				list.map((x) => String((x as { id: string }).id)),
			);
		dupes(
			"application",
			rows.eventApplications.map((a) => `${a.eventId}:${a.volunteerId}`),
		);
		dupes(
			"pledge",
			rows.needPledges.map((a) => `${a.needId}:${a.userId}`),
		);
		dupes(
			"review",
			rows.reviews.map((a) => `${a.organizationId}:${a.userId}`),
		);
		dupes(
			"follow",
			rows.follows.map((a) => `${a.organizationId}:${a.userId}`),
		);
		dupes(
			"bookmark",
			rows.bookmarks.map((a) => `${a.organizationId}:${a.userId}`),
		);
		dupes(
			"cert code",
			rows.certificates.map((a) => a.code),
		);
		dupes(
			"cert app",
			rows.certificates.map((a) => a.applicationId),
		);
		dupes(
			"receipt",
			rows.donations
				.filter((d) => d.receiptNumber)
				.map((d) => d.receiptNumber as string),
		);
		dupes(
			"payment",
			rows.donations
				.filter((d) => d.providerPaymentId)
				.map((d) => d.providerPaymentId as string),
		);
		dupes(
			"email",
			rows.users.map((u) => u.email),
		);
		dupes(
			"folder",
			rows.posts.map((p) => p.mediaFolder),
		);
		dupes(
			"media key",
			rows.postsMedia.map((p) => p.objectKey),
		);
		dupes(
			"like/save",
			rows.postInteractions
				.filter(
					(i) => i.interactionType === "LIKE" || i.interactionType === "SAVE",
				)
				.map(
					(i) => `${i.userId}:${i.targetType}:${i.postId}:${i.interactionType}`,
				),
		);
		for (const e of rows.events)
			if ((e.acceptedCount ?? 0) > (e.volunteersNeeded ?? 1))
				console.log(`  !! overfull ${e.title}`);
		for (const nd of rows.needs)
			if (nd.quantity && (nd.fulfilledQuantity ?? 0) > nd.quantity)
				console.log(`  !! overfilled ${nd.title}`);
		for (const nd of rows.needs) {
			const sum = rows.needPledges
				.filter(
					(p) =>
						p.needId === nd.id &&
						(p.status === "ACCEPTED" || p.status === "COMPLETED"),
				)
				.reduce((acc, p) => acc + (p.quantity ?? 0), 0);
			if (nd.quantity && sum !== nd.fulfilledQuantity)
				console.log(
					`  !! need counter mismatch ${nd.title} ${sum} vs ${nd.fulfilledQuantity}`,
				);
		}
		for (const e of rows.events) {
			const n = rows.eventApplications.filter(
				(a) => a.eventId === e.id && a.status === "ACCEPTED",
			).length;
			if (n !== e.acceptedCount)
				console.log(`  !! event counter mismatch ${e.title}`);
		}
		const statuses = (list: { status?: unknown }[]) =>
			JSON.stringify(
				Object.fromEntries(
					[...new Set(list.map((x) => String(x.status)))].map((st) => [
						st,
						list.filter((x) => String(x.status) === st).length,
					]),
				),
			);
		console.log("  events", statuses(rows.events));
		console.log("  apps", statuses(rows.eventApplications));
		console.log("  needs", statuses(rows.needs));
		console.log("  pledges", statuses(rows.needPledges));
		console.log("  donations", statuses(rows.donations));
		const evStart = new Map(rows.events.map((e) => [e.id, e.startAt as Date]));
		console.log(
			"  applied after start:",
			rows.eventApplications.filter(
				(a) => (a.appliedAt as Date) > (evStart.get(a.eventId) as Date),
			).length,
			" events created after start:",
			rows.events.filter((e) => (e.createdAt as Date) > (e.startAt as Date))
				.length,
		);
		const perDay = new Map<string, number>();
		for (const a of rows.eventApplications) {
			const d = (a.appliedAt as Date).toISOString().slice(0, 10);
			perDay.set(d, (perDay.get(d) ?? 0) + 1);
		}
		const last = [...perDay.entries()]
			.sort()
			.slice(-35)
			.map(([, n]) => n);
		console.log("  apps/day, last 35 days:", last.join(" "));
		const mine = rows.eventApplications.filter(
			(a) => a.volunteerId === volUser.id,
		);
		console.log(
			"  demo volunteer apps",
			statuses(mine),
			"certs",
			rows.certificates.filter((c) => c.volunteerId === volUser.id).length,
			"pledges",
			statuses(rows.needPledges.filter((p) => p.userId === volUser.id)),
			"donations",
			rows.donations.filter((d) => d.donorUserId === volUser.id).length,
		);
		console.log(
			"  demo org events",
			statuses(rows.events.filter((e) => e.organizationId === ngoOrgRow.id)),
			"donations",
			rows.donations.filter((d) => d.organizationId === ngoOrgRow.id).length,
			"reviews",
			rows.reviews.filter((r) => r.organizationId === ngoOrgRow.id).length,
		);
		for (const [name, list] of Object.entries(rows))
			console.log(`  ${name.padEnd(24)} ${list.length}`);
		console.log(
			`  storage: ${poolUploads.size} pool, ${directUploads.size} files, ${copies.size} copies`,
		);
		process.exit(0);
	}

	// ── Storage ─────────────────────────────────────────────────────────
	const storageOk = storageConfigured();
	let ready = new Set<string>();
	if (!storageOk) {
		console.warn(
			"  storage: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY unset - images are skipped",
		);
	} else {
		const wanted = [
			...poolUploads.keys(),
			...directUploads.keys(),
			...copies.keys(),
		];
		ready = await existingKeys(wanted);
		const missingPool = [...poolUploads.entries()].filter(
			([key]) => !ready.has(key) && [...copies.values()].includes(key),
		);
		const missingDirect = [...directUploads.entries()].filter(
			([key]) => !ready.has(key),
		);
		const missingCopies = [...copies.entries()].filter(
			([dst]) => !ready.has(dst),
		);
		console.log(
			`  storage: ${ready.size} of ${wanted.length} objects already present; uploading ${missingPool.length} pool + ${missingDirect.length} files, copying ${missingCopies.length}`,
		);
		let failures = 0;
		const run = async (
			key: string,
			make: () => Promise<{ body: Uint8Array; contentType: string }>,
		) => {
			try {
				const file = await make();
				await uploadObject(key, file.body, file.contentType);
				ready.add(key);
			} catch (error) {
				failures++;
				if (failures <= 5)
					console.warn(
						`  storage: ${error instanceof Error ? error.message : String(error)}`,
					);
			}
		};
		await mapLimit(missingPool, 6, ([key, make]) => run(key, make));
		await mapLimit(missingDirect, 10, ([key, make]) => run(key, make));
		await mapLimit(missingCopies, 12, async ([dst, src]) => {
			if (!ready.has(src)) return;
			try {
				await copyObject(src, dst);
				ready.add(dst);
			} catch (error) {
				failures++;
				if (failures <= 5)
					console.warn(
						`  storage: ${error instanceof Error ? error.message : String(error)}`,
					);
			}
		});
		if (failures)
			console.warn(
				`  storage: ${failures} object(s) failed; their rows are written without the image`,
			);
	}
	const has = (key: string | null | undefined) =>
		key && ready.has(key) ? key : null;
	// Only reference objects that exist. Rows whose key is required (documents,
	// media, reports) are dropped instead.
	for (const u of rows.users) u.profileImage = has(u.profileImage);
	for (const o of rows.organizations) {
		o.logo = has(o.logo);
		o.coverImage = has(o.coverImage);
	}
	for (const e of rows.events) e.coverImage = has(e.coverImage);
	for (const nd of rows.needs) nd.coverImage = has(nd.coverImage);
	for (const a of rows.announcements) a.coverImageKey = has(a.coverImageKey);
	rows.postsMedia = rows.postsMedia.filter((m) => has(m.objectKey));
	rows.userDocuments = rows.userDocuments.filter((d) => has(d.documentKey));
	rows.organizationDocuments = rows.organizationDocuments.filter((d) =>
		has(d.documentKey),
	);
	rows.financialReports = rows.financialReports.filter((f) =>
		has(f.documentKey),
	);
	// A volunteer marked VERIFIED must have both approved documents behind it.
	const docTypesByUser = new Map<string, Set<string>>();
	for (const d of rows.userDocuments)
		if (d.verificationStatus === "VERIFIED")
			docTypesByUser.set(
				d.userId,
				new Set([
					...(docTypesByUser.get(d.userId) ?? []),
					d.documentType === "SELFIE" ? "selfie" : "gov",
				]),
			);
	let downgraded = 0;
	for (const u of rows.users) {
		if (
			u.verificationStatus === "VERIFIED" &&
			(docTypesByUser.get(u.id as string)?.size ?? 0) < 2
		) {
			u.verificationStatus = "PENDING";
			downgraded++;
		}
	}
	if (downgraded)
		console.warn(
			`  ${downgraded} volunteer(s) left PENDING because their documents could not be stored`,
		);

	// ── Write ───────────────────────────────────────────────────────────
	console.log("Flex seed: writing rows (existing rows are skipped)...");
	const report: [string, number, number][] = [];
	const put = async <T extends PgTable>(
		name: string,
		table: T,
		values: Insert<T>[],
	) => {
		let inserted = 0;
		for (let i = 0; i < values.length; i += 400) {
			const chunk = values.slice(i, i + 400);
			// biome-ignore lint/suspicious/noExplicitAny: generic bulk insert over many tables
			const insert = db.insert(table) as any;
			// biome-ignore lint/suspicious/noExplicitAny: every seeded table has an id column
			const idColumn = (table as any).id;
			const result = await insert
				.values(chunk)
				.onConflictDoNothing()
				.returning({ id: idColumn });
			inserted += (result as unknown[]).length;
		}
		report.push([name, values.length, inserted]);
	};
	if (!anchor) {
		await db
			.insert(s.auditLogs)
			.values({
				id: ANCHOR_ID,
				performedBy: ADMIN,
				action: "SEED_FLEX_ANCHOR",
				entityName: "SEED",
				newValue: { note: "Demo data seeded by packages/db/src/seed-flex.ts" },
				createdAt: new Date(NOW),
			})
			.onConflictDoNothing();
	}
	await put("users", s.users, rows.users);
	await put("user_roles", s.userRoles, rows.userRoles);
	await put("user_categories", s.userCategories, rows.userCategories);
	await put("user_documents", s.userDocuments, rows.userDocuments);
	await put("organizations", s.organizations, rows.organizations);
	await put(
		"organization_categories",
		s.organizationCategories,
		rows.organizationCategories,
	);
	await put(
		"organization_admins",
		s.organizationAdmins,
		rows.organizationAdmins,
	);
	await put(
		"organization_documents",
		s.organizationDocuments,
		rows.organizationDocuments,
	);
	await put("team_invites", s.teamInvites, rows.teamInvites);
	await put("events", s.events, rows.events);
	await put("event_applications", s.eventApplications, rows.eventApplications);
	await put("certificates", s.certificates, rows.certificates);
	await put("needs", s.needs, rows.needs);
	await put("need_pledges", s.needPledges, rows.needPledges);
	await put("donations", s.donations, rows.donations);
	await put("reviews", s.reviews, rows.reviews);
	await put("follows", s.follows, rows.follows);
	await put("bookmarks", s.bookmarks, rows.bookmarks);
	await put("announcements", s.announcements, rows.announcements);
	await put("financial_reports", s.financialReports, rows.financialReports);
	await put("posts", s.posts, rows.posts);
	await put("posts_media", s.postsMedia, rows.postsMedia);
	await put("post_interactions", s.postInteractions, rows.postInteractions);
	await put("post_comments", s.postComments, rows.postComments);
	await put("notifications", s.notifications, rows.notifications);
	await put("audit_logs", s.auditLogs, rows.auditLogs);

	// ── Fill empty fields on the demo accounts (never overwrite) ─────────
	const fill = (column: unknown, value: string | number) =>
		typeof value === "number"
			? sql`coalesce(${column}, ${value})`
			: sql`coalesce(nullif(${column}, ''), ${value})`;
	const o = s.organizations;
	await db
		.update(o)
		.set({
			description: fill(
				o.description,
				"Nabhya Foundation runs after-school learning centres, a community kitchen and a girls' mentoring programme across Navi Mumbai and Mumbai. About 600 volunteers give their time with us every year, and every rupee donated is reported back in our annual utilisation statement.",
			),
			mission: fill(
				o.mission,
				"Learning, a full meal and a fair start for every child in our neighbourhoods.",
			),
			vision: fill(
				o.vision,
				"Neighbourhoods where no child drops out of school for want of a meal, a book or a mentor.",
			),
			website: fill(o.website, "https://nabhya.com"),
			email: fill(o.email, "ngo@nabhya.com"),
			address: fill(o.address, "Plot 14, Sector 17, Vashi, Navi Mumbai"),
			city: fill(o.city, "Navi Mumbai"),
			state: fill(o.state, "Maharashtra"),
			pincode: fill(o.pincode, "400703"),
			latitude: sql`coalesce(${o.latitude}, 19.0771)`,
			longitude: sql`coalesce(${o.longitude}, 72.9986)`,
			teamSize: fill(o.teamSize, 18),
			foundingYear: fill(o.foundingYear, 2016),
			registrationNumber: fill(o.registrationNumber, "MH/2016/0184207"),
			...(ready.has(namedLogo) ? { logo: fill(o.logo, namedLogo) } : {}),
			...(ready.has(namedCover)
				? { coverImage: fill(o.coverImage, namedCover) }
				: {}),
		})
		.where(eq(o.id, namedOrg.id));
	const u = s.users;
	await db
		.update(u)
		.set({
			fullName: fill(u.fullName, "Meera Joshi"),
			city: fill(u.city, "Navi Mumbai"),
			state: fill(u.state, "Maharashtra"),
		})
		.where(eq(u.id, ngoUser.id));
	await db
		.update(u)
		.set({ fullName: fill(u.fullName, "Nabhya Admin") })
		.where(eq(u.id, ADMIN));
	await db
		.update(u)
		.set({
			state: fill(u.state, "Maharashtra"),
			latitude: sql`coalesce(${u.latitude}, 19.033)`,
			longitude: sql`coalesce(${u.longitude}, 73.0297)`,
		})
		.where(eq(u.id, volUser.id));
	// Interests for the demo volunteer, if it has none.
	const volCats = await db
		.select()
		.from(s.userCategories)
		.where(eq(s.userCategories.userId, volUser.id));
	if (volCats.length === 0) {
		await db
			.insert(s.userCategories)
			.values(
				namedVol.causes.map((c) => ({
					id: sid(`named-vol-cat:${c}`),
					userId: volUser.id,
					categoryId: categoryId(c),
				})),
			)
			.onConflictDoNothing();
	}

	// Counters are derived from child rows, so make them agree with whatever
	// is there now - including rows a real user added to seeded content.
	await db.execute(
		sql.raw(`
		update events e set accepted_count = c.n, volunteers_needed = greatest(e.volunteers_needed, c.n)
		from (select e2.id, (select count(*)::int from event_applications a where a.event_id = e2.id and a.status = 'ACCEPTED') n
		      from events e2 where e2.id::text like '5eedf1e0-%') c
		where c.id = e.id and e.accepted_count <> c.n`),
	);
	await db.execute(
		sql.raw(`
		update needs n set fulfilled_quantity = c.f, quantity = greatest(n.quantity, c.f),
			status = case when n.status = 'OPEN' and c.f >= greatest(n.quantity, c.f) then 'FULFILLED'::need_status else n.status end
		from (select n2.id, coalesce((select sum(p.quantity)::int from need_pledges p where p.need_id = n2.id and p.status in ('ACCEPTED', 'COMPLETED')), 0) f
		      from needs n2 where n2.id::text like '5eedf1e0-%' and n2.quantity is not null) c
		where c.id = n.id and n.fulfilled_quantity <> c.f`),
	);
	await db
		.update(s.auditLogs)
		.set({
			newValue: {
				note: "Demo data seeded by packages/db/src/seed-flex.ts",
				completedAt: new Date().toISOString(),
			},
		})
		.where(eq(s.auditLogs.id, ANCHOR_ID));

	console.log("\n  table                        built   new");
	for (const [name, built, inserted] of report)
		console.log(
			`  ${name.padEnd(28)} ${String(built).padStart(6)} ${String(inserted).padStart(5)}`,
		);
	console.log("\nFlex seed complete.");
	process.exit(0);
}

/** Rows currently tagged as seeded, per table. */
async function printSeededCounts() {
	const tables = [
		"users",
		"user_roles",
		"user_categories",
		"user_documents",
		"organizations",
		"organization_categories",
		"organization_admins",
		"organization_documents",
		"team_invites",
		"events",
		"event_applications",
		"certificates",
		"needs",
		"need_pledges",
		"donations",
		"reviews",
		"follows",
		"bookmarks",
		"announcements",
		"financial_reports",
		"posts",
		"posts_media",
		"post_interactions",
		"post_comments",
		"notifications",
		"audit_logs",
	];
	const result = await db.execute<{ t: string; n: string }>(
		sql.raw(
			tables
				.map(
					(t) =>
						`select '${t}' as t, count(*) as n from ${t} where id::text like '5eedf1e0-%'`,
				)
				.join(" union all "),
		),
	);
	for (const row of result.rows)
		console.log(`  ${row.t.padEnd(28)} ${String(row.n).padStart(6)}`);
}

async function existingKeys(keys: string[]): Promise<Set<string>> {
	const found = new Set<string>();
	for (let i = 0; i < keys.length; i += 2000) {
		const chunk = keys.slice(i, i + 2000);
		const result = await db.execute<{ key: string }>(
			sql`select bucket_id || '/' || name as key from storage.objects where bucket_id || '/' || name = any(${sql.raw(`array[${chunk.map((k) => `'${k.replace(/'/g, "''")}'`).join(",")}]`)}::text[])`,
		);
		for (const row of result.rows) found.add(row.key);
	}
	return found;
}

function capitalise(t: string) {
	return t.charAt(0).toUpperCase() + t.slice(1);
}
function roundQty(n: number) {
	if (n >= 200) return Math.round(n / 50) * 50;
	if (n >= 40) return Math.round(n / 10) * 10;
	return n;
}
function typeLabel(type: string) {
	return (
		{
			ANNUAL_REPORT: "Annual Report",
			AUDITED_STATEMENT: "Audited Financial Statement",
			UTILISATION_CERTIFICATE: "Utilisation Certificate",
			FCRA_RETURN: "FCRA Return",
		}[type] ?? "Report"
	);
}
function stateCode(state: string) {
	const codes: Record<string, string> = {
		Maharashtra: "MH",
		Delhi: "DL",
		Karnataka: "KA",
		Telangana: "TG",
		Gujarat: "GJ",
		"Tamil Nadu": "TN",
		"West Bengal": "WB",
		Rajasthan: "RJ",
		"Uttar Pradesh": "UP",
		"Madhya Pradesh": "MP",
		"Andhra Pradesh": "AP",
		Bihar: "BR",
		Punjab: "PB",
		Haryana: "HR",
		Kerala: "KL",
		Odisha: "OR",
		Uttarakhand: "UK",
		Jharkhand: "JH",
		Assam: "AS",
		Chandigarh: "CH",
		Chhattisgarh: "CT",
		"Jammu and Kashmir": "JK",
	};
	return codes[state] ?? "MH";
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
});
