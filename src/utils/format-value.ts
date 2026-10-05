import { Effect } from "effect";

export const formatValue = Effect.fnUntraced(function* (value: unknown): Effect.fn.Return<string> {
  if (typeof value === "object" && value !== null) {
    return yield* Effect.sync(() => JSON.stringify(value, null, 2));
  }

  if (typeof value === "string") {
    return yield* Effect.try({
      try: () => JSON.stringify(JSON.parse(value), null, 2),
      catch: () => value,
    }).pipe(Effect.catch(fallback => Effect.succeed(fallback)));
  }

  return String(value);
});
