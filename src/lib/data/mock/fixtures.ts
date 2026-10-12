// Fictional people, companies and sponsors. Show names are the real seed list from the spec;
// every episode, guest, company and sponsor below is invented sample data.

export interface ShowSeed {
  id: string;
  name: string;
  description: string;
  handle: string;
  subscribers: number;
  hasYoutube: boolean;
  hasSpotify: boolean;
  cadence: number; // episodes per week
  baseViews: number;
  /** weeks-ago at which each interval starts/ends (end null = still active) */
  intervalsWeeksAgo: { from: number; to: number | null }[];
  health: "ok" | "quiet" | "error";
  healthNote: string | null;
}

export const SHOWS: ShowSeed[] = [
  {
    id: "show_neon",
    name: "The Neon Show",
    description: "Long-form conversations with Indian founders about what actually worked.",
    handle: "@theneonshow",
    subscribers: 412_000,
    hasYoutube: true,
    hasSpotify: true,
    cadence: 2,
    baseViews: 64_000,
    intervalsWeeksAgo: [{ from: 17, to: null }],
    health: "ok",
    healthNote: null,
  },
  {
    id: "show_firstprinciples",
    name: "First Principles by The Ken",
    description: "Reported interviews on the business of Indian technology.",
    handle: "@firstprinciples",
    subscribers: 188_000,
    hasYoutube: true,
    hasSpotify: true,
    cadence: 1,
    baseViews: 31_000,
    intervalsWeeksAgo: [{ from: 17, to: null }],
    health: "ok",
    healthNote: null,
  },
  {
    id: "show_isv",
    name: "Indian Silicon Valley",
    description: "Operators and investors on building product companies from India.",
    handle: "@indiansiliconvalley",
    subscribers: 126_000,
    hasYoutube: true,
    hasSpotify: true,
    cadence: 1.5,
    baseViews: 24_000,
    intervalsWeeksAgo: [{ from: 17, to: null }],
    health: "ok",
    healthNote: null,
  },
  {
    id: "show_seedtoscale",
    name: "SeedToScale",
    description: "Stage-by-stage lessons from seed to scale, told by the founders.",
    handle: "@seedtoscale",
    subscribers: 74_000,
    hasYoutube: true,
    hasSpotify: true,
    cadence: 1,
    baseViews: 14_000,
    intervalsWeeksAgo: [{ from: 17, to: null }],
    health: "error",
    healthNote: "YouTube channel not reachable since 9 Oct. Retrying nightly.",
  },
  {
    id: "show_barbershop",
    name: "The Barbershop with Shantanu",
    description: "Casual, honest conversations about money, careers and startups.",
    handle: "@thebarbershop",
    subscribers: 535_000,
    hasYoutube: true,
    hasSpotify: true,
    cadence: 1.5,
    baseViews: 88_000,
    intervalsWeeksAgo: [{ from: 17, to: null }],
    health: "ok",
    healthNote: null,
  },
  {
    id: "show_startupoperator",
    name: "Startup Operator",
    description: "Weekly audio show for startup operators. Spotify only.",
    handle: "",
    subscribers: 0,
    hasYoutube: false,
    hasSpotify: true,
    cadence: 1,
    baseViews: 0,
    intervalsWeeksAgo: [{ from: 17, to: 3 }], // swapped out 3 weeks ago
    health: "ok",
    healthNote: null,
  },
  {
    id: "show_founderthesis",
    name: "Founder Thesis",
    description: "Founders explain the thesis behind their company, in their own words.",
    handle: "@founderthesis",
    subscribers: 41_000,
    hasYoutube: true,
    hasSpotify: true,
    cadence: 1.5,
    baseViews: 9_000,
    intervalsWeeksAgo: [{ from: 3, to: null }], // swapped in 3 weeks ago
    health: "ok",
    healthNote: null,
  },
  {
    id: "show_indiandream",
    name: "The Indian Dream",
    description: "Stories of people building companies against the odds. Spotify only.",
    handle: "",
    subscribers: 0,
    hasYoutube: false,
    hasSpotify: true,
    cadence: 0.4,
    baseViews: 0,
    intervalsWeeksAgo: [{ from: 17, to: null }],
    health: "quiet",
    healthNote: "No new episode in 18 days. This may just be their schedule.",
  },
  {
    id: "show_zerotoinfinity",
    name: "Zero to Infinity",
    description: "Compounding growth stories from consumer and SaaS founders.",
    handle: "@zerotoinfinity",
    subscribers: 58_000,
    hasYoutube: true,
    hasSpotify: true,
    cadence: 1,
    baseViews: 12_000,
    // dropped for a while, then re-added: two intervals
    intervalsWeeksAgo: [
      { from: 17, to: 9 },
      { from: 5, to: null },
    ],
    health: "ok",
    healthNote: null,
  },
  {
    id: "show_desivc",
    name: "The Desi VC",
    description: "Venture capital from an Indian point of view: deals, theses, mistakes.",
    handle: "@thedesivc",
    subscribers: 97_000,
    hasYoutube: true,
    hasSpotify: true,
    cadence: 1,
    baseViews: 19_000,
    intervalsWeeksAgo: [{ from: 17, to: null }],
    health: "ok",
    healthNote: null,
  },
];

export interface GuestSeed {
  key: string;
  name: string;
  company: string | null;
  fame: number; // multiplier on views
  aliases?: string[];
}

export const GUESTS: GuestSeed[] = [
  { key: "priya", name: "Priya Raghavan", company: "Founder, Kiraya Labs", fame: 1.6, aliases: ["P. Raghavan"] },
  {
    key: "arjun",
    name: "Arjun Venkatachalam Mehta-Kulkarni",
    company: "CEO, Tarang AI",
    fame: 6,
    aliases: ["Arjun Mehta"],
  },
  { key: "sana", name: "Sana Qureshi", company: "Co-founder, Loomwala", fame: 1.3 },
  { key: "rohan", name: "Rohan Deshpande", company: "Founder, Greenhaat", fame: 1.1 },
  { key: "meera", name: "Meera Iyer", company: "CEO, Vyom Health", fame: 1.4 },
  { key: "kabir", name: "Kabir Sethi", company: "Co-founder, Dhanvi Pay", fame: 1.5 },
  { key: "ishita", name: "Ishita Bansal", company: "Founder, Bolt & Brew", fame: 1.2 },
  { key: "nikhil", name: "Nikhil Joshi", company: "General Partner, Lakeview Partners", fame: 1.0 },
  { key: "ananya", name: "Ananya Das", company: "Founder, Pixelsutra", fame: 0.9 },
  { key: "vikram", name: "Vikram Rathore", company: "CEO, Ridefold", fame: 1.8 },
  { key: "tanvi", name: "Tanvi Shah", company: "Partner, Seedwell Capital", fame: 1.0 },
  { key: "harsh", name: "Harsh Agarwal", company: "Founder, Nirmaan Works", fame: 0.8 },
  { key: "divya", name: "Divya Pillai", company: "Co-founder, Kaagaz Cloud", fame: 1.1 },
  { key: "aman", name: "Aman Chopra", company: "Founder, Chaiwala Labs", fame: 0.9 },
  { key: "neha", name: "Neha Kapoor", company: "CEO, Swaad Foods", fame: 1.2 },
  { key: "siddharth", name: "Siddharth Rao", company: "Founder, Dukaan Stack", fame: 0.8 },
  { key: "zoya", name: "Zoya Khan", company: "Co-founder, Fitmandi", fame: 1.0 },
  { key: "pranav", name: "Pranav Nair", company: "CTO, Tarang AI", fame: 0.9 },
  { key: "kavya", name: "Kavya Menon", company: "Founder, Sutra Skincare", fame: 1.1 },
  { key: "rahul", name: "Rahul Bhatt", company: "Founder, Gaadi Gate", fame: 0.9 },
  { key: "devika", name: "Devika Rao", company: null, fame: 0.8 },
  { key: "yash", name: "Yash Malhotra", company: null, fame: 0.8 },
  { key: "isha", name: "Isha Verma", company: "Founder, Mandi Mitra", fame: 0.9 },
  { key: "karthik", name: "Karthik Subramanian", company: "Founder, Dhaaga", fame: 1.0 },
  { key: "mehul", name: "Mehul Doshi", company: "Partner, Anchor Ventures", fame: 0.9 },
  { key: "ritu", name: "Ritu Saxena", company: "CEO, Bimaly", fame: 1.0 },
  { key: "gaurav", name: "Gaurav Tandon", company: "Co-founder, Sathi Credit", fame: 0.9 },
  { key: "pooja", name: "Pooja Hegde-Nair", company: "Founder, Kaapi Club", fame: 0.8 },
];

const FIRST = [
  "Aarav", "Aditi", "Akash", "Alisha", "Amit", "Anjali", "Arnav", "Bhavna", "Chirag", "Deepak", "Dhruv", "Esha",
  "Farhan", "Gita", "Hemant", "Indira", "Jatin", "Kiran", "Lakshmi", "Manav", "Nandini", "Omkar", "Parth", "Quasar",
  "Radhika", "Sameer", "Tara", "Uday", "Vaani", "Wasim", "Yamini", "Zubin", "Abhay", "Bela", "Charu", "Dev",
  "Ekta", "Faiz", "Gauri", "Hari", "Ira", "Jaya", "Kunal", "Lavanya", "Mohit", "Naina", "Onkar", "Pallavi",
];
const LAST = [
  "Bhatia", "Chandra", "Dutta", "Fernandes", "Ghosh", "Hussain", "Iyengar", "Jain", "Khanna", "Lal", "Mishra",
  "Naik", "Oberoi", "Patel", "Rastogi", "Sinha", "Thakur", "Upadhyay", "Varma", "Wadhwa", "Yadav", "Zaveri",
];
const COMPANY_A = ["Aaram", "Bandhan", "Chhaya", "Dhun", "Ekam", "Farmaan", "Gulab", "Harit", "Ishaan", "Jugaad", "Kisan", "Lakshya"];
const COMPANY_B = ["Labs", "Works", "Stack", "Foods", "Health", "Pay", "Cloud", "Mobility", "Studio", "Robotics"];

/** ~100 extra one-off guests so random episodes rarely repeat a guest (media rounds stay meaningful). */
export const EXTRA_GUESTS: GuestSeed[] = Array.from({ length: 100 }, (_, i) => {
  const first = FIRST[i % FIRST.length];
  const last = LAST[(i * 7 + 3) % LAST.length];
  const hasCompany = i % 7 !== 0;
  return {
    key: `x${i}`,
    name: `${first} ${last}`,
    company: hasCompany
      ? `${i % 5 === 0 ? "CEO" : i % 3 === 0 ? "Co-founder" : "Founder"}, ${COMPANY_A[(i * 5) % COMPANY_A.length]} ${COMPANY_B[(i * 3) % COMPANY_B.length]}`
      : null,
    fame: 0.7 + ((i * 37) % 10) / 10,
  };
});

export const TOPICS: string[] = [
  "d2c brand scaling",
  "seed fundraising",
  "ai in customer support",
  "quick commerce",
  "founder mental health",
  "hiring first ten",
  "bootstrapping vs vc",
  "b2b saas pricing",
  "creator economy",
  "fintech compliance",
  "climate hardware",
  "tier-2 consumer markets",
  "founder-led sales",
  "ai agents for smb",
];

export const COUNTER_ANGLES: Record<string, string> = {
  "d2c brand scaling":
    "Everyone is celebrating scale. Run the unit-economics reality check: what a rupee of ad spend actually returns by month six.",
  "seed fundraising":
    "Skip the how-to-pitch genre. Interview someone who raised late and slowly, and why that turned out better.",
  "ai in customer support":
    "Guests are all bullish. Book a support lead who rolled AI out and then rolled part of it back.",
  "quick commerce":
    "The coverage is about speed. Cover what dark-store economics do to the brands that sell through them.",
  "founder mental health":
    "Most episodes stay personal. Make one practical: how a co-founder pair structures time off.",
  "hiring first ten":
    "Everyone says hire slowly. Ask a founder who hired fast and was right.",
  "bootstrapping vs vc":
    "The debate keeps repeating. Show the numbers from a company that switched sides mid-way.",
  "b2b saas pricing":
    "Pricing talk is theory-heavy. Do a live teardown of a real pricing page with its founder.",
  "creator economy":
    "Hosts cover creators as a channel. Cover creators as founders with real P&Ls.",
  "fintech compliance":
    "A topic few shows treat well. Own it with a plain-language regulator-meets-founder episode.",
  "climate hardware":
    "Capital-heavy and under-covered. Lead with the first-factory story, not the vision.",
  "tier-2 consumer markets":
    "Stories stay in metros. Go to a tier-2 city and interview the first ten customers.",
  "founder-led sales":
    "Everyone says do it. Show the exact week-by-week handoff from founder to first sales hire.",
  "ai agents for smb":
    "The hype is loud. Interview a small-business owner who actually uses one daily.",
};

export interface SponsorSeed {
  key: string;
  name: string;
  products: string[];
  pitch: string; // fragment used in the verbatim evidence quote
  aliases?: string[];
  onlyLatestWeek?: boolean;
  weight: number;
}

export const SPONSORS: SponsorSeed[] = [
  { key: "razorline", name: "Razorline", products: ["Razorline Payments"], pitch: "accept payments in minutes", weight: 6 },
  { key: "flowdesk", name: "FlowDesk", products: ["FlowDesk CRM"], pitch: "keep every deal in one place", weight: 5, aliases: ["Flow Desk"] },
  { key: "cloudnest", name: "CloudNest", products: ["CloudNest Hosting"], pitch: "ship without worrying about servers", weight: 4 },
  { key: "hireloop", name: "HireLoop", products: ["HireLoop Recruiter"], pitch: "hire your first ten faster", weight: 4 },
  { key: "zenpay", name: "Zenpay", products: ["Zenpay Payroll"], pitch: "run payroll in one click", weight: 3 },
  { key: "brewmate", name: "Brewmate", products: ["Brewmate Cold Brew"], pitch: "keep your team awake at standup", weight: 2 },
  { key: "notionary", name: "Notionary", products: ["Notionary Docs"], pitch: "write down how your company works", weight: 3 },
  { key: "vaulted", name: "Vaulted", products: ["Vaulted Cover"], pitch: "protect your startup from day one", weight: 2 },
  { key: "grofin", name: "Grofin", products: ["Grofin Treasury"], pitch: "earn more on idle company cash", weight: 6, onlyLatestWeek: true },
  { key: "stackpilot", name: "StackPilot", products: ["StackPilot Analytics"], pitch: "see what your users really do", weight: 5, onlyLatestWeek: true },
];

export const TITLE_TEMPLATES: ((g: string, t: string, c: string | null) => string)[] = [
  (g, t) => `${g} on ${t}: what nobody tells you`,
  (g, t, c) => `How ${c ?? "this company"} approached ${t}`,
  (g, t) => `${t[0].toUpperCase()}${t.slice(1)} with ${g}`,
  (g, t) => `${g}: lessons on ${t}`,
  (g, t, c) => `From zero to ${c ? c.split(", ").pop() : "scale"}: ${t} in practice`,
  (g, t) => `The real story behind ${t} (feat. ${g})`,
];

/** Queued and failed notes used for the ugly cases. */
export const FAILURE_NOTES = [
  "Gemini returned invalid JSON twice. Moved on.",
  "Video is private or region-blocked; metadata fallback also failed.",
];
export const SKIP_NOTES = [
  "Longer than 120 min (limit from Settings).",
  "Shorter than 15 min, looks like a Short or clip.",
];
