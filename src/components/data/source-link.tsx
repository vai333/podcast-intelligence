import { Headphones, Play } from "lucide-react";
import { cn } from "@/lib/utils";

const chip =
  "inline-flex min-h-[28px] items-center gap-1 rounded-chip border border-border px-2 text-xs font-medium text-muted hover:bg-surface-2 hover:text-fg";

/** Every guest, topic and sponsor links back to the source episode. */
export function SourceLink({
  platform,
  href,
  at,
  className,
}: {
  platform: "youtube" | "spotify";
  href: string;
  /** Seconds into the episode (YouTube only). */
  at?: number | null;
  className?: string;
}) {
  const url = platform === "youtube" && at ? `${href}&t=${at}s` : href;
  const name = platform === "youtube" ? "YouTube" : "Spotify";
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={cn(chip, className)}>
      {platform === "youtube" ? <Play size={12} aria-hidden /> : <Headphones size={12} aria-hidden />}
      {name}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export function SourceLinks({
  youtubeUrl,
  spotifyUrl,
  at,
}: {
  youtubeUrl: string | null;
  spotifyUrl: string | null;
  at?: number | null;
}) {
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {youtubeUrl ? <SourceLink platform="youtube" href={youtubeUrl} at={at} /> : null}
      {spotifyUrl ? <SourceLink platform="spotify" href={spotifyUrl} /> : null}
    </span>
  );
}
