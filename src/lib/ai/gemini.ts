// Gemini client: JSON output validated by zod, bounded retries, and typed errors for the cases the
// queue must handle differently (rate limit = wait and retry, unavailable video = fall back to metadata).
import { GoogleGenAI, MediaResolution, type Part } from "@google/genai";
import type { ZodType } from "zod";
import { env } from "@/lib/env";
import { addUsage, istDay } from "@/lib/usage";

export class RateLimitedError extends Error {
  constructor(
    message: string,
    public readonly retryAfterSec: number,
    public readonly daily: boolean,
  ) {
    super(message);
    this.name = "RateLimitedError";
  }
}

/** The video cannot be processed (private, age-restricted, region-blocked, too long). Fall back to metadata. */
export class VideoUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VideoUnavailableError";
  }
}

export class GeminiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

let client: GoogleGenAI | null = null;
const ai = () => (client ??= new GoogleGenAI({ apiKey: env().GEMINI_API_KEY }));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface Usage {
  input: number;
  output: number;
  total: number;
}

export interface JsonResult<T> {
  data: T;
  usage: Usage;
  model: string;
}

/** Parses "Please retry in 55.5s" / "retry in 18h44m4.6s" (or a RetryInfo "55s") out of a 429 body, in seconds. */
export function parseRetryAfter(message: string): number {
  const m = /retry in (?:(\d+)h)?(?:(\d+)m)?([\d.]+)s/i.exec(message);
  if (m) return Math.ceil((Number(m[1] ?? 0) * 3600) + (Number(m[2] ?? 0) * 60) + Number(m[3])) + 2;
  const r = /"retryDelay"\s*:\s*"([\d.]+)s"/.exec(message);
  return r ? Math.ceil(Number(r[1])) + 2 : 60;
}

const isVideoProblem = (msg: string) => /video|youtube|private|unavailable|not accessible|too long|duration|region|age/i.test(msg);

function classify(e: unknown, hadVideo: boolean): never | { transient: true } {
  const status = (e as { status?: number })?.status ?? 0;
  const message = e instanceof Error ? e.message : String(e);
  if (status === 429) {
    const retry = parseRetryAfter(message);
    throw new RateLimitedError(message.slice(0, 300), retry, retry > 1800 || /PerDay|per_day|daily/i.test(message));
  }
  if (hadVideo && (status === 400 || status === 403 || status === 404) && isVideoProblem(message)) {
    throw new VideoUnavailableError(message.slice(0, 300));
  }
  if (status === 0 || status >= 500) return { transient: true };
  throw new GeminiError(message.slice(0, 400), status);
}

/** Internal: a model kept answering 5xx. The caller moves on to the next model in the chain. */
class TransientError extends Error {}

const modelChain = (): string[] => [env().GEMINI_MODEL, ...env().GEMINI_FALLBACK_MODELS.split(",").map((m) => m.trim()).filter(Boolean)];

interface JsonOpts<T> {
  parts: Part[];
  responseSchema: Record<string, unknown>;
  schema: ZodType<T>;
  video?: boolean;
  model?: string;
}

/**
 * Generates JSON with the primary model and, if it is rate limited or overloaded, the fallback models in order.
 * Throws RateLimitedError only when EVERY model is rate limited (with the soonest retry time).
 */
export async function generateJson<T>(opts: JsonOpts<T>): Promise<JsonResult<T>> {
  const chain = opts.model ? [opts.model] : modelChain();
  let rate: RateLimitedError | null = null;
  let last: unknown;
  for (const model of chain) {
    try {
      return await runModel(model, opts);
    } catch (e) {
      if (e instanceof RateLimitedError) {
        if (!rate || e.retryAfterSec < rate.retryAfterSec) rate = e;
        continue;
      }
      if (e instanceof TransientError) {
        last = e;
        continue;
      }
      throw e;
    }
  }
  if (rate) throw rate;
  throw new GeminiError(`Gemini unavailable: ${last instanceof Error ? last.message.slice(0, 200) : "unknown"}`, 503);
}

async function runModel<T>(model: string, opts: JsonOpts<T>): Promise<JsonResult<T>> {
  let parts = opts.parts;
  let lastValidation = "";

  for (let validationTry = 0; validationTry < 2; validationTry++) {
    let res: Awaited<ReturnType<GoogleGenAI["models"]["generateContent"]>> | null = null;
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3 && !res; attempt++) {
      try {
        res = await ai().models.generateContent({
          model,
          contents: [{ role: "user", parts }],
          config: {
            responseMimeType: "application/json",
            responseSchema: opts.responseSchema,
            temperature: 0.2,
            ...(opts.video ? { mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW } : {}),
          },
        });
      } catch (e) {
        lastErr = e;
        classify(e, !!opts.video); // throws for rate limits, unavailable video and other non-transient errors
        await sleep(2000 * 2 ** attempt + Math.random() * 500);
      }
    }
    if (!res) throw new TransientError(`${model} unavailable after retries: ${lastErr instanceof Error ? lastErr.message.slice(0, 160) : "unknown"}`);

    const u = res.usageMetadata;
    const usage: Usage = { input: u?.promptTokenCount ?? 0, output: (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0), total: u?.totalTokenCount ?? 0 };
    await addUsage(istDay(), "gemini_tokens", usage.total).catch(() => {});

    try {
      const parsed = opts.schema.safeParse(JSON.parse(res.text ?? ""));
      if (parsed.success) return { data: parsed.data, usage, model };
      lastValidation = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    } catch (e) {
      lastValidation = `not valid JSON (${e instanceof Error ? e.message : "parse error"})`;
    }
    // Retry once with the validation error appended.
    parts = [...opts.parts, { text: `Your previous answer failed validation: ${lastValidation}. Return corrected JSON only.` }];
  }
  throw new GeminiError(`Gemini output failed validation twice: ${lastValidation}`, 422);
}

/** Frame sampling for podcast video: the value is in the audio, so sample 1 frame every 4 seconds. */
export const VIDEO_FPS = 0.25;

export function videoPart(url: string): Part {
  return { fileData: { fileUri: url }, videoMetadata: { fps: VIDEO_FPS } };
}
