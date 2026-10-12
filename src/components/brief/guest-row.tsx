import { ExternalLink, HelpCircle } from "lucide-react";
import Link from "next/link";
import { CopyButton } from "@/components/data/copy-button";
import { EpisodeLine } from "@/components/data/episode-line";
import { HeatLabel, MediaRoundBadge, TopViewsBadge } from "@/components/data/badges";
import { ScoreBar } from "@/components/data/score-bar";
import { Button, LinkButton } from "@/components/ui/button";
import { Pop } from "@/components/ui/tooltip";
import type { BriefGuest } from "@/lib/data/types";
import { formatCompact } from "@/lib/time";
import { Disclosure, RankRow } from "./rank-row";

export function bookingNote(g: BriefGuest): string {
  const first = g.name.split(" ")[0];
  const a = g.appearances[0];
  return `Hi ${first}, I host a podcast for Indian founders and noticed your recent conversation on ${a?.showName ?? "a few shows"}${a ? ` ("${a.title}")` : ""}. I'd love to have you on. Would you be open to a chat sometime in the next few weeks?`;
}

export function GuestRow({ g }: { g: BriefGuest }) {
  const shown = g.appearances.slice(0, 2);
  const rest = g.appearances.slice(2);
  const linkedIn = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${g.name} ${g.company ?? ""}`.trim())}`;

  return (
    <RankRow
      rank={g.rank}
      title={<Link href={`/dashboard/guests/${g.id}`} className="hover:underline">{g.name}</Link>}
      subtitle={g.company}
      right={<HeatLabel heat={g.heat} />}
      badges={
        <>
          {g.mediaRound ? <MediaRoundBadge shows={g.showsCount} days={g.spanDays} /> : null}
          {g.viewsPercentile >= 90 ? <TopViewsBadge percentile={g.viewsPercentile} /> : null}
          {g.topViews !== null ? <span className="num text-xs text-muted">Best episode: {formatCompact(g.topViews)} views</span> : null}
        </>
      }
      because={
        g.mediaRound
          ? `On ${g.showsCount} different shows in the last 30 days, so they are likely open to bookings right now.`
          : "One show, but a standout episode by views this month."
      }
      actions={
        <>
          <CopyButton text={bookingNote(g)} label="Copy booking note" />
          <LinkButton size="sm" variant="secondary" href={linkedIn} external>
            <ExternalLink size={14} aria-hidden /> Find on LinkedIn
          </LinkButton>
          <LinkButton size="sm" variant="ghost" href={`/dashboard/guests/${g.id}`}>
            Details
          </LinkButton>
          <Pop
            label="Why ranked here"
            trigger={
              <Button size="sm" variant="ghost">
                <HelpCircle size={14} aria-hidden /> Why ranked here
              </Button>
            }
          >
            <p className="mb-3 font-semibold">Why {g.name.split(" ")[0]} is ranked #{g.rank}</p>
            <div className="space-y-2.5">
              <ScoreBar label="Shows (60%)" value={g.components.shows} />
              <ScoreBar label="Views (40%)" value={g.components.views} />
            </div>
            <p className="mt-3 text-xs text-muted">
              {g.showsCount} {g.showsCount === 1 ? "show" : "shows"} in 30 days
              {g.viewsPercentile ? `, best episode beats ${g.viewsPercentile}% of episodes` : ""}. Views come from YouTube only.
            </p>
          </Pop>
        </>
      }
    >
      <div className="divide-y divide-border/70">
        {shown.map((ep) => (
          <EpisodeLine key={ep.episodeId} ep={ep} />
        ))}
      </div>
      {rest.length ? (
        <Disclosure summary={`${rest.length} more ${rest.length === 1 ? "appearance" : "appearances"}`} className="mt-1">
          <div className="divide-y divide-border/70">
            {rest.map((ep) => (
              <EpisodeLine key={ep.episodeId} ep={ep} />
            ))}
          </div>
        </Disclosure>
      ) : null}
    </RankRow>
  );
}
