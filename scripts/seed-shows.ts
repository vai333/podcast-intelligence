// The 10 default shows from the spec. IDs are resolved through the search code, never hard-coded.
// `query` is an optional search hint and `match` the channel name to look for in the results,
// for shows whose name is too generic (or which live inside a larger channel).
export const SEED_SHOWS: { name: string; query?: string; match?: string }[] = [
  { name: "The Neon Show" },
  { name: "First Principles by The Ken", query: "The Ken", match: "The Ken" },
  { name: "Indian Silicon Valley" },
  { name: "SeedToScale" },
  { name: "The Barbershop with Shantanu" },
  { name: "Startup Operator" },
  { name: "Founder Thesis" },
  { name: "The Indian Dream" },
  { name: "Zero to Infinity", query: "Zero to Infinity podcast startup founders India" },
  { name: "The Desi VC" },
];
