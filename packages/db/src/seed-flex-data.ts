/**
 * Content for `seed-flex.ts`: NGOs, people and the text banks events, needs,
 * posts and reviews are drawn from. Everything here is invented; cities use
 * the canonical spellings from apps/native/src/lib/cities.ts.
 */

export const CITY_STATES: Record<string, string> = {
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
	"Navi Mumbai": "Maharashtra",
};

export const CITY_COORDS: Record<string, readonly [number, number]> = {
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

export type Cause =
	| "education"
	| "healthcare"
	| "environment"
	| "women-child"
	| "animal-welfare"
	| "disaster-relief"
	| "food-nutrition"
	| "livelihood"
	| "elderly-care"
	| "rural-development";

export type Lifecycle =
	| "verified"
	| "suspended"
	| "deleted"
	| "pending"
	| "review"
	| "rejected";

export interface OrgDef {
	key: string;
	name: string;
	city: string;
	type: "TRUST" | "SOCIETY" | "SECTION_8";
	founded: number;
	causes: Cause[];
	mission: string;
	description: string;
	lifecycle: Lifecycle;
	/** Brand colour for the generated logo. */
	color: string;
	area: string;
	pincode: string;
}

export const ORGS: OrgDef[] = [
	{
		key: "annadaan",
		name: "Annadaan Rasoi Trust",
		city: "Mumbai",
		type: "TRUST",
		founded: 2012,
		causes: ["food-nutrition", "elderly-care"],
		mission: "A hot, honest meal for everyone who asks.",
		description:
			"Community kitchens in Kurla and Govandi serving about 1,800 cooked meals a day to daily-wage workers, elders living alone and hospital attendants. Most of the cooking and serving is done by volunteers in two shifts.",
		lifecycle: "verified",
		color: "#C2410C",
		area: "LBS Marg, Kurla West",
		pincode: "400070",
	},
	{
		key: "akshar",
		name: "Akshar Jyoti Foundation",
		city: "Pune",
		type: "SECTION_8",
		founded: 2014,
		causes: ["education", "women-child"],
		mission: "Every child in a settlement finishes school.",
		description:
			"After-school learning centres for first-generation learners in Pune's construction-worker settlements, with bridge classes for children who joined school late and a scholarship for girls moving to Class 11.",
		lifecycle: "verified",
		color: "#1D4ED8",
		area: "Hadapsar Gaon",
		pincode: "411028",
	},
	{
		key: "neeljharna",
		name: "Neel Jharna Lake Collective",
		city: "Bengaluru",
		type: "SOCIETY",
		founded: 2017,
		causes: ["environment"],
		mission: "Bring Bengaluru's lakes back to life.",
		description:
			"Citizen-led restoration of six lakes on Bengaluru's south-east edge: weekend clean-ups, inlet de-silting, native planting along the bund and monthly water-quality testing shared openly with the BBMP.",
		lifecycle: "verified",
		color: "#0E7490",
		area: "Sarjapur Road",
		pincode: "560035",
	},
	{
		key: "saanjh",
		name: "Saanjh Elder Care Society",
		city: "Delhi",
		type: "SOCIETY",
		founded: 2008,
		causes: ["elderly-care", "healthcare"],
		mission: "Nobody grows old alone.",
		description:
			"Day-care, weekly home visits and a free physiotherapy clinic for elders living alone in South Delhi. Volunteers are matched with one elder each and keep the visits going for at least six months.",
		lifecycle: "verified",
		color: "#7C3AED",
		area: "Malviya Nagar",
		pincode: "110017",
	},
	{
		key: "bhoomipaws",
		name: "Bhoomi Paws Rescue",
		city: "Hyderabad",
		type: "TRUST",
		founded: 2016,
		causes: ["animal-welfare"],
		mission: "A safe street for every animal in Hyderabad.",
		description:
			"Street-animal rescue, a 70-kennel recovery shelter in Shamshabad and an ABC sterilisation programme run with the GHMC. Our ambulance answers about 25 rescue calls a day.",
		lifecycle: "verified",
		color: "#B45309",
		area: "Shamshabad",
		pincode: "501218",
	},
	{
		key: "kaarigar",
		name: "Kaarigar Skills Mission",
		city: "Ahmedabad",
		type: "SECTION_8",
		founded: 2015,
		causes: ["livelihood", "women-child"],
		mission: "A first salary for every woman who walks in.",
		description:
			"Tailoring, block printing, digital literacy and spoken-English courses for women in Ahmedabad's eastern wards, with placement support and a small cooperative that sells their work.",
		lifecycle: "verified",
		color: "#BE185D",
		area: "Gomtipur",
		pincode: "380021",
	},
	{
		key: "sehatsaathi",
		name: "Sehat Saathi Health Network",
		city: "Chennai",
		type: "SECTION_8",
		founded: 2011,
		causes: ["healthcare"],
		mission: "Primary care within walking distance.",
		description:
			"Mobile health camps and a network of trained community health workers across North Chennai, focused on diabetes, hypertension and maternal health. Doctors volunteer on weekends.",
		lifecycle: "verified",
		color: "#047857",
		area: "Tondiarpet",
		pincode: "600081",
	},
	{
		key: "raahat",
		name: "Raahat Disaster Response Forum",
		city: "Kolkata",
		type: "TRUST",
		founded: 2009,
		causes: ["disaster-relief", "food-nutrition"],
		mission: "First in, last out.",
		description:
			"Cyclone and flood response across the Sundarbans and South 24 Parganas: dry-ration kits, community kitchens, tarpaulin shelters and rebuilding support. Between cyclone seasons we train village response teams.",
		lifecycle: "verified",
		color: "#B91C1C",
		area: "Behala",
		pincode: "700034",
	},
	{
		key: "gramuday",
		name: "Gram Uday Sansthan",
		city: "Jaipur",
		type: "SOCIETY",
		founded: 2006,
		causes: ["rural-development", "livelihood"],
		mission: "Water, work and dignity in every village.",
		description:
			"Watershed work, johad revival and women's self-help groups in 40 villages around Jaipur and Dausa. Volunteers help with surveys, digital record-keeping and our monthly village markets.",
		lifecycle: "verified",
		color: "#A16207",
		area: "Sanganer",
		pincode: "302029",
	},
	{
		key: "nanhekadam",
		name: "Nanhe Kadam Child Trust",
		city: "Lucknow",
		type: "TRUST",
		founded: 2013,
		causes: ["women-child", "education"],
		mission: "Childhood, not child labour.",
		description:
			"Drop-in centres for children rescued from roadside work in Lucknow, with meals, schooling support and counselling for families. We work closely with the district child protection unit.",
		lifecycle: "verified",
		color: "#DB2777",
		area: "Aminabad",
		pincode: "226018",
	},
	{
		key: "harabhara",
		name: "Hara Bhara Surat",
		city: "Surat",
		type: "SOCIETY",
		founded: 2019,
		causes: ["environment"],
		mission: "Ten lakh trees for Surat.",
		description:
			"Miyawaki pocket forests on school and society land across Surat, plus a riverbank clean-up on the Tapi every second Sunday. Over 1.4 lakh trees planted so far, with a survival rate we publish every quarter.",
		lifecycle: "verified",
		color: "#15803D",
		area: "Adajan",
		pincode: "395009",
	},
	{
		key: "bhakribank",
		name: "Bhakri Bank Nagpur",
		city: "Nagpur",
		type: "TRUST",
		founded: 2017,
		causes: ["food-nutrition"],
		mission: "Surplus food to the people who need it, the same night.",
		description:
			"We collect surplus food from weddings, hostels and restaurants every evening and get it to night shelters and railway colonies within two hours, with a cold chain run on donated vans.",
		lifecycle: "verified",
		color: "#EA580C",
		area: "Sitabuldi",
		pincode: "440012",
	},
	{
		key: "pustakghar",
		name: "Pustak Ghar Library Project",
		city: "Indore",
		type: "SOCIETY",
		founded: 2018,
		causes: ["education"],
		mission: "A library within a ten-minute walk of every child.",
		description:
			"Community libraries in 22 bastis across Indore, each run by a local young woman we train as librarian. Reading circles, storytelling weekends and a book-mobile for government schools.",
		lifecycle: "verified",
		color: "#4338CA",
		area: "Rajwada",
		pincode: "452002",
	},
	{
		key: "sahara-strays",
		name: "Sahara Shelter for Strays",
		city: "Thane",
		type: "TRUST",
		founded: 2015,
		causes: ["animal-welfare"],
		mission: "Rescue, treat, rehome.",
		description:
			"A shelter and treatment centre in Thane for injured street dogs and cats, with an adoption programme that has found homes for over 2,300 animals. Weekend volunteers walk, feed and socialise the residents.",
		lifecycle: "verified",
		color: "#92400E",
		area: "Ghodbunder Road",
		pincode: "400615",
	},
	{
		key: "swasthya",
		name: "Swasthya Seva Clinic Trust",
		city: "Bhopal",
		type: "TRUST",
		founded: 2010,
		causes: ["healthcare", "elderly-care"],
		mission: "Good medicine should not depend on income.",
		description:
			"A low-cost clinic and diagnostics centre in old Bhopal, with free eye and dental camps every month and long-term care for gas-tragedy survivors and their families.",
		lifecycle: "verified",
		color: "#0F766E",
		area: "Jahangirabad",
		pincode: "462008",
	},
	{
		key: "samudratat",
		name: "Samudra Tat Clean Coast",
		city: "Visakhapatnam",
		type: "SOCIETY",
		founded: 2018,
		causes: ["environment", "disaster-relief"],
		mission: "A clean coast and a ready one.",
		description:
			"Beach and mangrove clean-ups along the Vizag coast, turtle-nesting patrols in winter, and cyclone preparedness drills with fishing villages before every monsoon.",
		lifecycle: "verified",
		color: "#0369A1",
		area: "RK Beach Road",
		pincode: "530002",
	},
	{
		key: "kishori",
		name: "Kishori Shakti Manch",
		city: "Patna",
		type: "SOCIETY",
		founded: 2012,
		causes: ["women-child", "education"],
		mission: "Every girl stays in school past sixteen.",
		description:
			"Adolescent girls' collectives in Patna and nearby blocks: life-skills sessions, menstrual health, cycle libraries for the walk to school and career mentoring with volunteer professionals.",
		lifecycle: "verified",
		color: "#C026D3",
		area: "Kankarbagh",
		pincode: "800020",
	},
	{
		key: "vrikshmitra",
		name: "Vriksh Mitra Vadodara",
		city: "Vadodara",
		type: "TRUST",
		founded: 2016,
		causes: ["environment"],
		mission: "Shade for every street.",
		description:
			"Street-tree planting and care, a seed bank of native species, and the Vishwamitri riverbank restoration. Volunteers adopt a stretch of road and water their saplings through the first two summers.",
		lifecycle: "verified",
		color: "#166534",
		area: "Alkapuri",
		pincode: "390007",
	},
	{
		key: "nayidisha",
		name: "Nayi Disha Vocational Centre",
		city: "Ludhiana",
		type: "SECTION_8",
		founded: 2017,
		causes: ["livelihood"],
		mission: "Skills that lead to a job, not a certificate.",
		description:
			"Short vocational courses in electrical work, two-wheeler repair, retail and data entry for young people in Ludhiana, built with local employers who hire our graduates.",
		lifecycle: "verified",
		color: "#1E40AF",
		area: "Focal Point",
		pincode: "141010",
	},
	{
		key: "agra-ambulance",
		name: "Agra Animal Ambulance",
		city: "Agra",
		type: "TRUST",
		founded: 2019,
		causes: ["animal-welfare"],
		mission: "No injured animal left on the road.",
		description:
			"A 24-hour animal ambulance and a small surgical unit near the Yamuna, treating street dogs, donkeys, cattle and birds injured in traffic or heat.",
		lifecycle: "verified",
		color: "#9A3412",
		area: "Shahganj",
		pincode: "282010",
	},
	{
		key: "prerna",
		name: "Prerna Learning Circles",
		city: "Nashik",
		type: "TRUST",
		founded: 2015,
		causes: ["education"],
		mission: "Maths and reading at grade level by Class 5.",
		description:
			"Remedial learning circles in Nashik's municipal schools, run by trained volunteers who use play-based maths and reading kits. We test every child twice a year and share the results with the school.",
		lifecycle: "verified",
		color: "#2563EB",
		area: "Panchavati",
		pincode: "422003",
	},
	{
		key: "kashi",
		name: "Kashi Annakshetra",
		city: "Varanasi",
		type: "TRUST",
		founded: 2007,
		causes: ["food-nutrition", "elderly-care"],
		mission: "Feed the city's widows and pilgrims with dignity.",
		description:
			"A daily langar near the ghats for elderly widows, pilgrims and boatmen's families, and monthly ration kits for 600 elders living alone in Varanasi.",
		lifecycle: "verified",
		color: "#C2410C",
		area: "Dashashwamedh",
		pincode: "221001",
	},
	{
		key: "chinar",
		name: "Chinar Relief Network",
		city: "Srinagar",
		type: "SOCIETY",
		founded: 2014,
		causes: ["disaster-relief", "healthcare"],
		mission: "Ready before the snow, the flood and the cold.",
		description:
			"Winter relief, flood preparedness and mobile medical camps in the Kashmir valley, set up after the 2014 floods. Volunteers pack winter kits and staff our health camps in remote villages.",
		lifecycle: "verified",
		color: "#9F1239",
		area: "Rajbagh",
		pincode: "190008",
	},
	{
		key: "jaljharkhand",
		name: "Jharkhand Jal Abhiyan",
		city: "Ranchi",
		type: "SOCIETY",
		founded: 2013,
		causes: ["rural-development", "environment"],
		mission: "Every village water-secure.",
		description:
			"Check dams, farm ponds and well recharge with tribal communities around Ranchi and Khunti, alongside training for village water committees.",
		lifecycle: "verified",
		color: "#0E7490",
		area: "Kanke Road",
		pincode: "834008",
	},
	{
		key: "khelbeti",
		name: "Khel Beti Sports Foundation",
		city: "Jodhpur",
		type: "SECTION_8",
		founded: 2020,
		causes: ["women-child"],
		mission: "Every girl gets to play.",
		description:
			"Football and athletics programmes for girls from Jodhpur's old city, with coaching, kit, nutrition support and a mentoring circle that keeps players in school.",
		lifecycle: "verified",
		color: "#E11D48",
		area: "Sardarpura",
		pincode: "342003",
	},
	{
		key: "kovai",
		name: "Kovai Green Schools",
		city: "Coimbatore",
		type: "TRUST",
		founded: 2014,
		causes: ["environment", "education"],
		mission: "Every school a green school.",
		description:
			"Kitchen gardens, rainwater harvesting and waste segregation in 80 government schools around Coimbatore, run through student eco-clubs we train and support.",
		lifecycle: "verified",
		color: "#3F6212",
		area: "RS Puram",
		pincode: "641002",
	},
	{
		key: "brahmaputra",
		name: "Brahmaputra Flood Care",
		city: "Guwahati",
		type: "SOCIETY",
		founded: 2012,
		causes: ["disaster-relief", "rural-development"],
		mission: "Living with the river, not losing to it.",
		description:
			"Flood relief and resilient-livelihood work in char villages along the Brahmaputra: raised platforms, boat clinics, relief kits and seed banks that survive the water.",
		lifecycle: "verified",
		color: "#1D4ED8",
		area: "Ulubari",
		pincode: "781007",
	},
	{
		key: "sukoon",
		name: "Sukoon Palliative Care",
		city: "Chandigarh",
		type: "SECTION_8",
		founded: 2016,
		causes: ["healthcare", "elderly-care"],
		mission: "Comfort, at home, to the end.",
		description:
			"Home-based palliative care for patients with advanced cancer and chronic illness in the Tricity, with nurses, a doctor on call and trained volunteers who support families.",
		lifecycle: "verified",
		color: "#6D28D9",
		area: "Sector 22",
		pincode: "160022",
	},
	{
		key: "digitalsaathi",
		name: "Digital Saathi Gurugram",
		city: "Gurugram",
		type: "SECTION_8",
		founded: 2019,
		causes: ["education", "livelihood"],
		mission: "Digital skills for the people who keep the city running.",
		description:
			"Evening classes in smartphone banking, spreadsheets and job portals for domestic workers, drivers and security staff in Gurugram, taught by volunteers from nearby offices.",
		lifecycle: "verified",
		color: "#0284C7",
		area: "Sikanderpur",
		pincode: "122002",
	},
	{
		key: "kochicoast",
		name: "Kochi Coastal Fisherfolk Collective",
		city: "Kochi",
		type: "SOCIETY",
		founded: 2018,
		causes: ["livelihood", "disaster-relief"],
		mission: "A safer sea and a fair catch.",
		description:
			"Started after the 2018 floods, we support fishing families in Chellanam and Fort Kochi with boat repair, sea-safety kits, a cold-storage cooperative and flood drills.",
		lifecycle: "verified",
		color: "#0F766E",
		area: "Fort Kochi",
		pincode: "682001",
	},
	{
		key: "ananthapuri",
		name: "Ananthapuri Food Bank",
		city: "Thiruvananthapuram",
		type: "TRUST",
		founded: 2016,
		causes: ["food-nutrition"],
		mission: "No empty plate near the Medical College.",
		description:
			"A free lunch counter and a monthly ration bank for bystanders of patients at the Medical College and RCC, run with about 300 rotating volunteers.",
		lifecycle: "verified",
		color: "#D97706",
		area: "Medical College",
		pincode: "695011",
	},
	{
		key: "utkal",
		name: "Utkal Shiksha Abhiyan",
		city: "Bhubaneswar",
		type: "SOCIETY",
		founded: 2011,
		causes: ["education", "rural-development"],
		mission: "Mother-tongue first, then the world.",
		description:
			"Multilingual early-learning centres for tribal children in Odisha, with teaching material in Santali, Ho and Kui, and teacher training in Bhubaneswar.",
		lifecycle: "verified",
		color: "#4F46E5",
		area: "Saheed Nagar",
		pincode: "751007",
	},
	{
		key: "doon",
		name: "Doon Mountain Volunteers",
		city: "Dehradun",
		type: "TRUST",
		founded: 2015,
		causes: ["environment", "disaster-relief"],
		mission: "Clean trails and safe hills.",
		description:
			"Trail clean-ups, forest-fire watch and landslide response in the Garhwal hills. Every season we train volunteers in first aid and search-and-rescue basics.",
		lifecycle: "verified",
		color: "#166534",
		area: "Rajpur Road",
		pincode: "248001",
	},
	{
		key: "mysuruhands",
		name: "Mysuru Heritage Hands",
		city: "Mysuru",
		type: "TRUST",
		founded: 2014,
		causes: ["livelihood"],
		mission: "Keep the crafts alive by paying the craftspeople.",
		description:
			"Market access, design support and fair wages for rosewood inlay, silk weaving and Channapatna toy artisans around Mysuru, with a shop run by the artisans themselves.",
		lifecycle: "verified",
		color: "#7C2D12",
		area: "Devaraja Mohalla",
		pincode: "570001",
	},
	{
		key: "meenakshi",
		name: "Meenakshi Mothers Collective",
		city: "Madurai",
		type: "SOCIETY",
		founded: 2010,
		causes: ["women-child", "healthcare"],
		mission: "Healthy mothers, healthy babies.",
		description:
			"Mother-and-child health support in Madurai's wards and nearby villages: nutrition counselling, breastfeeding support groups and transport to hospital for high-risk pregnancies.",
		lifecycle: "verified",
		color: "#BE123C",
		area: "Simmakkal",
		pincode: "625001",
	},
	{
		key: "steelcity",
		name: "Steel City Blood Donors",
		city: "Jamshedpur",
		type: "SOCIETY",
		founded: 2009,
		causes: ["healthcare"],
		mission: "No patient waits for blood.",
		description:
			"A voluntary blood donor network of 9,000 registered donors in Jamshedpur, running monthly donation camps and a 24-hour helpline for thalassaemia patients and emergencies.",
		lifecycle: "verified",
		color: "#B91C1C",
		area: "Bistupur",
		pincode: "831001",
	},
	{
		key: "mangrove",
		name: "Navi Mumbai Mangrove Watch",
		city: "Navi Mumbai",
		type: "TRUST",
		founded: 2018,
		causes: ["environment"],
		mission: "Protect the mangroves that protect the city.",
		description:
			"Mangrove clean-ups, debris surveys and flamingo-season bird counts along the Thane creek, plus nature walks for schools in Nerul, Vashi and Airoli.",
		lifecycle: "verified",
		color: "#065F46",
		area: "Nerul",
		pincode: "400706",
	},
	{
		key: "oldcitytutors",
		name: "Old City Tutors Hyderabad",
		city: "Hyderabad",
		type: "SECTION_8",
		founded: 2016,
		causes: ["education"],
		mission: "Board-exam ready, in every lane of the old city.",
		description:
			"Free evening tuition for Classes 8 to 12 in Hyderabad's old city, with volunteer tutors in maths, science and English and a mentoring programme for first-generation college applicants.",
		lifecycle: "verified",
		color: "#1E3A8A",
		area: "Charminar",
		pincode: "500002",
	},
	{
		key: "mumbaipaws",
		name: "Mumbai Street Paws",
		city: "Mumbai",
		type: "TRUST",
		founded: 2014,
		causes: ["animal-welfare"],
		mission: "Fed, vaccinated and safe.",
		description:
			"Feeding routes, vaccination drives and an adoption network for street dogs and cats across the western suburbs, coordinated by 400 neighbourhood volunteers.",
		lifecycle: "verified",
		color: "#A16207",
		area: "Andheri West",
		pincode: "400058",
	},
	{
		key: "raatbasera",
		name: "Raat Basera Shelter Network",
		city: "Delhi",
		type: "SOCIETY",
		founded: 2010,
		causes: ["food-nutrition", "disaster-relief"],
		mission: "Nobody sleeps on the street in a Delhi winter.",
		description:
			"Night shelters, winter blanket drives and a cold-wave rescue van across Delhi, with hot meals every night from November to February.",
		lifecycle: "verified",
		color: "#334155",
		area: "Kashmere Gate",
		pincode: "110006",
	},
	{
		key: "goldenhands",
		name: "Golden Hands Charitable Trust",
		city: "Kanpur",
		type: "TRUST",
		founded: 2013,
		causes: ["livelihood"],
		mission: "Leather craft as a living.",
		description:
			"Skills and market linkages for leather artisans in Kanpur's tannery belt.",
		lifecycle: "suspended",
		color: "#78350F",
		area: "Jajmau",
		pincode: "208010",
	},
	{
		key: "prayas",
		name: "Prayas Youth Club",
		city: "Prayagraj",
		type: "SOCIETY",
		founded: 2016,
		causes: ["education"],
		mission: "Young people teaching younger people.",
		description:
			"Volunteer-run evening classes and sports for children near the Sangam.",
		lifecycle: "deleted",
		color: "#475569",
		area: "Daraganj",
		pincode: "211006",
	},
	{
		key: "sevasetu",
		name: "Seva Setu Foundation",
		city: "Raipur",
		type: "SECTION_8",
		founded: 2021,
		causes: ["education", "women-child"],
		mission: "A bridge to school for every migrant child.",
		description:
			"Seasonal schools at brick kilns and construction sites around Raipur so that migrant children do not lose a year of learning.",
		lifecycle: "pending",
		color: "#2563EB",
		area: "Telibandha",
		pincode: "492006",
	},
	{
		key: "aarogyagrameen",
		name: "Aarogya Grameen Trust",
		city: "Meerut",
		type: "TRUST",
		founded: 2019,
		causes: ["healthcare", "rural-development"],
		mission: "A health worker in every village.",
		description:
			"Training village health volunteers and running monthly camps in villages around Meerut, with telemedicine links to specialists.",
		lifecycle: "review",
		color: "#047857",
		area: "Shastri Nagar",
		pincode: "250004",
	},
	{
		key: "navankur",
		name: "Navankur Nursery Society",
		city: "Rajkot",
		type: "SOCIETY",
		founded: 2022,
		causes: ["environment"],
		mission: "Native saplings for every school in Saurashtra.",
		description:
			"A volunteer-run nursery growing native, drought-tolerant saplings for schools and gram panchayats around Rajkot.",
		lifecycle: "pending",
		color: "#15803D",
		area: "Kalawad Road",
		pincode: "360005",
	},
	{
		key: "helpinghearts",
		name: "Helping Hearts Welfare Association",
		city: "Faridabad",
		type: "SOCIETY",
		founded: 2020,
		causes: ["elderly-care"],
		mission: "Care for elders in industrial colonies.",
		description:
			"Elder support in Faridabad's industrial colonies: health check-ups and pension paperwork help.",
		lifecycle: "rejected",
		color: "#7E22CE",
		area: "NIT 5",
		pincode: "121001",
	},
	{
		key: "newhope",
		name: "New Hope Care Society",
		city: "Ghaziabad",
		type: "SOCIETY",
		founded: 2021,
		causes: ["healthcare"],
		mission: "Affordable dialysis for all.",
		description: "A proposed low-cost dialysis centre in Ghaziabad.",
		lifecycle: "rejected",
		color: "#0F766E",
		area: "Raj Nagar",
		pincode: "201002",
	},
];

// ─── People ─────────────────────────────────────────────────────────────────

export const FIRST_NAMES = [
	"Aarav",
	"Ananya",
	"Vihaan",
	"Diya",
	"Arjun",
	"Ishita",
	"Kabir",
	"Meera",
	"Rohan",
	"Saanvi",
	"Aditya",
	"Kavya",
	"Siddharth",
	"Nandini",
	"Rahul",
	"Pooja",
	"Karthik",
	"Lakshmi",
	"Farhan",
	"Zoya",
	"Harpreet",
	"Simran",
	"Arnav",
	"Riya",
	"Pranav",
	"Sneha",
	"Imran",
	"Ayesha",
	"Vikram",
	"Tanvi",
	"Nikhil",
	"Shruti",
	"Abhishek",
	"Neha",
	"Manish",
	"Priyanka",
	"Suresh",
	"Divya",
	"Gaurav",
	"Anjali",
	"Rajat",
	"Swati",
	"Aniket",
	"Bhavna",
	"Varun",
	"Pallavi",
	"Yash",
	"Mehak",
	"Joseph",
	"Mariam",
	"Tenzin",
	"Lalremruati",
	"Debashish",
	"Moumita",
	"Sandeep",
	"Gayatri",
	"Omkar",
	"Ritika",
	"Sameer",
	"Fatima",
];

export const LAST_NAMES = [
	"Sharma",
	"Iyer",
	"Patel",
	"Reddy",
	"Nair",
	"Kulkarni",
	"Banerjee",
	"Singh",
	"Gupta",
	"Menon",
	"Deshpande",
	"Chatterjee",
	"Khan",
	"Fernandes",
	"Joshi",
	"Rao",
	"Pillai",
	"Mehta",
	"Bhatt",
	"Das",
	"Shaikh",
	"Verma",
	"Agarwal",
	"Mishra",
	"Krishnan",
	"Kapoor",
	"Ghosh",
	"Pandey",
	"Sinha",
	"Naidu",
	"Chauhan",
	"Bose",
	"Saxena",
	"Hegde",
	"Gill",
	"Thakur",
	"Mukherjee",
	"Desai",
	"Rathore",
	"Kamath",
	"Dutta",
	"Yadav",
	"Shetty",
	"Varghese",
	"Ansari",
	"Tiwari",
	"Pawar",
	"Bhattacharya",
	"Jain",
	"Sethi",
];

export const PROFESSIONS = [
	"software engineer",
	"final-year engineering student",
	"chartered accountant",
	"school teacher",
	"nurse",
	"product designer",
	"retired bank manager",
	"MBA student",
	"physiotherapist",
	"marketing analyst",
	"civil engineer",
	"medical student",
	"journalist",
	"homemaker",
	"data analyst",
	"architect",
	"college lecturer",
	"HR professional",
	"law student",
	"photographer",
];

export const BIO_TEMPLATES = [
	"{prof} in {city}. I volunteer most weekends and love anything outdoors.",
	"{prof}. Trying to give a few hours every month to causes I care about - {cause} mostly.",
	"Weekend volunteer, weekday {prof}. Happy to teach, carry boxes or run a registration desk.",
	"{prof} based in {city}. Interested in {cause}; I can also help with spreadsheets and photos.",
	"I started volunteering in college and never stopped. Currently a {prof} in {city}.",
	"{prof}. Fluent in Hindi, English and some {lang}. Ask me to help with translation.",
	"Believer in small, regular help over big one-offs. {prof}, {city}.",
	"{prof} and part-time runner. Volunteering for {cause} since 2021.",
];

export const LANGS = [
	"Marathi",
	"Tamil",
	"Bengali",
	"Telugu",
	"Kannada",
	"Gujarati",
	"Malayalam",
	"Punjabi",
];

export const CAUSE_LABEL: Record<Cause, string> = {
	education: "education",
	healthcare: "community health",
	environment: "the environment",
	"women-child": "women and children",
	"animal-welfare": "animal welfare",
	"disaster-relief": "disaster relief",
	"food-nutrition": "food security",
	livelihood: "livelihoods",
	"elderly-care": "elder care",
	"rural-development": "rural development",
};

export const DESIGNATIONS: Record<
	"ADMIN" | "MANAGER" | "MEMBER" | "VIEWER",
	string[]
> = {
	ADMIN: ["Programme Director", "Operations Head", "Co-founder"],
	MANAGER: ["Volunteer Coordinator", "Programme Manager", "Field Manager"],
	MEMBER: ["Field Officer", "Communications Lead", "Community Mobiliser"],
	VIEWER: ["Board Member", "Finance Advisor", "Auditor"],
};

// ─── Events ─────────────────────────────────────────────────────────────────

export interface EventTpl {
	title: string;
	description: string;
	venue: string;
	hours: number;
	needed: [number, number];
}

export const EVENTS: Record<Cause, EventTpl[]> = {
	education: [
		{
			title: "Weekend reading circle",
			description:
				"Read aloud with small groups of children aged 6 to 10 and help them pick their next book. We give you a short briefing and a reading kit on arrival. Hindi or the local language helps but is not required.",
			venue: "Community library",
			hours: 3,
			needed: [8, 20],
		},
		{
			title: "Board-exam revision marathon",
			description:
				"A day of doubt-clearing for Class 10 students before their board exams. We need tutors for maths, science and English; you will sit with groups of four and work through past papers.",
			venue: "Municipal school hall",
			hours: 6,
			needed: [10, 25],
		},
		{
			title: "Science fair volunteer day",
			description:
				"Help 120 students set up and present their projects. We need judges, table helpers and two people to keep the crowd moving.",
			venue: "Community hall",
			hours: 5,
			needed: [10, 20],
		},
		{
			title: "Back-to-school kit packing",
			description:
				"Pack and label school kits - bag, notebooks, geometry box and a water bottle - for children joining Class 1. Good for groups and families.",
			venue: "Our learning centre",
			hours: 3,
			needed: [15, 40],
		},
		{
			title: "Career day for Class 12",
			description:
				"Talk to small groups of students about your work and how you got there. Twenty minutes per group, four groups. Bring your story, not slides.",
			venue: "Government girls' school",
			hours: 4,
			needed: [8, 15],
		},
	],
	healthcare: [
		{
			title: "Free eye-screening camp",
			description:
				"Register patients, guide them between stations and hand out spectacles. Optometrists run the screening; volunteers keep the queue calm and moving.",
			venue: "Ward community centre",
			hours: 6,
			needed: [12, 30],
		},
		{
			title: "Diabetes and BP screening drive",
			description:
				"Help our health workers record readings, explain results in simple words and book follow-up visits. Medical students especially welcome.",
			venue: "Weekly market ground",
			hours: 5,
			needed: [10, 20],
		},
		{
			title: "Blood donation camp",
			description:
				"Welcome donors, manage registration and the refreshment table, and look after first-time donors after they give. Donors are welcome too.",
			venue: "College auditorium",
			hours: 6,
			needed: [10, 25],
		},
		{
			title: "Health-camp logistics crew",
			description:
				"Set up tents, tables and the pharmacy counter before the camp opens, and pack up afterwards. Physical work, good company, breakfast provided.",
			venue: "Village panchayat ground",
			hours: 4,
			needed: [8, 16],
		},
	],
	environment: [
		{
			title: "Lake shoreline clean-up",
			description:
				"Monthly shoreline clean-up and invasive-weed removal. Wear clothes you do not mind ruining. Gloves, bags and breakfast provided.",
			venue: "Lake bund, north gate",
			hours: 3,
			needed: [30, 80],
		},
		{
			title: "Miyawaki planting morning",
			description:
				"Plant 1,200 native saplings in a pocket forest on school land. We will show you how to plant, mulch and water. Bring a cap and a water bottle.",
			venue: "School campus",
			hours: 4,
			needed: [25, 60],
		},
		{
			title: "Street-tree census walk",
			description:
				"Walk assigned streets with our app and log every tree: species, girth and health. Good for anyone who likes walking and spreadsheets.",
			venue: "Meet at the metro station",
			hours: 4,
			needed: [15, 35],
		},
		{
			title: "Beach and mangrove clean-up",
			description:
				"Clear plastic from the high-tide line and the mangrove edge, then help us sort and weigh what we collect for our debris survey.",
			venue: "Creek jetty",
			hours: 3,
			needed: [30, 70],
		},
		{
			title: "Seed-ball making workshop",
			description:
				"Make seed balls of native species with school children for the monsoon dispersal drive. Messy and fun.",
			venue: "Our nursery",
			hours: 3,
			needed: [10, 25],
		},
	],
	"women-child": [
		{
			title: "Girls' football coaching assist",
			description:
				"Help our coach run drills for girls aged 10 to 15: cones, water breaks, encouragement. No football expertise needed, just energy.",
			venue: "Municipal ground",
			hours: 3,
			needed: [6, 12],
		},
		{
			title: "Menstrual health session support",
			description:
				"Help facilitators run a session for adolescent girls: setting up, distributing kits and answering questions in small groups. Women volunteers only for this session.",
			venue: "Community centre",
			hours: 3,
			needed: [5, 10],
		},
		{
			title: "Children's art day",
			description:
				"Run an art table for children at our drop-in centre. Materials provided; bring patience and a sense of humour.",
			venue: "Drop-in centre",
			hours: 3,
			needed: [8, 15],
		},
		{
			title: "Mentoring circle for young women",
			description:
				"Meet a small circle of young women preparing for their first jobs. Talk about interviews, workplaces and money. Women professionals especially welcome.",
			venue: "Our office",
			hours: 2,
			needed: [5, 12],
		},
	],
	"animal-welfare": [
		{
			title: "Shelter walk-and-wash morning",
			description:
				"Walk the dogs, help with baths and give the kennels a scrub. Bring old clothes. Teenagers over 14 welcome with a parent.",
			venue: "Shelter",
			hours: 3,
			needed: [8, 20],
		},
		{
			title: "Adoption weekend",
			description:
				"Help potential adopters meet our dogs and cats, explain our process and fill in the forms. Good with people, good with animals.",
			venue: "Pet-friendly cafe",
			hours: 5,
			needed: [6, 14],
		},
		{
			title: "Anti-rabies vaccination drive",
			description:
				"Assist our vets on a neighbourhood vaccination route: spot and record dogs, hold collars, mark vaccinated dogs. Pre-exposure vaccination preferred.",
			venue: "Ward office",
			hours: 5,
			needed: [10, 20],
		},
		{
			title: "Monsoon shelter repair day",
			description:
				"Fix kennel roofs, clear drains and lay new bedding before the rains. Some carpentry skill helps; tools provided.",
			venue: "Shelter",
			hours: 5,
			needed: [8, 15],
		},
	],
	"disaster-relief": [
		{
			title: "Relief-kit packing shift",
			description:
				"Pack dry-ration and hygiene kits for families affected by the floods. Assembly-line work; we need people who can stand for a few hours.",
			venue: "Warehouse",
			hours: 4,
			needed: [25, 60],
		},
		{
			title: "Community preparedness drill",
			description:
				"Help us run an evacuation and first-aid drill with a coastal village. Volunteers play roles, time the drill and note what went wrong.",
			venue: "Village school",
			hours: 5,
			needed: [10, 25],
		},
		{
			title: "Winter blanket distribution",
			description:
				"Distribute blankets and hot food to people sleeping outdoors. We go out in small teams with a coordinator. Night shift, 9pm to 1am.",
			venue: "Meet at our office",
			hours: 4,
			needed: [15, 40],
		},
		{
			title: "First-aid and rescue basics training",
			description:
				"A one-day training for new response volunteers: first aid, CPR, safe lifting and radio basics. Certificate on completion.",
			venue: "Training hall",
			hours: 7,
			needed: [20, 40],
		},
	],
	"food-nutrition": [
		{
			title: "Sunday kitchen shift",
			description:
				"Chop, cook, pack and serve alongside our regular team. No experience needed; we will show you everything. Breakfast and chai on us.",
			venue: "Community kitchen",
			hours: 4,
			needed: [15, 30],
		},
		{
			title: "Ration-kit packing",
			description:
				"Pack monthly ration kits - rice, dal, oil, spices - for elders living alone. Assembly line, music and a lot of rice.",
			venue: "Store room",
			hours: 3,
			needed: [15, 35],
		},
		{
			title: "Evening surplus-food run",
			description:
				"Ride along on our evening van run collecting surplus food from caterers and delivering it to shelters. Two-wheeler riders also needed.",
			venue: "Collection point",
			hours: 3,
			needed: [6, 12],
		},
		{
			title: "Festival langar seva",
			description:
				"Serve and clean up at our festival langar. Expecting about 3,000 people over the day; shifts of four hours.",
			venue: "Ghat-side hall",
			hours: 4,
			needed: [30, 60],
		},
	],
	livelihood: [
		{
			title: "Mock-interview morning",
			description:
				"Thirty minutes each with women about to sit their first job interview. HR and hiring managers especially welcome.",
			venue: "Training centre",
			hours: 3,
			needed: [8, 16],
		},
		{
			title: "Artisan market stall day",
			description:
				"Help artisans run their stalls at the weekend market: billing, packing and UPI payments. A good day for people who like talking to customers.",
			venue: "City haat",
			hours: 6,
			needed: [10, 20],
		},
		{
			title: "Spreadsheet basics class",
			description:
				"Teach a two-hour beginner class on spreadsheets to adult learners. Our lesson plan, your patience.",
			venue: "Computer lab",
			hours: 2,
			needed: [4, 8],
		},
		{
			title: "Placement day with local employers",
			description:
				"Twelve employers, sixty candidates. Help with registration, keep interviews on schedule and calm some nerves.",
			venue: "Training centre",
			hours: 6,
			needed: [8, 15],
		},
	],
	"elderly-care": [
		{
			title: "Afternoon with the elders",
			description:
				"Spend an afternoon at our day-care centre: carrom, music, help with phones and video calls to family. The most requested thing is conversation.",
			venue: "Day-care centre",
			hours: 3,
			needed: [8, 15],
		},
		{
			title: "Home-visit buddy orientation",
			description:
				"An orientation for new home-visit volunteers. You will be matched with one elder near you and visit once a week.",
			venue: "Our office",
			hours: 2,
			needed: [10, 25],
		},
		{
			title: "Pension and paperwork camp",
			description:
				"Help elders with pension, Aadhaar and bank paperwork. Bring a laptop if you can; we provide the forms and a supervisor.",
			venue: "Community hall",
			hours: 5,
			needed: [6, 12],
		},
	],
	"rural-development": [
		{
			title: "Village water survey",
			description:
				"Two days in a village helping our team map wells, hand pumps and ponds with a simple app. Travel and food arranged from the city.",
			venue: "Field office",
			hours: 8,
			needed: [8, 15],
		},
		{
			title: "Farm-pond digging shramdaan",
			description:
				"A morning of shramdaan with villagers digging a farm pond before the monsoon. Hard physical work; we leave the city at 6am.",
			venue: "Village site",
			hours: 5,
			needed: [20, 50],
		},
		{
			title: "Self-help group bookkeeping day",
			description:
				"Help women's self-help groups update their passbooks and ledgers. Accountants and commerce students especially welcome.",
			venue: "Block office",
			hours: 4,
			needed: [6, 12],
		},
	],
};

// ─── Needs ──────────────────────────────────────────────────────────────────

export interface NeedTpl {
	type: "WANT" | "OFFER";
	title: string;
	description: string;
	quantity?: [number, number];
	unit?: string;
	urgency: "LOW" | "MEDIUM" | "HIGH";
}

export const NEEDS: Record<Cause, NeedTpl[]> = {
	education: [
		{
			type: "WANT",
			title: "Class 6 to 8 textbooks, state board",
			description:
				"Second-hand is fine as long as pages are intact. We need sets for students who joined mid-year.",
			quantity: [30, 80],
			unit: "sets",
			urgency: "HIGH",
		},
		{
			type: "WANT",
			title: "Weekend maths tutors",
			description:
				"Two hours on Saturday mornings. You need to be comfortable with Class 7 maths and patient with kids who are not.",
			quantity: [4, 10],
			unit: "tutors",
			urgency: "MEDIUM",
		},
		{
			type: "WANT",
			title: "Children's storybooks in Hindi and English",
			description:
				"For our community libraries. Picture books and early readers are most in demand.",
			quantity: [200, 600],
			unit: "books",
			urgency: "LOW",
		},
		{
			type: "OFFER",
			title: "Surplus school desks for a rural school",
			description:
				"We have sturdy two-seater desks left over from a school renovation, free to any school that can collect them.",
			quantity: [20, 40],
			unit: "desks",
			urgency: "LOW",
		},
		{
			type: "WANT",
			title: "Working laptops for the learning lab",
			description:
				"Any laptop that boots and runs a browser. We wipe and set them up ourselves.",
			quantity: [8, 20],
			unit: "laptops",
			urgency: "HIGH",
		},
	],
	healthcare: [
		{
			type: "WANT",
			title: "Glucometer strips for screening camps",
			description:
				"Our monthly camps screen about 400 people. Unopened strips with at least six months to expiry, please.",
			quantity: [500, 2000],
			unit: "strips",
			urgency: "HIGH",
		},
		{
			type: "WANT",
			title: "Volunteer doctors for Sunday camps",
			description:
				"General physicians and gynaecologists for our Sunday camps, once a month, 9am to 2pm.",
			quantity: [4, 10],
			unit: "doctors",
			urgency: "MEDIUM",
		},
		{
			type: "OFFER",
			title: "Reading glasses for elders",
			description:
				"We have reading glasses in common powers from a donor. Elders' homes and day-care centres can request them.",
			quantity: [150, 400],
			unit: "pairs",
			urgency: "LOW",
		},
		{
			type: "WANT",
			title: "Wheelchairs and walkers",
			description:
				"We lend mobility aids to families who cannot afford them. Working condition; we service them ourselves.",
			quantity: [10, 25],
			unit: "aids",
			urgency: "HIGH",
		},
	],
	environment: [
		{
			type: "OFFER",
			title: "Native saplings for housing societies",
			description:
				"Neem, pongamia and jamun saplings, free for any society or school that commits to watering them for the first year.",
			quantity: [300, 1200],
			unit: "saplings",
			urgency: "LOW",
		},
		{
			type: "WANT",
			title: "Gardening gloves and hand tools",
			description:
				"For our weekend clean-ups. Gloves get destroyed fast; trowels and hand rakes last.",
			quantity: [80, 200],
			unit: "pairs",
			urgency: "MEDIUM",
		},
		{
			type: "WANT",
			title: "Compost bins for school eco-clubs",
			description:
				"Two-bin composters for our school eco-clubs. New or gently used.",
			quantity: [20, 50],
			unit: "bins",
			urgency: "LOW",
		},
		{
			type: "WANT",
			title: "Volunteers with a two-wheeler for watering rounds",
			description:
				"Summer watering rounds for street saplings, twice a week, 6am to 8am. We provide cans and a route.",
			quantity: [10, 25],
			unit: "volunteers",
			urgency: "HIGH",
		},
	],
	"women-child": [
		{
			type: "WANT",
			title: "Sanitary pads for adolescent girls",
			description:
				"For our monthly sessions in government schools. Sealed packs only.",
			quantity: [1000, 3000],
			unit: "packs",
			urgency: "HIGH",
		},
		{
			type: "WANT",
			title: "Football boots, sizes 3 to 7",
			description:
				"Many of our players train barefoot. New or lightly used boots in good condition.",
			quantity: [30, 60],
			unit: "pairs",
			urgency: "MEDIUM",
		},
		{
			type: "WANT",
			title: "Bicycles for the walk to school",
			description:
				"For girls who walk more than 4 km to school. Working bicycles; we arrange servicing and locks.",
			quantity: [15, 40],
			unit: "bicycles",
			urgency: "MEDIUM",
		},
		{
			type: "OFFER",
			title: "Winter woollens for children",
			description:
				"Knitted sweaters and caps made by our women's group. Free for children's homes and anganwadis.",
			quantity: [100, 300],
			unit: "sets",
			urgency: "LOW",
		},
	],
	"animal-welfare": [
		{
			type: "WANT",
			title: "Old bedsheets and towels for the shelter",
			description:
				"Monsoon means wet dogs. We go through bedding faster than we can wash it. Anything absorbent, any condition.",
			quantity: [150, 400],
			unit: "pieces",
			urgency: "HIGH",
		},
		{
			type: "WANT",
			title: "Dry dog food",
			description:
				"Any brand of dry food for adult dogs. We feed about 120 dogs twice a day.",
			quantity: [200, 600],
			unit: "kg",
			urgency: "HIGH",
		},
		{
			type: "OFFER",
			title: "Puppies and kittens ready for adoption",
			description:
				"Vaccinated, dewormed and sterilised where old enough. We do a home check and stay in touch for the first year.",
			quantity: [6, 15],
			unit: "animals",
			urgency: "MEDIUM",
		},
		{
			type: "WANT",
			title: "Foster homes for recovering dogs",
			description:
				"Two to four weeks of foster care for dogs recovering from surgery. We cover food and medicines.",
			quantity: [5, 12],
			unit: "homes",
			urgency: "MEDIUM",
		},
	],
	"disaster-relief": [
		{
			type: "WANT",
			title: "Tarpaulin sheets for flood-hit homes",
			description:
				"Heavy-duty tarpaulins, at least 12 x 15 ft, for families whose roofs were damaged.",
			quantity: [200, 600],
			unit: "sheets",
			urgency: "HIGH",
		},
		{
			type: "WANT",
			title: "Blankets for the cold wave",
			description:
				"New or clean used blankets for people sleeping outdoors. Drop-off at our office until 9pm.",
			quantity: [500, 2000],
			unit: "blankets",
			urgency: "HIGH",
		},
		{
			type: "WANT",
			title: "Volunteers to pack relief kits",
			description:
				"Packing shifts every evening this week at our warehouse. Come for a shift or two.",
			quantity: [30, 80],
			unit: "volunteers",
			urgency: "MEDIUM",
		},
		{
			type: "OFFER",
			title: "Spare water purifiers for village schools",
			description:
				"Gravity-based water purifiers left over from our flood response, free for schools in affected blocks.",
			quantity: [20, 50],
			unit: "purifiers",
			urgency: "LOW",
		},
	],
	"food-nutrition": [
		{
			type: "WANT",
			title: "Rice for the community kitchen",
			description:
				"Our kitchen runs through 60 kg of rice a day and stocks are down to a week. Any quantity helps; drop-off between 8 and 11am.",
			quantity: [300, 800],
			unit: "kg",
			urgency: "HIGH",
		},
		{
			type: "WANT",
			title: "Steel tiffin boxes",
			description:
				"Reusable tiffins let us stop using foil packs. Used ones in good condition are perfect.",
			quantity: [150, 400],
			unit: "tiffins",
			urgency: "MEDIUM",
		},
		{
			type: "OFFER",
			title: "Cooked meals for shelters, 6pm daily",
			description:
				"We usually have 100 to 150 portions to spare. Shelters and hostels can collect from 6pm.",
			quantity: [100, 150],
			unit: "meals",
			urgency: "LOW",
		},
		{
			type: "WANT",
			title: "Toor dal and cooking oil",
			description:
				"For monthly ration kits for elders living alone. Sealed packs only.",
			quantity: [200, 500],
			unit: "kg",
			urgency: "MEDIUM",
		},
	],
	livelihood: [
		{
			type: "WANT",
			title: "Sewing machines for the training centre",
			description:
				"Foot-pedal or electric machines in working condition. Each one lets another woman start earning.",
			quantity: [10, 25],
			unit: "machines",
			urgency: "MEDIUM",
		},
		{
			type: "WANT",
			title: "Mock-interview volunteers",
			description:
				"Thirty minutes on a video call with a candidate about to sit their first interview.",
			quantity: [15, 30],
			unit: "volunteers",
			urgency: "MEDIUM",
		},
		{
			type: "OFFER",
			title: "Handmade cloth bags for events",
			description:
				"Our trainees make cloth bags; we can supply them free for community events and clean-ups.",
			quantity: [300, 800],
			unit: "bags",
			urgency: "LOW",
		},
		{
			type: "WANT",
			title: "Toolkits for electrician trainees",
			description:
				"Basic electrician toolkits for graduates starting work. New kits, please.",
			quantity: [20, 40],
			unit: "kits",
			urgency: "HIGH",
		},
	],
	"elderly-care": [
		{
			type: "WANT",
			title: "Companions for weekly home visits",
			description:
				"An hour a week with an elder who lives alone: a chat, a walk, help with a phone.",
			quantity: [15, 40],
			unit: "volunteers",
			urgency: "MEDIUM",
		},
		{
			type: "WANT",
			title: "Adult diapers",
			description: "Sizes M and L for bedridden elders in our care.",
			quantity: [300, 900],
			unit: "packs",
			urgency: "HIGH",
		},
		{
			type: "WANT",
			title: "Large-print books and radios",
			description:
				"For our day-care centre. Hindi and regional-language large-print books, and simple radios.",
			quantity: [40, 100],
			unit: "items",
			urgency: "LOW",
		},
	],
	"rural-development": [
		{
			type: "WANT",
			title: "Solar lanterns for village homes",
			description:
				"For households without a reliable connection. Children study by them in the evening.",
			quantity: [100, 300],
			unit: "lanterns",
			urgency: "MEDIUM",
		},
		{
			type: "WANT",
			title: "Native seed varieties for the seed bank",
			description:
				"Traditional millet and pulse varieties. Even a handful helps us multiply them.",
			quantity: [20, 60],
			unit: "kg",
			urgency: "LOW",
		},
		{
			type: "OFFER",
			title: "Training on drip irrigation",
			description:
				"Our field team can run a half-day drip irrigation training for any farmer group within 50 km.",
			quantity: [5, 10],
			unit: "sessions",
			urgency: "LOW",
		},
	],
};

// ─── Announcements, posts and conversation ──────────────────────────────────

export const ANNOUNCEMENTS: Record<Cause, { title: string; body: string }[]> = {
	education: [
		{
			title: "All our Class 10 students passed",
			body: "Results came out this morning: every one of our Class 10 students passed, a third of them with distinction. Three years ago most of these children were not enrolled anywhere. Thank you to every tutor who gave up a Saturday.",
		},
		{
			title: "Two new learning centres open this month",
			body: "We are opening two more centres, which takes us to 14. Each needs volunteer tutors for two evenings a week - sign up from the events tab.",
		},
		{
			title: "Our annual learning report is out",
			body: "Reading levels improved for 71% of children this year, maths for 64%. The full report, with the school-wise numbers, is on our profile.",
		},
	],
	healthcare: [
		{
			title: "10,000 screenings this year",
			body: "Our camps crossed 10,000 screenings this year. 1,140 people were referred for treatment and 860 of them are now on regular follow-up with our health workers.",
		},
		{
			title: "Clinic hours extended to six days a week",
			body: "Thanks to two new volunteer doctors, the clinic is now open Monday to Saturday, 9am to 4pm.",
		},
		{
			title: "Blood stocks are low this week",
			body: "Blood banks across the city are running low on O-negative and B-negative. If you can donate, please come to our camp this Sunday.",
		},
	],
	environment: [
		{
			title: "Water quality up two grades",
			body: "Eighteen months of clean-ups and the lake has gone from Class D to Class B on the pollution board scale. Birds are back. So are the fishermen.",
		},
		{
			title: "1 lakh saplings planted",
			body: "We crossed one lakh saplings this monsoon with an 82% survival rate. The planting map and survival data are on our website.",
		},
		{
			title: "Monsoon schedule for clean-ups",
			body: "Clean-ups move to 7am during the monsoon and are cancelled if there is a red alert. We will post here by 9pm the night before.",
		},
	],
	"women-child": [
		{
			title: "Our girls' team made the state finals",
			body: "Eleven girls who had never played football two years ago are in the state finals. They play on Saturday - come and cheer.",
		},
		{
			title: "Scholarships for 40 girls moving to Class 11",
			body: "Forty girls have scholarships for Class 11 this year, covering fees, books and a bicycle. Applications for next year open in March.",
		},
		{
			title: "New drop-in centre timings",
			body: "The drop-in centre now stays open until 7pm so that children can come after their families finish work.",
		},
	],
	"animal-welfare": [
		{
			title: "400 sterilisations this quarter",
			body: "Our biggest quarter yet, with the municipal corporation covering surgical costs for the first time. Volunteers handled every pickup and drop.",
		},
		{
			title: "Adoption weekend this Sunday",
			body: "Twelve dogs and six cats are looking for homes. Meet them this Sunday from 11am. Bring the whole family.",
		},
		{
			title: "Heatwave advisory: put out water bowls",
			body: "Temperatures will cross 42 degrees this week. Please keep a bowl of clean water outside your gate and change it twice a day.",
		},
	],
	"disaster-relief": [
		{
			title: "Flood response: what we have done so far",
			body: "In ten days we have delivered 3,200 ration kits, 900 tarpaulins and run 14 medical camps across the affected blocks. Rebuilding support starts next week.",
		},
		{
			title: "Cold-wave night patrols begin",
			body: "Night patrols start from tonight and run until mid-February. Call our helpline if you see someone sleeping outdoors without cover.",
		},
		{
			title: "Thank you, relief volunteers",
			body: "More than 600 people packed kits with us this month. We could not have reached the villages without you.",
		},
	],
	"food-nutrition": [
		{
			title: "1 million meals served",
			body: "This week our kitchen served its millionth meal. It took years, hundreds of regular volunteers and more rice than we can count. Thank you to everyone who has ever chopped an onion with us.",
		},
		{
			title: "Kitchen closed on Monday for maintenance",
			body: "The kitchen will be closed on Monday for gas-line maintenance. Ration distribution continues as usual.",
		},
		{
			title: "Festival langar: volunteers needed",
			body: "We expect about 3,000 people at the festival langar. Shifts are open in the events tab.",
		},
	],
	livelihood: [
		{
			title: "Batch graduates: 24 of 31 placed",
			body: "Our best placement rate so far. Average starting salary is Rs 14,500 a month, and six graduates are the first earning women in their families.",
		},
		{
			title: "Artisan cooperative crosses Rs 10 lakh in sales",
			body: "The cooperative crossed Rs 10 lakh in sales this year, all of it paid to the artisans who made the work.",
		},
		{
			title: "New course: two-wheeler repair",
			body: "Applications are open for our new two-wheeler repair course, built with three local service centres who will hire from it.",
		},
	],
	"elderly-care": [
		{
			title: "Physiotherapy clinic now six days a week",
			body: "Thanks to two new volunteer physiotherapists, the clinic is open Monday to Saturday. 340 elders came through last month.",
		},
		{
			title: "Diwali lunch at the day-care centre",
			body: "Join us for a Diwali lunch with our elders on Saturday. Music, rangoli and far too many sweets.",
		},
	],
	"rural-development": [
		{
			title: "12 johads restored before the monsoon",
			body: "Twelve village ponds were restored this summer with shramdaan from 1,400 villagers and volunteers. Groundwater readings will follow after the rains.",
		},
		{
			title: "Women's SHG market this Sunday",
			body: "Our self-help groups are selling pickles, millet snacks and handloom this Sunday. Every rupee goes to the women who made them.",
		},
	],
};

export const POSTS: Record<Cause, string[]> = {
	education: [
		"Saturday at the learning centre: 38 children, 6 volunteer tutors and one very competitive game of maths bingo.",
		"A Class 8 student read a full chapter aloud for the first time today. Her tutor has been with her every week since June.",
		"Our book-mobile visited four schools this week. The most borrowed book? A Hindi translation of a space encyclopedia.",
		"Thank you to the volunteers who came for the revision marathon - 140 students, 22 tutors, ten hours.",
	],
	healthcare: [
		"Sunday's camp: 312 people screened, 41 referred to the district hospital, 6 volunteer doctors and a lot of chai.",
		"Our health workers did 1,200 home visits this month. Here is what a day on the route looks like.",
		"A huge thank you to the 64 donors at this weekend's blood camp - 58 units collected.",
		"Monsoon means dengue. Our volunteers spent the week checking for standing water across the ward.",
	],
	environment: [
		"This morning's clean-up: 64 volunteers, 410 kg of plastic, one very surprised heron.",
		"The pocket forest we planted last July is already taller than most of our volunteers.",
		"Water testing results for October are in. Dissolved oxygen is up again at the north inlet.",
		"Seed balls drying in the sun before the dispersal drive. Thank you to the 3 schools that made them.",
	],
	"women-child": [
		"Practice in the rain today. Nobody wanted to stop.",
		"Our cycle library just lent out its 100th bicycle. Every one of them is a shorter walk to school.",
		"Art day at the drop-in centre - the walls are now considerably more colourful.",
		"Mentoring circle tonight: resumes, first salaries and how to say no at work.",
	],
	"animal-welfare": [
		"Meet Biscuit, rescued from a storm drain two weeks ago and now fully recovered. Ready for a home.",
		"Ambulance log for the week: 168 rescue calls, 121 animals treated, 9 surgeries.",
		"Walk-and-wash Sunday was a success. 40 dogs walked, 26 bathed, zero volunteers dry.",
		"Vaccination drive in the old city covered 230 dogs today. Thank you to our vets and volunteers.",
	],
	"disaster-relief": [
		"Kits packed tonight: 820. Volunteers: 74. Cups of tea: uncounted.",
		"Our boat clinic reached three char villages cut off by the water this week.",
		"Preparedness drill with the fishing village this morning. Evacuation time down from 22 to 14 minutes.",
		"First night of the cold-wave patrol: 96 blankets distributed and 11 people moved to shelters.",
	],
	"food-nutrition": [
		"Today's menu at the kitchen: rice, dal, aloo sabzi and a kheer we are a little too proud of.",
		"Surplus run last night: 640 meals collected from three weddings and delivered within 90 minutes.",
		"Ration kits for November are packed and ready - 600 elders, one kit each.",
		"The Sunday shift chopped 80 kg of onions. Nobody cried. Officially.",
	],
	livelihood: [
		"First day of the new tailoring batch. Thirty-one women, sixteen machines and a lot of laughter.",
		"Our artisans' stall at the weekend market sold out by 4pm.",
		"Mock interviews this morning with volunteers from three companies. Confidence: visibly up.",
		"Graduation day for the electrician course. Nineteen of twenty-two already have offers.",
	],
	"elderly-care": [
		"Carrom tournament at the day-care centre. The 81-year-old champion remains undefeated.",
		"Our home-visit buddies made 220 visits last month. Here is Asha-ji with her buddy of two years.",
		"Video-call afternoon: eleven elders spoke to grandchildren abroad, with a little help.",
	],
	"rural-development": [
		"The farm pond dug in May is full after one good rain.",
		"Self-help group meeting under the neem tree - savings this month crossed Rs 2 lakh across the 30 groups.",
		"Water survey day two: 140 wells mapped, 23 dry, 9 contaminated. The data goes to the gram sabha next week.",
	],
};

export const VOLUNTEER_POSTS = [
	"Spent my Sunday at a lake clean-up for the first time. Exhausting, muddy and the best morning I have had in months.",
	"Six months of weekly visits with my elder buddy today. She taught me a new card game; I taught her video calls.",
	"First time donating blood. It took 15 minutes and the volunteers were wonderful.",
	"Our office team packed 400 relief kits this evening. Highly recommend doing this with colleagues.",
	"Tutoring update: my Class 7 group finally cracked fractions. Proud of them.",
	"Volunteered at an adoption weekend and, of course, came home with a dog.",
	"If you have been meaning to start volunteering, start small. One afternoon a month is enough.",
	"Got my certificate for the eye camp today. 280 people screened - small part, big day.",
	"The kitchen shift starts at 6am, and by 9 you have helped feed hundreds of people. Worth the alarm.",
	"Planted 40 saplings with my kids this weekend. They want to go back and check on them every week.",
];

export const COMMENTS = [
	"This is wonderful. Count me in next time!",
	"So good to see this. Thank you to the whole team.",
	"Is there a weekday option? Weekends are hard for me.",
	"Shared this with my office group.",
	"Can I bring my teenage son along?",
	"Great work, keep going!",
	"How can I donate directly?",
	"I volunteered here last month - highly recommend.",
	"What time does it start?",
	"Lovely photos!",
	"Would love a session like this in our area too.",
	"Signed up. See you there.",
	"This made my day.",
	"Is parking available near the venue?",
	"Do you need help with photography?",
	"Proud to be a small part of this.",
];

export const REVIEWS: Record<number, string[]> = {
	5: [
		"Very well organised. Clear briefing, kind team and you can see the impact.",
		"I have volunteered with them for a year now. Transparent, warm and serious about the work.",
		"The coordinators made first-timers feel welcome. Would go again.",
		"They send updates after every drive about where the help went. Rare and appreciated.",
		"Wonderful people doing real work on the ground.",
	],
	4: [
		"Good experience overall. The day ran a little late but the team was great.",
		"Meaningful work and a friendly team. Communication before the event could be clearer.",
		"Well run. I wish there were more weekday slots.",
		"Enjoyed it. The briefing was short but enough.",
	],
	3: [
		"Good cause, but the event was disorganised and we waited an hour to start.",
		"Mixed experience. Too many volunteers for the work available that day.",
	],
	2: ["The venue changed at the last minute and nobody told us."],
	1: ["My application was accepted but nobody answered the phone on the day."],
};

export const REVIEW_REPLIES = [
	"Thank you so much - hope to see you again soon!",
	"Thank you for the kind words. It means a lot to the team.",
	"Thanks for the feedback. We are adding a weekday shift next month.",
	"Sorry about the delay that day - we have changed how we brief first-timers.",
	"Thank you for being part of it!",
	"We are sorry about this. We have set up an SMS update for venue changes.",
];

export const DONATION_MESSAGES = [
	"For the kitchen. Keep going!",
	"In memory of my grandmother.",
	"Happy birthday to my daughter - she asked for this instead of a gift.",
	"Small contribution from our office team.",
	"For the children's books.",
	"Thank you for what you do.",
	"For the winter drive.",
	"Monthly contribution.",
	"In honour of my parents' anniversary.",
	"For the animals.",
	"Diwali donation from our family.",
	"For the next relief kits.",
];

export const APPLICATION_MESSAGES = [
	"I have volunteered at similar events before and would love to help.",
	"Available the whole day. Happy to do whatever is needed.",
	"I can also help with photography if useful.",
	"First time volunteering - excited to learn.",
	"Coming with two friends who have also applied.",
	"I speak the local language and can help with registration.",
];

export const PLEDGE_MESSAGES = [
	"Can drop off on Saturday morning.",
	"Collected these from our housing society.",
	"Our office pooled together for this.",
	"Happy to deliver to your centre.",
	"Some are used but in good condition.",
	"Can you share the drop-off address?",
];

/** picsum.photos ids, grouped by theme. Unsplash-licensed photos. */
export const PHOTO_POOL: Record<Cause | "people", number[]> = {
	people: [64, 65, 129, 342, 513, 590, 596, 646, 699, 822, 838, 1001, 1012],
	education: [1, 2, 20, 24, 180, 370, 445, 528, 832, 885, 998, 1010, 1073],
	healthcare: [102, 225, 312, 674, 785, 835, 366, 1060],
	environment: [
		10, 11, 15, 17, 18, 28, 54, 128, 189, 217, 306, 400, 459, 471, 566, 568,
		666, 704, 919, 957, 1018,
	],
	"women-child": [64, 65, 646, 822, 838, 1010, 1066, 832, 839],
	"animal-welfare": [40, 169, 237, 200, 659, 837, 1003, 1025, 1062, 1012],
	"disaster-relief": [1028, 132, 149, 352, 1001, 699, 729],
	"food-nutrition": [63, 75, 292, 425, 429, 488, 493, 627, 635, 999, 1080],
	livelihood: [342, 513, 526, 534, 535, 1059, 670, 428],
	"elderly-care": [129, 768, 63, 674, 225, 1010],
	"rural-development": [85, 107, 112, 165, 206, 277, 337, 468, 729, 915, 955],
};

export const AVATAR_POOL = [
	64, 65, 177, 550, 646, 669, 823, 832, 836, 839, 996, 1005, 1011, 1027, 338,
	1001, 169, 237, 659, 837, 1025, 17, 28, 306, 459, 1018, 85, 63,
];

/** Portrait-ish photos used as the liveness selfie. */
export const SELFIE_POOL = [64, 65, 177, 550, 669, 823, 836, 996, 1005, 1027];
