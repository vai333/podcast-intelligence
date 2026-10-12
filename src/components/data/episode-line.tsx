import type { EpisodeRef } from "@/lib/data/types";
import { formatCompact, formatIST } from "@/lib/time";
import { MetadataOnlyBadge } from "./badges";
import { ShowAvatar } from "./show-avatar";
import { SourceLinks } from "./source-link";

/** One episode as a compact line: show, title, date, views, and links back to the source. */
export function EpisodeLine({ ep, showAvatar = true }: { ep: EpisodeRef; showAvatar?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-2">
      {showAvatar ? <ShowAvatar name={ep.showName} size={32} className="mt-0.5" /> : null}
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-medium leading-5">{ep.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span>{ep.showName}</span>
          <span aria-hidden>·</span>
          <span className="num">{formatIST(ep.publishedAt, "day")}</span>
          {ep.views !== null ? (
            <>
              <span aria-hidden>·</span>
              <span className="num">{formatCompact(ep.views)} views</span>
            </>
          ) : null}
          {ep.depth === "metadata" ? <MetadataOnlyBadge /> : null}
        </p>
        <div className="mt-1.5">
          <SourceLinks youtubeUrl={ep.youtubeUrl} spotifyUrl={ep.spotifyUrl} />
        </div>
      </div>
    </div>
  );
}
