"use client";

import { ArrowDown, ArrowRight, Hash, Megaphone, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface Chapter {
  key: "guests" | "topics" | "sponsors";
  title: string;
  count: number;
  question: string;
  teaser: string;
  href: string;
  /** The top few names in this section, with a short fact each. */
  top: { label: string; meta: string }[];
}

const ICONS = { guests: Users, topics: Hash, sponsors: Megaphone } as const;
const SCENE_NAMES = ["Live monitor", "Guest scan", "Topic map", "Sponsor signal"];
/** Extra scroll after the last chapter, so Sponsors holds before the brief scrolls in. */
const TAIL = 0.3;
const HEADER = 56; // sticky top bar height

/** Static cards: the three doors into the detail. Used under the brief, and on their own when motion is off. */
export function ChapterCards({ chapters }: { chapters: Chapter[] }) {
  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {chapters.map((c) => {
        const Icon = ICONS[c.key];
        return (
          <li key={c.key}>
            <Link href={c.href} className="group flex h-full flex-col rounded-panel border border-border bg-surface p-5 transition-colors hover:border-accent">
              <span className="flex h-10 w-10 items-center justify-center rounded-chip border border-border text-accent group-hover:border-accent">
                <Icon size={20} aria-hidden />
              </span>
              <span className="mt-4 flex items-baseline gap-2">
                <span className="text-xl font-bold">{c.title}</span>
                <span className="num text-sm text-muted">{c.count}</span>
              </span>
              <span className="mt-1 text-sm text-muted">{c.question}</span>
              <span className="mt-4 text-sm font-medium">{c.teaser}</span>
              <span className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-semibold text-accent">
                Open {c.title.toLowerCase()} <ArrowRight size={14} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Counts up to `value` whenever `on` becomes true. */
function Count({ value, on }: { value: number; on: boolean }) {
  const [n, setN] = useState(value);
  useEffect(() => {
    if (!on) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / 900, 1);
      setN(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on, value]);
  return <span className="num">{n}</span>;
}

/**
 * The scroll story, the first thing on the home page. A particle field is pinned full-screen while the page
 * scrolls through three chapters, and the particles morph: a studio microphone (we are listening) -> a person
 * (Guests) -> a topic network (Topics) -> a broadcast beacon (Sponsors). Then the weekly brief scrolls in.
 * Falls back to a plain intro when motion is reduced or WebGL is unavailable.
 */
export function HomeStory({ chapters, intro, briefId }: { chapters: Chapter[]; intro: React.ReactNode; briefId: string }) {
  const [mode, setMode] = useState<"story" | "plain">("story");
  const [active, setActive] = useState(0); // 0 = intro, 1..3 = chapters
  const [progress, setProgress] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const pin = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const target = useRef(0);

  // Decide once on the client whether the story can run.
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const gl = (() => {
      try {
        const c = document.createElement("canvas");
        return !!(c.getContext("webgl2") || c.getContext("webgl"));
      } catch {
        return false;
      }
    })();
    if (reduced || !gl) setMode("plain");
  }, []);

  const scrollRange = () => {
    const el = wrap.current!;
    return el.offsetHeight - (pin.current?.offsetHeight ?? window.innerHeight - HEADER);
  };

  // Map scroll to 0..3, holding still around each chapter so the shape settles before the next morph.
  const measure = useCallback(() => {
    const el = wrap.current;
    if (!el) return;
    const raw = Math.min(Math.max((HEADER - el.getBoundingClientRect().top) / Math.max(scrollRange(), 1), 0), 1) * (3 + TAIL);
    const r = Math.min(raw, 3);
    const i = Math.floor(r);
    const f = r - i;
    const t = f < 0.18 ? 0 : f > 0.82 ? 1 : (f - 0.18) / 0.64;
    const p = Math.min(i + t, 3);
    target.current = p;
    setProgress(raw / (3 + TAIL));
    const next = Math.round(p);
    setActive((a) => (a === next ? a : next));
  }, []);

  useEffect(() => {
    if (mode !== "story") return;
    measure();
    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        measure();
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [mode, measure]);

  // Start the WebGL scene (three.js loads only now).
  useEffect(() => {
    if (mode !== "story" || !canvas.current) return;
    let handle: { dispose(): void } | null = null;
    let cancelled = false;
    const count = window.innerWidth < 768 ? 38000 : 56000;
    import("./scene").then(async ({ mountScene }) => {
      if (cancelled || !canvas.current) return;
      const h = await mountScene(canvas.current, () => target.current, count).catch(() => null);
      if (cancelled) h?.dispose();
      else if (!h) setMode("plain");
      else handle = h;
    });
    return () => {
      cancelled = true;
      handle?.dispose();
    };
  }, [mode]);

  const goTo = (i: number) => {
    const el = wrap.current;
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - HEADER + (scrollRange() * i) / (3 + TAIL);
    window.scrollTo({ top: y + 1, behavior: "smooth" });
  };

  if (mode === "plain") {
    return <section className="hero-glow -mx-4 mb-10 px-4 pb-6 pt-2 md:-mx-6 md:px-6">{intro}</section>;
  }

  return (
    <div ref={wrap} style={{ height: "540vh" }} className="full-bleed relative -mt-6 md:-mt-8">
      <div ref={pin} className="sticky top-14 h-[calc(100svh-7.5rem)] overflow-hidden md:h-[calc(100svh-3.5rem)]">
        <div aria-hidden className="story-grid absolute inset-0 opacity-60" />
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(45%_55%_at_68%_48%,var(--glow),transparent_70%)] opacity-50" />
        <canvas ref={canvas} aria-hidden className="absolute inset-0 h-full w-full" />
        {/* soft scrim so the words stay readable over the particles */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg via-bg/50 to-transparent to-60% md:bg-gradient-to-r md:from-bg/90 md:via-bg/30 md:via-35% md:to-transparent md:to-55%" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-bg to-transparent" />

        <div className="relative mx-auto flex h-full max-w-[1200px] flex-col px-4 md:px-6">
          {/* chapter pills */}
          <nav aria-label="Jump to a chapter" className="flex justify-center gap-2 pt-4 md:justify-start md:pt-6">
            {chapters.map((c, i) => (
              <button
                key={c.key}
                type="button"
                onClick={() => goTo(i + 1)}
                aria-current={active === i + 1 ? "true" : undefined}
                className={cn(
                  "min-h-[34px] rounded-full border px-3.5 text-[13px] font-medium backdrop-blur transition-colors",
                  active === i + 1 ? "border-accent bg-accent text-accent-fg" : "border-border bg-surface/60 text-muted hover:text-fg",
                )}
              >
                <span className="num mr-1.5 opacity-70">0{i + 1}</span>
                {c.title}
              </button>
            ))}
          </nav>

          {/* chapter text */}
          <div className="pointer-events-none flex flex-1 items-end pb-16 md:items-center md:pb-0">
            <div className="relative h-[290px] w-full max-w-[460px] sm:h-[300px] md:h-[440px]">
              <div className={cn("absolute inset-0 flex flex-col justify-end transition-all duration-700 md:justify-center", active === 0 ? "pointer-events-auto translate-y-0 opacity-100" : "-translate-y-4 opacity-0")} aria-hidden={active !== 0}>
                {intro}
              </div>
              {chapters.map((c, i) => {
                const Icon = ICONS[c.key];
                const on = active === i + 1;
                return (
                  <div
                    key={c.key}
                    className={cn("absolute inset-0 flex flex-col justify-end transition-all duration-700 md:justify-center", on ? "pointer-events-auto translate-y-0 opacity-100" : "translate-y-4 opacity-0")}
                    aria-hidden={!on}
                  >
                    <p className="eyebrow flex items-center gap-2">
                      <Icon size={15} aria-hidden /> 0{i + 1} · {c.title}
                    </p>
                    <h2 className="mt-2 text-[34px] font-bold leading-[1.05] tracking-tight sm:text-[56px]">
                      <Count value={c.count} on={on} /> {c.title.toLowerCase()}
                    </h2>
                    <p className="mt-3 text-sm text-muted sm:text-[15px]">{c.question}</p>
                    {c.top.length ? (
                      <ol className="mt-5 hidden space-y-2 md:block">
                        {c.top.map((t, k) => (
                          <li
                            key={t.label}
                            className={cn("flex items-baseline gap-3 border-b border-border/70 pb-2 text-[15px] transition-all duration-700", on ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0")}
                            style={{ transitionDelay: on ? `${150 + k * 110}ms` : "0ms" }}
                          >
                            <span className="num w-5 shrink-0 text-xs text-accent">0{k + 1}</span>
                            <span className="min-w-0 flex-1 truncate font-medium">{t.label}</span>
                            <span className="num shrink-0 text-xs text-muted">{t.meta}</span>
                          </li>
                        ))}
                      </ol>
                    ) : null}
                    <p className="mt-3 text-base font-medium md:hidden">{c.teaser}</p>
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <Link href={c.href} tabIndex={on ? 0 : -1} className="inline-flex h-10 items-center gap-2 rounded-chip bg-accent px-4 text-sm font-semibold text-accent-fg hover:opacity-90">
                        Open {c.title.toLowerCase()} <ArrowRight size={16} aria-hidden />
                      </Link>
                      {i === chapters.length - 1 ? (
                        <a href={`#${briefId}`} tabIndex={on ? 0 : -1} className="inline-flex h-10 items-center gap-2 rounded-chip border border-border bg-surface/60 px-4 text-sm font-semibold backdrop-blur hover:border-accent">
                          Read the brief <ArrowDown size={16} aria-hidden />
                        </a>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* HUD footer: scene readout, scroll cue, skip link */}
          <div className="pointer-events-none absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted md:inset-x-6 md:bottom-6">
            <span className="hidden items-center gap-2 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
              {SCENE_NAMES[active]} · <span className="num">0{active}/03</span>
            </span>
            <span className={cn("flex items-center gap-1.5 transition-opacity duration-500", active === 0 ? "opacity-100" : "opacity-0")} aria-hidden>
              <ArrowDown size={13} className="scroll-cue" /> Scroll
            </span>
            <a href={`#${briefId}`} className="pointer-events-auto normal-case tracking-normal text-[12px] font-medium text-muted underline-offset-4 hover:text-fg hover:underline">
              Skip to the brief
            </a>
          </div>
        </div>
        <div aria-hidden className="absolute bottom-0 left-0 h-0.5 bg-accent" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}
