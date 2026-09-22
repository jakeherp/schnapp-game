import { Redis } from "@upstash/redis";

interface Kv {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
}

class UpstashKv implements Kv {
  private client: Redis;

  constructor() {
    this.client = Redis.fromEnv();
  }

  async get<T>(key: string): Promise<T | null> {
    return (await this.client.get<T>(key)) ?? null;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, { ex: ttlSeconds });
  }
}

// Dev-only fallback so `pnpm dev` works without an Upstash account. Only
// visible within a single Node process, so it won't work across separate
// serverless invocations (e.g. on Vercel) — set UPSTASH_REDIS_REST_URL/TOKEN
// for real cross-device play.
class InMemoryKv implements Kv {
  private store = new Map<string, { value: unknown; expiresAt: number }>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
}

const hasUpstashConfig =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

declare global {
  var __schnappKv: Kv | undefined;
}

export function getKv(): Kv {
  if (!global.__schnappKv) {
    if (!hasUpstashConfig) {
      console.warn(
        "[schnapp] UPSTASH_REDIS_REST_URL/TOKEN not set — using an in-memory store. " +
          "Fine for local testing in one process, but games won't sync across real devices or serverless instances."
      );
    }
    global.__schnappKv = hasUpstashConfig ? new UpstashKv() : new InMemoryKv();
  }
  return global.__schnappKv;
}
