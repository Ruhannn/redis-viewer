import { Effect } from "effect";
import pc from "picocolors";

import type { RedisConnection, RedisError } from "../src/redis-client";

import { RedisError as RedisErrorCtor, withRedisClient } from "../src/redis-client";
import { isRedisUrl } from "../src/utils/is-redis-url";

const DEFAULT_REDIS_URL = "redis://localhost:6379";
const SEED_PREFIX = "kami:test";

const seedKeys = {
  hash: `${SEED_PREFIX}:user:1`,
  jsonString: `${SEED_PREFIX}:json`,
  list: `${SEED_PREFIX}:queue`,
  plainString: `${SEED_PREFIX}:message`,
  set: `${SEED_PREFIX}:tags`,
  zset: `${SEED_PREFIX}:scores`,
  stream: `${SEED_PREFIX}:events`,
} as const;

type SeededKey = {
  key: string;
  type: "hash" | "list" | "set" | "stream" | "string" | "zset";
};

const seededKeys: SeededKey[] = [
  { key: seedKeys.plainString, type: "string" },
  { key: seedKeys.jsonString, type: "string" },
  { key: seedKeys.hash, type: "hash" },
  { key: seedKeys.list, type: "list" },
  { key: seedKeys.set, type: "set" },
  { key: seedKeys.zset, type: "zset" },
  { key: seedKeys.stream, type: "stream" },
];

const seedRedis = Effect.fn("seedRedis")(function* (
  client: RedisConnection,
): Effect.fn.Return<SeededKey[], RedisError> {
  yield* Effect.tryPromise({
    async try() {
      await client.del(Object.values(seedKeys));

      await client.set(seedKeys.plainString, "Hello from kami-redis seed data");
      await client.set(seedKeys.jsonString, JSON.stringify({
        active: true,
        nested: {
          count: 3,
          source: "scripts/seed-redis.ts",
        },
        roles: ["admin", "tester"],
      }));
      await client.hSet(seedKeys.hash, {
        email: "ada@example.com",
        id: "1",
        name: "Ada Lovelace",
        plan: "pro",
      });
      await client.rPush(seedKeys.list, ["queued", "processing", "done"]);
      await client.expire(seedKeys.list, 15 * 60);
      await client.sAdd(seedKeys.set, ["redis", "cli", "effect"]);
      await client.zAdd(seedKeys.zset, [
        { score: 98, value: "ada" },
        { score: 87, value: "grace" },
        { score: 91, value: "linus" },
      ]);
      await client.xAdd(seedKeys.stream, "*", {
        action: "created",
        actor: "seed",
        entity: "user:1",
      });
      await client.xAdd(seedKeys.stream, "*", {
        action: "updated",
        actor: "seed",
        entity: "user:1",
      });
    },
    catch: cause => new RedisErrorCtor({ operation: "seed test data", cause }),
  });

  return seededKeys;
});

const redisUrl = process.argv[2] ?? process.env.REDIS_URL ?? DEFAULT_REDIS_URL;

const program = Effect.gen(function* () {
  if (!isRedisUrl(redisUrl)) {
    yield* Effect.sync(() => {
      console.error(pc.red(`Invalid Redis URL: ${redisUrl}`));
      process.exitCode = 1;
    });
    return;
  }

  const keys = yield* withRedisClient(redisUrl, seedRedis);

  yield* Effect.sync(() => {
    console.log(pc.green(`Seeded ${keys.length} keys into ${redisUrl}`));

    for (const item of keys) {
      console.log(`${pc.dim(item.type.padEnd(6))} ${item.key}`);
    }
  });
}).pipe(
  Effect.catch(error => Effect.sync(() => {
    console.error(pc.red("Seed failed:"), error);
    process.exitCode = 1;
  })),
);

Effect.runPromise(program).catch((error: unknown) => {
  console.error(pc.red("Seed failed:"), error);
  process.exitCode = 1;
});
