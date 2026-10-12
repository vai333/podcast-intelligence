// Shared HTTP helper: timeout, bounded retries with backoff for 429/5xx, and a typed error.
export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string,
    public readonly service: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export interface FetchOpts {
  service: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  retries?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Redacts anything that looks like a key from a URL before it is logged or thrown. */
export function redact(s: string): string {
  return s.replace(/([?&](?:key|api_key|token)=)[^&\s]+/gi, "$1REDACTED");
}

export async function fetchJson(url: string, o: FetchOpts): Promise<unknown> {
  const retries = o.retries ?? 2;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), o.timeoutMs ?? 15_000);
    try {
      const res = await fetch(url, { method: o.method ?? "GET", headers: o.headers, body: o.body, signal: ctrl.signal, cache: "no-store" });
      const text = await res.text();
      if (res.ok) return text ? JSON.parse(text) : {};
      const err = new HttpError(`${o.service} ${res.status} for ${redact(url)}`, res.status, text.slice(0, 500), o.service);
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        lastErr = err;
        await sleep(500 * 2 ** attempt + Math.random() * 250);
        continue;
      }
      throw err;
    } catch (e) {
      if (e instanceof HttpError) throw e;
      lastErr = e;
      if (attempt < retries) {
        await sleep(500 * 2 ** attempt);
        continue;
      }
      const msg = e instanceof Error && e.name === "AbortError" ? "timed out" : e instanceof Error ? e.message : String(e);
      throw new HttpError(`${o.service} request failed: ${msg}`, 0, "", o.service);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`${o.service} request failed`);
}
