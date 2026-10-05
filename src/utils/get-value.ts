import { Effect } from "effect";

import type { RedisConnection } from "../redis-client";

import { RedisError } from "../redis-client";

const MAX_COLLECTION_ITEMS = 100;
const MAX_STRING_CHARS = 10_000;
const SCAN_COUNT = 100;

function truncatedMessage(shown: number, total: number, unit: string): string {
  return `… showing first ${shown} of ${total} ${unit}`;
}

function parseStringValue(value: string | null): unknown {
  if (value === null)
    return null;

  try {
    return JSON.parse(value);
  }
  catch {
    return value;
  }
}

async function collectHash(client: RedisConnection, key: string): Promise<Record<string, string>> {
  const total = await client.hLen(key);
  const value: Record<string, string> = {};

  for await (const batch of client.hScanIterator(key, { COUNT: SCAN_COUNT })) {
    for (const item of batch) {
      value[item.field] = item.value;

      if (Object.keys(value).length >= MAX_COLLECTION_ITEMS) {
        value["…"] = truncatedMessage(MAX_COLLECTION_ITEMS, total, "fields");
        return value;
      }
    }
  }

  return value;
}

async function collectSet(client: RedisConnection, key: string): Promise<string[]> {
  const total = await client.sCard(key);
  const value: string[] = [];

  for await (const batch of client.sScanIterator(key, { COUNT: SCAN_COUNT })) {
    for (const item of batch) {
      value.push(item);

      if (value.length >= MAX_COLLECTION_ITEMS) {
        value.push(truncatedMessage(MAX_COLLECTION_ITEMS, total, "members"));
        return value;
      }
    }
  }

  return value;
}

async function collectZSet(client: RedisConnection, key: string): Promise<Array<{ score: number; value: string } | string>> {
  const total = await client.zCard(key);
  const value: Array<{ score: number; value: string } | string> = [];

  for await (const batch of client.zScanIterator(key, { COUNT: SCAN_COUNT })) {
    for (const item of batch) {
      value.push(item);

      if (value.length >= MAX_COLLECTION_ITEMS) {
        value.push(truncatedMessage(MAX_COLLECTION_ITEMS, total, "members"));
        return value;
      }
    }
  }

  return value;
}

export const getValue = Effect.fn("getValue")(function* (
  client: RedisConnection,
  key: string,
  type: string,
): Effect.fn.Return<unknown, RedisError> {
  switch (type) {
    case "string":
      return yield* Effect.tryPromise({
        async try() {
          const [length, value] = await Promise.all([
            client.strLen(key),
            client.getRange(key, 0, MAX_STRING_CHARS - 1),
          ]);
          const parsed = parseStringValue(value);

          if (typeof parsed === "string" && length > MAX_STRING_CHARS)
            return `${parsed}\n\n${truncatedMessage(MAX_STRING_CHARS, length, "characters")}`;

          return parsed;
        },
        catch: cause => new RedisError({ operation: "get string", cause }),
      });
    case "hash":
      return yield* Effect.tryPromise({
        try: () => collectHash(client, key),
        catch: cause => new RedisError({ operation: "get hash", cause }),
      });
    case "list":
      return yield* Effect.tryPromise({
        async try() {
          const length = await client.lLen(key);
          const value = await client.lRange(key, 0, MAX_COLLECTION_ITEMS - 1);

          if (length > MAX_COLLECTION_ITEMS)
            value.push(truncatedMessage(MAX_COLLECTION_ITEMS, length, "items"));

          return value;
        },
        catch: cause => new RedisError({ operation: "get list", cause }),
      });
    case "set":
      return yield* Effect.tryPromise({
        try: () => collectSet(client, key),
        catch: cause => new RedisError({ operation: "get set", cause }),
      });
    case "zset":
      return yield* Effect.tryPromise({
        try: () => collectZSet(client, key),
        catch: cause => new RedisError({ operation: "get zset", cause }),
      });
    case "stream":
      return yield* Effect.tryPromise({
        async try() {
          const [length, value] = await Promise.all([
            client.xLen(key),
            client.xRange(key, "-", "+", { COUNT: MAX_COLLECTION_ITEMS }),
          ]);

          if (length > MAX_COLLECTION_ITEMS)
            return { entries: value, note: truncatedMessage(MAX_COLLECTION_ITEMS, length, "entries") };

          return value;
        },
        catch: cause => new RedisError({ operation: "get stream", cause }),
      });
    case "ReJSON-RL":
    case "json":
      return yield* Effect.tryPromise({
        try: () => client.json.get(key),
        catch: cause => new RedisError({ operation: "get json", cause }),
      });
    case "TSDB-TYPE":
    case "timeseries":
      return yield* Effect.tryPromise({
        async try() {
          const [info, samples] = await Promise.all([
            client.ts.info(key),
            client.ts.range(key, "-", "+", { COUNT: MAX_COLLECTION_ITEMS }),
          ]);

          if (info.totalSamples > MAX_COLLECTION_ITEMS)
            return { samples, note: truncatedMessage(MAX_COLLECTION_ITEMS, info.totalSamples, "samples") };

          return samples;
        },
        catch: cause => new RedisError({ operation: "get timeseries", cause }),
      });
    case "vectorset":
      return yield* Effect.tryPromise({
        async try() {
          const [length, members] = await Promise.all([
            client.vCard(key),
            client.vRandMember(key, MAX_COLLECTION_ITEMS),
          ]);

          if (length > MAX_COLLECTION_ITEMS)
            return { members, note: truncatedMessage(MAX_COLLECTION_ITEMS, length, "members") };

          return members;
        },
        catch: cause => new RedisError({ operation: "get vector set", cause }),
      });
    default:
      return `Unsupported Redis type: ${type}`;
  }
});
