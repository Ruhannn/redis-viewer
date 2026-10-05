import type { RedisClientType, TypeMapping } from "redis";

import { Effect, Schema } from "effect";
import { createClient } from "redis";

export type RedisConnection = RedisClientType;

type NoRedisModules = Record<string, never>;
type NoRedisFunctions = Record<string, never>;
type NoRedisScripts = Record<string, never>;
type NoTypeMapping = Partial<Record<keyof TypeMapping, never>>;
type RedisProtocolVersion = 2;

export class RedisError extends Schema.TaggedError<RedisError>()("RedisError", {
  operation: Schema.String,
  cause: Schema.Defect(),
}) {}

export const connectRedis = Effect.fn("connectRedis")(function* (url: string): Effect.fn.Return<RedisConnection, RedisError> {
  const client = yield* Effect.try({
    try: () => createClient<NoRedisModules, NoRedisFunctions, NoRedisScripts, RedisProtocolVersion, NoTypeMapping>({ url }),
    catch: cause => new RedisError({ operation: "create client", cause }),
  });

  yield* Effect.tryPromise({
    try: () => client.connect(),
    catch: cause => new RedisError({ operation: "connect", cause }),
  });

  return client;
});

export const quitRedis = Effect.fn("quitRedis")(function* (client: RedisConnection): Effect.fn.Return<void, RedisError> {
  if (!client.isOpen)
    return;

  yield* Effect.tryPromise({
    try: () => client.quit(),
    catch: cause => new RedisError({ operation: "quit", cause }),
  });
});

export function withRedisClient<A, E, R>(
  url: string,
  use: (client: RedisConnection) => Effect.Effect<A, E, R>,
): Effect.Effect<A, E | RedisError, R> {
  return Effect.acquireUseRelease(
    connectRedis(url),
    use,
    client => quitRedis(client).pipe(Effect.catch(() => Effect.void)),
  );
}
