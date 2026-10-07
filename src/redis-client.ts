import type { RedisClientType, TypeMapping } from "redis";

import { Effect, Predicate, Schema } from "effect";
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

const CONNECTION_OPERATION_BY_NAME: Record<string, true> = {
  "connect": true,
  "create client": true,
};

const ignoreRedisClientError = (_error: unknown) => undefined;

export function formatUnknownCause(cause: unknown): string {
  if (cause instanceof Error)
    return cause.message || cause.name;

  if (Predicate.isString(cause))
    return cause;

  return String(cause);
}

export function formatRedisError(error: RedisError): string {
  const cause = formatUnknownCause(error.cause);
  const action = CONNECTION_OPERATION_BY_NAME[error.operation]
    ? `Redis connection failed while trying to ${error.operation}`
    : `Redis command failed while trying to ${error.operation}`;

  return cause ? `${action}: ${cause}` : action;
}

export const connectRedis = Effect.fn("connectRedis")(function* (url: string): Effect.fn.Return<RedisConnection, RedisError> {
  const client = yield* Effect.try({
    try: () => createClient<NoRedisModules, NoRedisFunctions, NoRedisScripts, RedisProtocolVersion, NoTypeMapping>({
      socket: {
        reconnectStrategy: false,
      },
      url,
    }),
    catch: cause => new RedisError({ operation: "create client", cause }),
  });

  yield* Effect.sync(() => {
    client.on("error", ignoreRedisClientError);
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
