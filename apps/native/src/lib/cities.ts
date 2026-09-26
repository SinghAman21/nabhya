/**
 * A canonical city list, and the state each one sits in.
 *
 * `needs.city`, `events.city`, `organizations.city` and `users.city` are all
 * free text, so "Mumbai", "mumbai" and "Bombay" are three different cities to
 * every query that filters on one. The real fix is a city table or a
 * normalising write path on the server; until then the *client* can at least
 * stop creating new spellings, which is where nearly all of them come from -
 * a typed city at onboarding, and a reverse-geocoded one from the OS.
 *
 * So this file does three things:
 *
 * - suggests cities as the user types, so most people never type a full name;
 * - fills the state from the city, so the pair can never disagree;
 * - maps the common aliases and old names onto one spelling, and applies that
 *   to whatever the device's geocoder hands back.
 *
 * It is deliberately not exhaustive. An unlisted city still goes through as
 * typed (normalised for case and spacing) - a volunteer in Tezpur must not be
 * told their town does not exist.
 */

const CONNECTORS = new Set(["and", "of", "the"]);

/** City → state. Ordered by population, which is also suggestion order. */
const CITY_STATES: Record<string, string> = {
	Mumbai: "Maharashtra",
	Delhi: "Delhi",
	Bengaluru: "Karnataka",
	Hyderabad: "Telangana",
	Ahmedabad: "Gujarat",
	Chennai: "Tamil Nadu",
	Kolkata: "West Bengal",
	Pune: "Maharashtra",
	Surat: "Gujarat",
	Jaipur: "Rajasthan",
	Lucknow: "Uttar Pradesh",
	Kanpur: "Uttar Pradesh",
	Nagpur: "Maharashtra",
	Indore: "Madhya Pradesh",
	Thane: "Maharashtra",
	Bhopal: "Madhya Pradesh",
	Visakhapatnam: "Andhra Pradesh",
	Patna: "Bihar",
	Vadodara: "Gujarat",
	Ghaziabad: "Uttar Pradesh",
	Ludhiana: "Punjab",
	Agra: "Uttar Pradesh",
	Nashik: "Maharashtra",
	Faridabad: "Haryana",
	Meerut: "Uttar Pradesh",
	Rajkot: "Gujarat",
	Varanasi: "Uttar Pradesh",
	Srinagar: "Jammu and Kashmir",
	Aurangabad: "Maharashtra",
	Dhanbad: "Jharkhand",
	Amritsar: "Punjab",
	Prayagraj: "Uttar Pradesh",
	Ranchi: "Jharkhand",
	Jodhpur: "Rajasthan",
	Coimbatore: "Tamil Nadu",
	Guwahati: "Assam",
	Chandigarh: "Chandigarh",
	Gurugram: "Haryana",
	Noida: "Uttar Pradesh",
	Kochi: "Kerala",
	Thiruvananthapuram: "Kerala",
	Bhubaneswar: "Odisha",
	Raipur: "Chhattisgarh",
	Dehradun: "Uttarakhand",
	Mysuru: "Karnataka",
	Madurai: "Tamil Nadu",
	Jamshedpur: "Jharkhand",
	Navi_Mumbai: "Maharashtra",
};

/**
 * Approximate centre of each listed city, for `nearestCity`.
 *
 * One decimal place short of precise, on purpose: this resolves a device's
 * coordinates to the nearest *city*, and a city is tens of kilometres wide.
 */
const CITY_COORDS: Record<string, readonly [number, number]> = {
	Mumbai: [19.076, 72.8777],
	Delhi: [28.6139, 77.209],
	Bengaluru: [12.9716, 77.5946],
	Hyderabad: [17.385, 78.4867],
	Ahmedabad: [23.0225, 72.5714],
	Chennai: [13.0827, 80.2707],
	Kolkata: [22.5726, 88.3639],
	Pune: [18.5204, 73.8567],
	Surat: [21.1702, 72.8311],
	Jaipur: [26.9124, 75.7873],
	Lucknow: [26.8467, 80.9462],
	Kanpur: [26.4499, 80.3319],
	Nagpur: [21.1458, 79.0882],
	Indore: [22.7196, 75.8577],
	Thane: [19.2183, 72.9781],
	Bhopal: [23.2599, 77.4126],
	Visakhapatnam: [17.6868, 83.2185],
	Patna: [25.5941, 85.1376],
	Vadodara: [22.3072, 73.1812],
	Ghaziabad: [28.6692, 77.4538],
	Ludhiana: [30.901, 75.8573],
	Agra: [27.1767, 78.0081],
	Nashik: [19.9975, 73.7898],
	Faridabad: [28.4089, 77.3178],
	Meerut: [28.9845, 77.7064],
	Rajkot: [22.3039, 70.8022],
	Varanasi: [25.3176, 82.9739],
	Srinagar: [34.0837, 74.7973],
	Aurangabad: [19.8762, 75.3433],
	Dhanbad: [23.7957, 86.4304],
	Amritsar: [31.634, 74.8723],
	Prayagraj: [25.4358, 81.8463],
	Ranchi: [23.3441, 85.3096],
	Jodhpur: [26.2389, 73.0243],
	Coimbatore: [11.0168, 76.9558],
	Guwahati: [26.1445, 91.7362],
	Chandigarh: [30.7333, 76.7794],
	Gurugram: [28.4595, 77.0266],
	Noida: [28.5355, 77.391],
	Kochi: [9.9312, 76.2673],
	Thiruvananthapuram: [8.5241, 76.9366],
	Bhubaneswar: [20.2961, 85.8245],
	Raipur: [21.2514, 81.6296],
	Dehradun: [30.3165, 78.0322],
	Mysuru: [12.2958, 76.6394],
	Madurai: [9.9252, 78.1198],
	Jamshedpur: [22.8046, 86.2029],
	"Navi Mumbai": [19.033, 73.0297],
};

/** Old names, colloquial names and common misspellings → the listed name. */
const ALIASES: Record<string, string> = {
	bombay: "Mumbai",
	bangalore: "Bengaluru",
	bangaluru: "Bengaluru",
	calcutta: "Kolkata",
	madras: "Chennai",
	poona: "Pune",
	gurgaon: "Gurugram",
	allahabad: "Prayagraj",
	mysore: "Mysuru",
	trivandrum: "Thiruvananthapuram",
	cochin: "Kochi",
	ernakulam: "Kochi",
	vizag: "Visakhapatnam",
	baroda: "Vadodara",
	"new delhi": "Delhi",
	gauhati: "Guwahati",
	"navi mumbai": "Navi Mumbai",
};

/** Suggestion order - the keys above, with the underscore placeholder fixed. */
export const CITY_SUGGESTIONS: string[] = Object.keys(CITY_STATES).map((city) =>
	city.replace(/_/g, " "),
);

const STATE_BY_LOWER_CITY = new Map(
	Object.entries(CITY_STATES).map(([city, state]) => [
		city.replace(/_/g, " ").toLowerCase(),
		state,
	]),
);

const CANONICAL_BY_LOWER_CITY = new Map(
	CITY_SUGGESTIONS.map((city) => [city.toLowerCase(), city]),
);

/** Every state and union territory, for the state field's own suggestions. */
export const INDIAN_STATES: string[] = [
	"Andaman and Nicobar Islands",
	"Andhra Pradesh",
	"Arunachal Pradesh",
	"Assam",
	"Bihar",
	"Chandigarh",
	"Chhattisgarh",
	"Dadra and Nagar Haveli and Daman and Diu",
	"Delhi",
	"Goa",
	"Gujarat",
	"Haryana",
	"Himachal Pradesh",
	"Jammu and Kashmir",
	"Jharkhand",
	"Karnataka",
	"Kerala",
	"Ladakh",
	"Lakshadweep",
	"Madhya Pradesh",
	"Maharashtra",
	"Manipur",
	"Meghalaya",
	"Mizoram",
	"Nagaland",
	"Odisha",
	"Puducherry",
	"Punjab",
	"Rajasthan",
	"Sikkim",
	"Tamil Nadu",
	"Telangana",
	"Tripura",
	"Uttar Pradesh",
	"Uttarakhand",
	"West Bengal",
];

/**
 * One spelling for one city.
 *
 * Case and spacing are normalised for everything; an alias or a listed city
 * additionally snaps to the canonical name. Anything else is returned
 * title-cased and otherwise untouched.
 */
export function normaliseCityName(raw: string): string {
	const collapsed = raw.trim().replace(/\s+/g, " ");
	if (!collapsed) return "";

	const lower = collapsed.toLowerCase();
	const alias = ALIASES[lower];
	if (alias) return alias;

	const canonical = CANONICAL_BY_LOWER_CITY.get(lower);
	if (canonical) return canonical;

	// Title case, with the connectors Indian place names actually use left
	// lowercase ("Rann of Kutch", not "Rann Of Kutch").
	return collapsed
		.split(" ")
		.map((word, index) => {
			const lowerWord = word.toLowerCase();
			if (index > 0 && CONNECTORS.has(lowerWord)) return lowerWord;
			return lowerWord.charAt(0).toUpperCase() + lowerWord.slice(1);
		})
		.join(" ");
}

/** The state a listed city sits in, or `null` when we do not know it. */
export function stateForCity(city: string): string | null {
	return STATE_BY_LOWER_CITY.get(normaliseCityName(city).toLowerCase()) ?? null;
}

/**
 * Cities to offer for what has been typed so far.
 *
 * Prefix matches rank above substring matches - someone typing "na" wants
 * Nagpur and Nashik before Puna-adjacent middles - and an exact match offers
 * nothing, because there is nothing left to choose.
 */
export function citySuggestions(query: string, limit = 6): string[] {
	const term = query.trim().toLowerCase();
	if (!term) return CITY_SUGGESTIONS.slice(0, limit);
	if (CANONICAL_BY_LOWER_CITY.has(term)) return [];

	const prefix: string[] = [];
	const contains: string[] = [];
	for (const city of CITY_SUGGESTIONS) {
		const lower = city.toLowerCase();
		if (lower.startsWith(term)) prefix.push(city);
		else if (lower.includes(term)) contains.push(city);
	}

	const aliasHit = Object.entries(ALIASES)
		.filter(([alias]) => alias.startsWith(term))
		.map(([, city]) => city);

	return [...new Set([...prefix, ...aliasHit, ...contains])].slice(0, limit);
}

/** State names matching what has been typed, same ranking rules. */
export function stateSuggestions(query: string, limit = 5): string[] {
	const term = query.trim().toLowerCase();
	if (!term) return [];
	if (INDIAN_STATES.some((state) => state.toLowerCase() === term)) return [];
	return INDIAN_STATES.filter((state) =>
		state.toLowerCase().includes(term),
	).slice(0, limit);
}

/* -------------------------------------------------------------------------- */
/* Coordinates → a city                                                       */
/* -------------------------------------------------------------------------- */

const EARTH_RADIUS_KM = 6371;

function haversineKm(
	[lat1, lon1]: readonly [number, number],
	[lat2, lon2]: readonly [number, number],
): number {
	const toRad = (deg: number) => (deg * Math.PI) / 180;
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
	return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * The listed city nearest to a coordinate, if one is close enough to be
 * plausible.
 *
 * This is the fallback when the platform cannot name a place, which is not an
 * edge case: `Location.reverseGeocodeAsync` is **not available on web at all**
 * (Expo dropped the Google Geocoding dependency), and on Android it can return
 * an empty array when Play Services' geocoder is unavailable or rate-limited.
 * Before this, "Use my current location" on those platforms saved coordinates
 * and then told the user to type their city anyway - which reads as broken,
 * because from the outside nothing happened.
 *
 * 120km is the cutoff: far enough to catch someone in a suburb or a satellite
 * town of a listed city, close enough that it never claims a district three
 * states away. Beyond it we say so rather than guess.
 */
export function nearestCity(
	latitude: number,
	longitude: number,
	maxKm = 120,
): { city: string; state: string; km: number } | null {
	let best: { city: string; km: number } | null = null;
	for (const [city, coords] of Object.entries(CITY_COORDS)) {
		const km = haversineKm([latitude, longitude], coords);
		if (!best || km < best.km) best = { city, km };
	}
	if (!best || best.km > maxKm) return null;
	return {
		city: best.city,
		state: stateForCity(best.city) ?? "",
		km: Math.round(best.km),
	};
}
