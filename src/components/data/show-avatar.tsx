import Image from "next/image";
import { cn } from "@/lib/utils";

function hue(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

const initials = (name: string) =>
  name
    .replace(/^the\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

/** Show artwork with a tinted initials fallback (artwork can be missing). */
export function ShowAvatar({ name, src, size = 40, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  if (src) {
    return <Image src={src} alt="" width={size} height={size} className={cn("shrink-0 rounded-chip object-cover", className)} />;
  }
  return (
    <span
      aria-hidden
      className={cn("avatar flex shrink-0 items-center justify-center rounded-chip font-semibold", className)}
      style={{ width: size, height: size, fontSize: size * 0.38, ["--h" as string]: hue(name) }}
    >
      {initials(name)}
    </span>
  );
}
