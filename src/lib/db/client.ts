// Neon serverless driver over WebSockets so we get real transactions (needed for show swaps and
// the queue's SELECT ... FOR UPDATE SKIP LOCKED). One pool per server instance.
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { env } from "@/lib/env";
import * as schema from "./schema";

neonConfig.webSocketConstructor = ws;

type Db = ReturnType<typeof drizzle<typeof schema>>;
const g = globalThis as unknown as { __pgPool?: Pool; __db?: Db };

export function db(): Db {
  if (g.__db) return g.__db;
  const pool = new Pool({ connectionString: env().DATABASE_URL, max: 5 });
  g.__pgPool = pool;
  g.__db = drizzle(pool, { schema });
  return g.__db;
}

export async function closeDb() {
  await g.__pgPool?.end();
  g.__pgPool = undefined;
  g.__db = undefined;
}

export { schema };
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
