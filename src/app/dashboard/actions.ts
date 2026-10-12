"use server";

// Server actions: thin wrappers over repo.mutations. They return plain { ok, message } results
// that the UI shows in a toast. Real validation/auth will live here when the backend arrives.
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guard";
import { repo } from "@/lib/data";
import { resetMock } from "@/lib/data/mock/repo";
import { type ActionResult, type MockScenario, type Settings, type ShowCandidate } from "@/lib/data/types";

const done = (res: ActionResult): ActionResult => {
  revalidatePath("/dashboard", "layout");
  return res;
};

export async function searchShowsAction(q: string): Promise<ShowCandidate[]> {
  await requireAdmin();
  return repo.searchShows(q.slice(0, 200));
}
export async function swapShowAction(outShowId: string, candidate: ShowCandidate) {
  await requireAdmin();
  return done(await repo.mutations.swapShow(outShowId, candidate));
}
export async function addShowAction(candidate: ShowCandidate) {
  await requireAdmin();
  return done(await repo.mutations.addShow(candidate));
}
export async function removeShowAction(showId: string) {
  await requireAdmin();
  return done(await repo.mutations.removeShow(showId));
}
export async function readdShowAction(showId: string) {
  await requireAdmin();
  return done(await repo.mutations.readdShow(showId));
}
export async function runWorkerAction() {
  await requireAdmin();
  return done(await repo.mutations.runWorkerNow());
}
export async function sendBriefAction(resend: boolean) {
  await requireAdmin();
  return done(await repo.mutations.sendBriefNow({ resend }));
}
export async function rerunExtractionAction(episodeId: string) {
  await requireAdmin();
  return done(await repo.mutations.rerunExtraction(episodeId));
}
export async function retryFailedAction() {
  await requireAdmin();
  return done(await repo.mutations.retryFailedJobs());
}
export async function saveSettingsAction(s: Settings) {
  await requireAdmin();
  return done(await repo.mutations.saveSettings(s));
}

/** Sample-data switcher (mock only). Removed when the real database is connected. */
export async function setScenarioAction(scenario: MockScenario | "reset") {
  if (process.env.DATA_SOURCE !== "mock") return;
  const jar = await cookies();
  if (scenario === "reset") {
    resetMock();
  } else {
    jar.set("mock_scenario", scenario, { path: "/", sameSite: "lax" });
  }
  revalidatePath("/dashboard", "layout");
}
