import { Quote } from "lucide-react";
import Link from "next/link";
import { NewBadge, PLACEMENT_LABEL, ReturningBadge } from "@/components/data/badges";
import { Chip } from "@/components/ui/chip";
import { SourceLinks } from "@/components/data/source-link";
import type { BriefSponsor, SponsorMention } from "@/lib/data/types";
import { formatCompact, formatIST, formatTimestamp } from "@/lib/time";
import { Disclosure, RankRow } from "./rank-row";

export function SponsorMentionItem({ m, showEpisode = true }: { m: SponsorMention; showEpisode?: boolean }) {
  return (
    <div className="py-3">
      <blockquote className="flex gap-2 text-sm leading-5">
        <Quote size={14} aria-hidden className="mt-0.5 shrink-0 text-muted" />
        <p>{m.evidence}</p>
      </blockquote>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
        <Chip tone="neutral">{PLACEMENT_LABEL[m.placement]}</Chip>
        <Chip tone="outline">{m.source === "video" ? "Spoken in video" : "From description"}</Chip>
        {m.timestampSeconds !== null ? <span className="num">at {formatTimestamp(m.timestampSeconds)}</span> : null}
        {showEpisode ? (
          <>
            <span aria-hidden>·</span>
            <span>
              {m.episode.showName}, <span className="num">{formatIST(m.episode.publishedAt, "day")}</span>
            </span>
          </>
        ) : null}
      </div>
      <div className="mt-2">
        <SourceLinks youtubeUrl={m.episode.youtubeUrl} spotifyUrl={m.episode.spotifyUrl} at={m.source === "video" ? m.timestampSeconds : null} />
      </div>
    </div>
  );
}

export function SponsorRow({ s, hideStatus }: { s: BriefSponsor; hideStatus: boolean }) {
  const first = s.mentions[0];
  const rest = s.mentions.slice(1);
  const products = [...new Set(s.mentions.map((m) => m.product).filter(Boolean))];
  return (
    <RankRow
      title={<Link href={`/dashboard/sponsors/${s.id}`} className="hover:underline">{s.name}</Link>}
      subtitle={products.length ? products.join(", ") : undefined}
      right={hideStatus ? null : s.status === "new" ? <NewBadge /> : <ReturningBadge />}
      badges={
        <>
          <Chip tone="neutral">
            {s.showsCount} {s.showsCount === 1 ? "show" : "shows"}
          </Chip>
          {s.placements.map((p) => (
            <Chip key={p} tone="outline">
              {PLACEMENT_LABEL[p]}
            </Chip>
          ))}
          {s.totalViews > 0 ? <span className="num text-xs text-muted">{formatCompact(s.totalViews)} views across episodes</span> : null}
        </>
      }
    >
      {first ? <SponsorMentionItem m={first} /> : null}
      {rest.length ? (
        <Disclosure summary={`${rest.length} more ${rest.length === 1 ? "mention" : "mentions"}`}>
          <div className="divide-y divide-border/70">
            {rest.map((m) => (
              <SponsorMentionItem key={m.episode.episodeId + m.placement} m={m} />
            ))}
          </div>
        </Disclosure>
      ) : null}
    </RankRow>
  );
}
