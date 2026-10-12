import Link from "next/link";
import { AiTag, HeatLabel, RisingBadge } from "@/components/data/badges";
import { CopyButton } from "@/components/data/copy-button";
import { EpisodeLine } from "@/components/data/episode-line";
import { LinkButton } from "@/components/ui/button";
import type { BriefTopic } from "@/lib/data/types";
import { Disclosure, RankRow } from "./rank-row";

export function episodeIdea(t: BriefTopic): string {
  return `Episode idea: ${t.label}.${t.counterAngle ? ` Angle: ${t.counterAngle}` : ""} Recently covered by ${t.shows.slice(0, 4).join(", ")}.`;
}

export function TopicRow({ t }: { t: BriefTopic }) {
  return (
    <RankRow
      rank={t.rank}
      title={<Link href={`/dashboard/topics/${t.id}`} className="hover:underline">{t.label}</Link>}
      right={<HeatLabel heat={t.heat} />}
      badges={t.rising ? <RisingBadge thisWeek={t.rising.thisWeek} prevAvg={t.rising.prevAvg} /> : null}
      because={
        <>
          <span className="num">{t.showsCount}</span> shows and <span className="num">{t.episodesCount}</span> episodes in the last 30 days.
          <span className="sr-only"> Shows: </span>{" "}
          <span className="hidden sm:inline">{t.shows.slice(0, 4).join(", ")}{t.shows.length > 4 ? ` and ${t.shows.length - 4} more` : ""}.</span>
        </>
      }
      actions={
        <>
          <CopyButton text={episodeIdea(t)} label="Copy as episode idea" />
          <LinkButton size="sm" variant="ghost" href={`/dashboard/topics/${t.id}`}>
            Details
          </LinkButton>
        </>
      }
    >
      {t.counterAngle ? (
        <div className="rounded-chip border-l-2 border-accent bg-surface-2 px-3 py-2.5">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Counter-programming angle</span>
            <AiTag />
          </div>
          <p className="text-sm leading-5">{t.counterAngle}</p>
        </div>
      ) : null}
      <Disclosure summary={`Episodes (${t.episodes.length})`} className="mt-2">
        <div className="divide-y divide-border/70">
          {t.episodes.map((ep) => (
            <EpisodeLine key={ep.episodeId} ep={ep} />
          ))}
        </div>
      </Disclosure>
    </RankRow>
  );
}
