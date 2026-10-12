// Pages import `repo` from here. DATA_SOURCE=mock serves the built-in sample data (no database needed);
// anything else uses Neon. Nothing else in the app changes between the two.
import { dbRepo } from "./db/repo";
import { mockRepo } from "./mock/repo";
import type { Repo } from "./repo";

export const repo: Repo = process.env.DATA_SOURCE === "mock" ? mockRepo : dbRepo;
export type { Repo } from "./repo";
export * from "./types";
